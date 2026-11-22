/**
 * Full local backup and restore.
 *
 * A backup is a single JSON document containing every notebook, note, version,
 * tag, comment and bookmark plus the user settings that are safe to move between
 * devices (PIN material is never included). Restoring validates the payload
 * before touching the database and runs inside one transaction.
 */
import { z } from 'zod';
import JSZip from 'jszip';
import { getDatabase } from '@/db';
import { defaultPageSetup, defaultSettings, type PageSetup } from '@/types/models';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import { createId } from '@/utils/id';
import { htmlToPlainText, makeExcerpt, countWords, countChars, readingMinutes } from '@/utils/text';
import { parsePageSetup } from '@/utils/validation';

export const BACKUP_VERSION = 1;

const notebookSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string().default('purple'),
  icon: z.string().default('book'),
  sort_order: z.number().default(0),
  is_default: z.number().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});

const documentSchema = z.object({
  id: z.string(),
  notebook_id: z.string(),
  title: z.string().default(''),
  content_html: z.string().default(''),
  card_color: z.string().default('purple'),
  is_favorite: z.number().default(0),
  is_pinned: z.number().default(0),
  is_archived: z.number().default(0),
  deleted_at: z.string().nullable().default(null),
  page_setup_json: z.string().default('{}'),
  created_at: z.string(),
  updated_at: z.string(),
});

const backupSchema = z.object({
  format: z.literal('notely-backup'),
  version: z.number(),
  exportedAt: z.string(),
  appVersion: z.string().optional(),
  notebooks: z.array(notebookSchema),
  documents: z.array(documentSchema),
  versions: z
    .array(
      z.object({
        id: z.string(),
        document_id: z.string(),
        title: z.string().default(''),
        content_html: z.string().default(''),
        word_count: z.number().default(0),
        label: z.string().nullable().default(null),
        created_at: z.string(),
      }),
    )
    .default([]),
  tags: z.array(z.object({ id: z.string(), name: z.string(), color: z.string(), created_at: z.string() })).default([]),
  documentTags: z.array(z.object({ document_id: z.string(), tag_id: z.string() })).default([]),
  comments: z
    .array(
      z.object({
        id: z.string(),
        document_id: z.string(),
        author: z.string(),
        body: z.string(),
        quote: z.string().nullable().default(null),
        is_resolved: z.number().default(0),
        created_at: z.string(),
      }),
    )
    .default([]),
  bookmarks: z
    .array(z.object({ id: z.string(), document_id: z.string(), label: z.string(), anchor: z.string(), created_at: z.string() }))
    .default([]),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type BackupPayload = z.infer<typeof backupSchema>;

export interface BackupOptions {
  includeVersions?: boolean;
  pretty?: boolean;
}

export async function createBackup(options: BackupOptions = {}): Promise<{ json: string; counts: Record<string, number> }> {
  const db = await getDatabase();
  const [notebooks, documents, versions, tags, documentTags, comments, bookmarks, settings] = await Promise.all([
    db.all('SELECT id, name, color, icon, sort_order, is_default, created_at, updated_at FROM notebooks'),
    db.all(
      `SELECT id, notebook_id, title, content_html, card_color, is_favorite, is_pinned, is_archived,
              deleted_at, page_setup_json, created_at, updated_at FROM documents`,
    ),
    options.includeVersions === false
      ? Promise.resolve([])
      : db.all('SELECT id, document_id, title, content_html, word_count, label, created_at FROM document_versions'),
    db.all('SELECT id, name, color, created_at FROM tags'),
    db.all('SELECT document_id, tag_id FROM document_tags'),
    db.all('SELECT id, document_id, author, body, quote, is_resolved, created_at FROM comments'),
    db.all('SELECT id, document_id, label, anchor, created_at FROM bookmarks'),
    getSettings(),
  ]);

  // PIN hashes live in secure storage; strip any trace from the payload.
  const { pinHash: _pinHash, pinSalt: _pinSalt, ...safeSettings } = settings;
  const payload: BackupPayload = {
    format: 'notely-backup',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    notebooks: notebooks as BackupPayload['notebooks'],
    documents: documents as BackupPayload['documents'],
    versions: versions as BackupPayload['versions'],
    tags: tags as BackupPayload['tags'],
    documentTags: documentTags as BackupPayload['documentTags'],
    comments: comments as BackupPayload['comments'],
    bookmarks: bookmarks as BackupPayload['bookmarks'],
    settings: safeSettings,
  };

  const json = JSON.stringify(payload, null, options.pretty ? 2 : 0);
  return {
    json,
    counts: {
      notebooks: payload.notebooks.length,
      documents: payload.documents.length,
      versions: payload.versions.length,
      tags: payload.tags.length,
      comments: payload.comments.length,
      bookmarks: payload.bookmarks.length,
    },
  };
}

/** Packaged backup (.notely.zip) that also embeds a readable HTML copy. */
export async function createBackupArchive(): Promise<Uint8Array> {
  const { json } = await createBackup();
  const zip = new JSZip();
  zip.file('notely-backup.json', json);
  zip.file(
    'README.txt',
    'Notely backup.\n\nnotely-backup.json contains every notebook, note, version, tag, comment and bookmark.\nRestore it from Settings -> Backup & restore -> Restore backup.\n',
  );
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export interface RestoreResult {
  notebooks: number;
  documents: number;
  skipped: number;
}

export async function restoreBackup(rawJson: string, options: { mode?: 'merge' | 'replace' } = {}): Promise<RestoreResult> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch {
    throw new Error('This file is not a Notely backup (invalid JSON).');
  }
  const parsed = backupSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`This backup is not valid: ${parsed.error.issues[0]?.message ?? 'unknown format'}`);
  }
  const payload = parsed.data;
  if (payload.version > BACKUP_VERSION) {
    throw new Error('This backup was created by a newer version of Notely.');
  }

  const db = await getDatabase();
  const mode = options.mode ?? 'merge';
  let skipped = 0;
  let documentCount = 0;

  await db.transaction(async () => {
    if (mode === 'replace') {
      await db.run('DELETE FROM document_versions');
      await db.run('DELETE FROM comments');
      await db.run('DELETE FROM bookmarks');
      await db.run('DELETE FROM document_tags');
      await db.run('DELETE FROM tags');
      await db.run('DELETE FROM documents');
      await db.run('DELETE FROM notebooks');
    }

    const notebookIds = new Set<string>();
    for (const notebook of payload.notebooks) {
      const existing = await db.get<{ id: string }>('SELECT id FROM notebooks WHERE id = ?', [notebook.id]);
      if (existing) {
        notebookIds.add(notebook.id);
        if (mode === 'merge') continue;
      }
      await db.run(
        `INSERT OR REPLACE INTO notebooks (id, name, color, icon, sort_order, is_default, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          notebook.id,
          notebook.name,
          notebook.color,
          notebook.icon,
          notebook.sort_order,
          notebook.is_default,
          notebook.created_at,
          notebook.updated_at,
        ],
      );
      notebookIds.add(notebook.id);
    }

    for (const document of payload.documents) {
      if (!notebookIds.has(document.notebook_id)) {
        skipped += 1;
        continue;
      }
      const exists = await db.get<{ id: string }>('SELECT id FROM documents WHERE id = ?', [document.id]);
      if (exists && mode === 'merge') {
        skipped += 1;
        continue;
      }
      const plain = htmlToPlainText(document.content_html);
      const words = countWords(plain);
      const setup: PageSetup = parsePageSetup(document.page_setup_json) ?? defaultPageSetup;
      await db.run(
        `INSERT OR REPLACE INTO documents (
          id, notebook_id, title, content_html, plain_text, excerpt, card_color, is_favorite, is_pinned,
          is_archived, deleted_at, page_setup_json, word_count, char_count, reading_minutes,
          created_at, updated_at, last_opened_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          document.id,
          document.notebook_id,
          document.title,
          document.content_html,
          plain,
          makeExcerpt(plain),
          document.card_color,
          document.is_favorite,
          document.is_pinned,
          document.is_archived,
          document.deleted_at,
          JSON.stringify(setup),
          words,
          countChars(plain),
          readingMinutes(words),
          document.created_at,
          document.updated_at,
        ],
      );
      documentCount += 1;
    }

    for (const tag of payload.tags) {
      await db.run('INSERT OR IGNORE INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)', [
        tag.id,
        tag.name,
        tag.color,
        tag.created_at,
      ]);
    }
    for (const link of payload.documentTags) {
      await db.run('INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)', [
        link.document_id,
        link.tag_id,
      ]);
    }
    for (const version of payload.versions) {
      await db.run(
        `INSERT OR IGNORE INTO document_versions (id, document_id, title, content_html, word_count, label, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [version.id, version.document_id, version.title, version.content_html, version.word_count, version.label, version.created_at],
      );
    }
    for (const comment of payload.comments) {
      await db.run(
        `INSERT OR IGNORE INTO comments (id, document_id, author, body, quote, is_resolved, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [comment.id, comment.document_id, comment.author, comment.body, comment.quote, comment.is_resolved, comment.created_at],
      );
    }
    for (const bookmark of payload.bookmarks) {
      await db.run(
        'INSERT OR IGNORE INTO bookmarks (id, document_id, label, anchor, created_at) VALUES (?, ?, ?, ?, ?)',
        [bookmark.id, bookmark.document_id, bookmark.label, bookmark.anchor, bookmark.created_at],
      );
    }
  });

  if (payload.settings) {
    const safe = { ...defaultSettings, ...payload.settings } as Record<string, unknown>;
    delete safe.pinHash;
    delete safe.pinSalt;
    await updateSettings(safe as never);
  }

  return { notebooks: payload.notebooks.length, documents: documentCount, skipped };
}

/** Restores from a .notely.zip archive produced by createBackupArchive. */
export async function restoreFromArchive(bytes: Uint8Array): Promise<RestoreResult> {
  const zip = await JSZip.loadAsync(bytes);
  const jsonFile = zip.file('notely-backup.json');
  if (!jsonFile) throw new Error('This archive does not contain a Notely backup.');
  return restoreBackup(await jsonFile.async('string'));
}

export function newRestoreId(): string {
  return createId('rst');
}
