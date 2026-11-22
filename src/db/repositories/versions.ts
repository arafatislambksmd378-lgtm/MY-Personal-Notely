/**
 * Version history.
 *
 * A snapshot is written at most once per `minIntervalMs` per document, and only
 * when the content actually changed, so long editing sessions stay cheap. The
 * latest `maxVersions` snapshots are retained (oldest pruned in the same
 * transaction), and restoring a snapshot first backs up the current state so a
 * restore can never destroy the newest content.
 */
import { getDatabase } from '../index';
import { mapVersion, type VersionRow } from '../rows';
import type { DocumentVersion } from '@/types/models';
import { createId } from '@/utils/id';
import { countWords, htmlToPlainText } from '@/utils/text';
import { getDocument, saveDocumentContent } from './documents';

export const DEFAULT_MIN_INTERVAL_MS = 60_000;
export const DEFAULT_MAX_VERSIONS = 100;

export async function createVersion(
  documentId: string,
  options: {
    label?: string | null;
    force?: boolean;
    allowDuplicate?: boolean;
    minIntervalMs?: number;
    maxVersions?: number;
  } = {},
): Promise<DocumentVersion | null> {
  const db = await getDatabase();
  const doc = await getDocument(documentId);
  if (!doc) throw new Error('Document not found');

  const minInterval = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const last = await db.get<VersionRow>(
    'SELECT * FROM document_versions WHERE document_id = ? ORDER BY created_at DESC LIMIT 1',
    [documentId],
  );

  if (last) {
    const sameContent = last.content_html === doc.contentHtml && last.title === doc.title;
    if (sameContent && !options.allowDuplicate) return null;
    const age = Date.now() - new Date(last.created_at).getTime();
    if (!options.force && age < minInterval) return null;
  }

  const id = createId('ver');
  const now = new Date().toISOString();
  const words = doc.wordCount || countWords(doc.plainText || htmlToPlainText(doc.contentHtml));

  await db.transaction(async () => {
    await db.run(
      `INSERT INTO document_versions (id, document_id, title, content_html, word_count, label, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, documentId, doc.title, doc.contentHtml, words, options.label ?? null, now],
    );
    await db.run(
      `DELETE FROM document_versions WHERE document_id = ? AND id NOT IN (
         SELECT id FROM document_versions WHERE document_id = ? ORDER BY created_at DESC LIMIT ?
       )`,
      [documentId, documentId, options.maxVersions ?? DEFAULT_MAX_VERSIONS],
    );
  });

  return {
    id,
    documentId,
    title: doc.title,
    contentHtml: doc.contentHtml,
    wordCount: words,
    label: options.label ?? null,
    createdAt: now,
  };
}

export async function listVersions(documentId: string, limit = 100): Promise<DocumentVersion[]> {
  const db = await getDatabase();
  const rows = await db.all<VersionRow>(
    'SELECT * FROM document_versions WHERE document_id = ? ORDER BY created_at DESC LIMIT ?',
    [documentId, limit],
  );
  return rows.map(mapVersion);
}

export async function getVersion(id: string): Promise<DocumentVersion | null> {
  const db = await getDatabase();
  const row = await db.get<VersionRow>('SELECT * FROM document_versions WHERE id = ?', [id]);
  return row ? mapVersion(row) : null;
}

export async function restoreVersion(versionId: string): Promise<DocumentVersion> {
  const version = await getVersion(versionId);
  if (!version) throw new Error('Version not found');
  // Preserve the current content before overwriting it.
  await createVersion(version.documentId, { label: 'Before restore', force: true });
  await saveDocumentContent(version.documentId, {
    html: version.contentHtml,
    plainText: htmlToPlainText(version.contentHtml),
    title: version.title,
  });
  return version;
}

export async function deleteVersion(id: string): Promise<void> {
  const db = await getDatabase();
  await db.run('DELETE FROM document_versions WHERE id = ?', [id]);
}

export async function countVersions(documentId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.get<{ count: number | string }>(
    'SELECT COUNT(*) AS count FROM document_versions WHERE document_id = ?',
    [documentId],
  );
  return Number(row?.count ?? 0);
}

/** Total number of stored versions across every document (diagnostics). */
export async function countVersionsAll(): Promise<number> {
  const db = await getDatabase();
  const row = await db.get<{ count: number }>('SELECT COUNT(*) AS count FROM document_versions');
  return row?.count ?? 0;
}
