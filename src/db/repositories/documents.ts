/**
 * Document persistence: creation, autosave, listing, search, trash lifecycle.
 *
 * Content writes always recompute derived fields (plain text, excerpt, word /
 * character counts, reading time) inside a single statement so the list cards
 * can never disagree with the editor.
 */
import { getDatabase } from '../index';
import { mapDocument, type DocumentRow } from '../rows';
import type { DocumentRecord, DocumentSummary, PageSetup } from '@/types/models';
import { defaultPageSetup } from '@/types/models';
import { countChars, countWords, makeExcerpt, htmlToPlainText, readingMinutes, titleOrDefault } from '@/utils/text';
import { asAccent } from '../rows';
import { createId } from '@/utils/id';
import type { AccentName } from '@/design/tokens';
import { pageSetupSchema, parsePageSetup } from '@/utils/validation';

export type DocumentSort = 'updated_desc' | 'updated_asc' | 'created_desc' | 'title_asc';

export interface DocumentFilter {
  notebookId?: string;
  favorite?: boolean;
  pinned?: boolean;
  archived?: boolean;
  trashed?: boolean;
  tag?: string;
  search?: string;
  sort?: DocumentSort;
  limit?: number;
  offset?: number;
}

export interface DocumentStats {
  total: number;
  notes: number;
  archived: number;
  trashed: number;
  favorites: number;
  words: number;
  notebooks: number;
}

const SORT_SQL: Record<DocumentSort, string> = {
  updated_desc: 'd.updated_at DESC',
  updated_asc: 'd.updated_at ASC',
  created_desc: 'd.created_at DESC',
  title_asc: 'd.title COLLATE NOCASE ASC',
};

function buildWhere(filter: DocumentFilter): { clause: string; params: (string | number)[] } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filter.trashed) {
    conditions.push('d.deleted_at IS NOT NULL');
  } else {
    conditions.push('d.deleted_at IS NULL');
  }

  if (filter.archived !== undefined) {
    conditions.push('d.is_archived = ?');
    params.push(filter.archived ? 1 : 0);
  } else if (!filter.trashed) {
    conditions.push('d.is_archived = 0');
  }

  if (filter.favorite) {
    conditions.push('d.is_favorite = 1');
  }
  if (filter.pinned) {
    conditions.push('d.is_pinned = 1');
  }
  if (filter.notebookId) {
    conditions.push('d.notebook_id = ?');
    params.push(filter.notebookId);
  }
  if (filter.tag) {
    conditions.push(
      'EXISTS (SELECT 1 FROM document_tags dt JOIN tags t ON t.id = dt.tag_id WHERE dt.document_id = d.id AND t.name = ? COLLATE NOCASE)',
    );
    params.push(filter.tag);
  }
  if (filter.search?.trim()) {
    const like = `%${filter.search.trim()}%`;
    conditions.push('(d.title LIKE ? COLLATE NOCASE OR d.plain_text LIKE ? COLLATE NOCASE)');
    params.push(like, like);
  }

  return { clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

export async function listDocuments(filter: DocumentFilter = {}): Promise<DocumentRecord[]> {
  const db = await getDatabase();
  const { clause, params } = buildWhere(filter);
  const order = filter.pinned ? 'd.updated_at DESC' : `d.is_pinned DESC, ${SORT_SQL[filter.sort ?? 'updated_desc']}`;
  const limit = typeof filter.limit === 'number' ? `LIMIT ${Math.max(0, Math.floor(filter.limit))}` : '';
  const offset = filter.offset ? `OFFSET ${Math.max(0, Math.floor(filter.offset))}` : '';
  const rows = await db.all<DocumentRow>(
    `SELECT d.*, nb.name AS notebook_name FROM documents d
     LEFT JOIN notebooks nb ON nb.id = d.notebook_id
     ${clause} ORDER BY ${order} ${limit} ${offset}`,
    params,
  );
  return rows.map(mapDocument);
}

export async function listDocumentSummaries(filter: DocumentFilter = {}): Promise<DocumentSummary[]> {
  const docs = await listDocuments(filter);
  if (!docs.length) return [];
  const db = await getDatabase();
  const ids = docs.map((doc) => doc.id);
  const placeholders = ids.map(() => '?').join(',');
  const tagRows = await db.all<{ document_id: string; name: string }>(
    `SELECT dt.document_id, t.name FROM document_tags dt JOIN tags t ON t.id = dt.tag_id
     WHERE dt.document_id IN (${placeholders}) ORDER BY t.name ASC`,
    ids,
  );
  const tagsById = new Map<string, string[]>();
  for (const row of tagRows) {
    const list = tagsById.get(row.document_id) ?? [];
    list.push(row.name);
    tagsById.set(row.document_id, list);
  }
  return docs.map((doc) => ({
    id: doc.id,
    notebookId: doc.notebookId,
    title: titleOrDefault(doc.title, doc.plainText),
    excerpt: doc.excerpt,
    cardColor: doc.cardColor,
    isFavorite: doc.isFavorite,
    isPinned: doc.isPinned,
    isArchived: doc.isArchived,
    deletedAt: doc.deletedAt,
    wordCount: doc.wordCount,
    readingMinutes: doc.readingMinutes,
    updatedAt: doc.updatedAt,
    createdAt: doc.createdAt,
    tags: tagsById.get(doc.id) ?? [],
  }));
}

export async function getDocument(id: string): Promise<DocumentRecord | null> {
  const db = await getDatabase();
  const row = await db.get<DocumentRow>('SELECT * FROM documents WHERE id = ?', [id]);
  return row ? mapDocument(row) : null;
}

export async function createDocument(input: {
  notebookId?: string;
  title?: string;
  contentHtml?: string;
  cardColor?: AccentName;
  pageSetup?: PageSetup;
  isPinned?: boolean;
}): Promise<DocumentRecord> {
  const db = await getDatabase();
  let notebookId = input.notebookId;
  if (!notebookId) {
    const row = await db.get<{ id: string }>(
      'SELECT id FROM notebooks WHERE deleted_at IS NULL ORDER BY is_default DESC, sort_order ASC LIMIT 1',
    );
    notebookId = row?.id;
  }
  if (!notebookId) throw new Error('Create a notebook before adding notes.');
  const notebookExists = await db.get<{ id: string }>(
    'SELECT id FROM notebooks WHERE id = ? AND deleted_at IS NULL',
    [notebookId],
  );
  if (!notebookExists) throw new Error('The selected notebook no longer exists.');

  const now = new Date().toISOString();
  const id = createId('doc');
  const html = input.contentHtml ?? '';
  const plain = htmlToPlainText(html);
  const words = countWords(plain);
  const setup = input.pageSetup && pageSetupSchema.safeParse(input.pageSetup).success
    ? input.pageSetup
    : defaultPageSetup;

  await db.run(
    `INSERT INTO documents (
      id, notebook_id, title, content_html, plain_text, excerpt, card_color,
      is_favorite, is_pinned, is_archived, deleted_at, page_setup_json,
      word_count, char_count, reading_minutes, created_at, updated_at, last_opened_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, NULL, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      notebookId,
      input.title ?? '',
      html,
      plain,
      makeExcerpt(plain),
      input.cardColor ?? 'purple',
      input.isPinned ? 1 : 0,
      JSON.stringify(setup),
      words,
      countChars(plain),
      readingMinutes(words),
      now,
      now,
      now,
    ],
  );

  const created = await getDocument(id);
  if (!created) throw new Error('Document could not be created.');
  return created;
}

export interface ContentUpdate {
  html: string;
  plainText?: string;
  title?: string;
}

/** Autosave entry point. Returns the derived summary fields that were stored. */
export async function saveDocumentContent(id: string, update: ContentUpdate): Promise<{
  title: string;
  wordCount: number;
  charCount: number;
  readingMinutes: number;
  excerpt: string;
  updatedAt: string;
}> {
  const db = await getDatabase();
  const existing = await db.get<{ title: string; content_html: string }>(
    'SELECT title, content_html FROM documents WHERE id = ?',
    [id],
  );
  if (!existing) throw new Error('Document not found');

  const plain = update.plainText ?? htmlToPlainText(update.html);
  const words = countWords(plain);
  const chars = countChars(plain);
  const reading = readingMinutes(words);
  const excerpt = makeExcerpt(plain);
  const title = (update.title ?? existing.title ?? '').slice(0, 200);
  const now = new Date().toISOString();

  await db.run(
    `UPDATE documents SET title = ?, content_html = ?, plain_text = ?, excerpt = ?,
      word_count = ?, char_count = ?, reading_minutes = ?, updated_at = ? WHERE id = ?`,
    [title, update.html, plain, excerpt, words, chars, reading, now, id],
  );

  return { title, wordCount: words, charCount: chars, readingMinutes: reading, excerpt, updatedAt: now };
}

export interface DocumentPatch {
  title?: string;
  notebookId?: string;
  cardColor?: AccentName;
  isFavorite?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  pageSetup?: PageSetup;
}

export async function patchDocument(id: string, patch: DocumentPatch): Promise<void> {
  const db = await getDatabase();
  const current = await getDocument(id);
  if (!current) throw new Error('Document not found');
  const now = new Date().toISOString();

  const title = patch.title !== undefined ? patch.title.slice(0, 200) : current.title;
  const notebookId = patch.notebookId ?? current.notebookId;
  const cardColor = asAccent(patch.cardColor ?? current.cardColor);
  const favorite = (patch.isFavorite ?? current.isFavorite) ? 1 : 0;
  const pinned = (patch.isPinned ?? current.isPinned) ? 1 : 0;
  const archived = (patch.isArchived ?? current.isArchived) ? 1 : 0;
  const setup = patch.pageSetup ? parsePageSetup(patch.pageSetup) : current.pageSetup;

  if (patch.notebookId && patch.notebookId !== current.notebookId) {
    const exists = await db.get<{ id: string }>(
      'SELECT id FROM notebooks WHERE id = ? AND deleted_at IS NULL',
      [patch.notebookId],
    );
    if (!exists) throw new Error('Target notebook not found.');
  }

  await db.run(
    `UPDATE documents SET title = ?, notebook_id = ?, card_color = ?, is_favorite = ?, is_pinned = ?,
      is_archived = ?, page_setup_json = ?, updated_at = ? WHERE id = ?`,
    [title, notebookId, cardColor, favorite, pinned, archived, JSON.stringify(setup), now, id],
  );
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const doc = await getDocument(id);
  if (!doc) throw new Error('Document not found');
  await patchDocument(id, { isFavorite: !doc.isFavorite });
  return !doc.isFavorite;
}

export async function togglePinned(id: string): Promise<boolean> {
  const doc = await getDocument(id);
  if (!doc) throw new Error('Document not found');
  await patchDocument(id, { isPinned: !doc.isPinned });
  return !doc.isPinned;
}

export async function toggleArchived(id: string): Promise<boolean> {
  const doc = await getDocument(id);
  if (!doc) throw new Error('Document not found');
  await patchDocument(id, { isArchived: !doc.isArchived });
  return !doc.isArchived;
}

export async function moveToNotebook(id: string, notebookId: string): Promise<void> {
  await patchDocument(id, { notebookId });
}

/** Soft delete — the note moves to Trash and can be restored. */
export async function trashDocument(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.run('UPDATE documents SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
}

export async function restoreDocument(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.run('UPDATE documents SET deleted_at = NULL, updated_at = ? WHERE id = ?', [now, id]);
}

/** Permanently removes a document and every child row (versions, comments…). */
export async function purgeDocument(id: string): Promise<void> {
  const db = await getDatabase();
  await db.transaction(async () => {
    await db.run('DELETE FROM document_versions WHERE document_id = ?', [id]);
    await db.run('DELETE FROM comments WHERE document_id = ?', [id]);
    await db.run('DELETE FROM bookmarks WHERE document_id = ?', [id]);
    await db.run('DELETE FROM media_assets WHERE document_id = ?', [id]);
    await db.run('DELETE FROM document_tags WHERE document_id = ?', [id]);
    await db.run('DELETE FROM document_shares WHERE document_id = ?', [id]);
    await db.run('DELETE FROM documents WHERE id = ?', [id]);
  });
}

export async function emptyTrash(): Promise<number> {
  const db = await getDatabase();
  const rows = await db.all<{ id: string }>('SELECT id FROM documents WHERE deleted_at IS NOT NULL');
  for (const row of rows) {
    await purgeDocument(row.id);
  }
  return rows.length;
}

export async function duplicateDocument(id: string): Promise<DocumentRecord> {
  const db = await getDatabase();
  const doc = await getDocument(id);
  if (!doc) throw new Error('Document not found');
  const now = new Date().toISOString();
  const newId = createId('doc');
  const title = `${titleOrDefault(doc.title, doc.plainText)} (copy)`.slice(0, 200);
  await db.run(
    `INSERT INTO documents (
      id, notebook_id, title, content_html, plain_text, excerpt, card_color,
      is_favorite, is_pinned, is_archived, deleted_at, page_setup_json,
      word_count, char_count, reading_minutes, created_at, updated_at, last_opened_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, NULL, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      newId,
      doc.notebookId,
      title,
      doc.contentHtml,
      doc.plainText,
      doc.excerpt,
      doc.cardColor,
      JSON.stringify(doc.pageSetup),
      doc.wordCount,
      doc.charCount,
      doc.readingMinutes,
      now,
      now,
    ],
  );
  const copy = await getDocument(newId);
  if (!copy) throw new Error('Duplicate failed.');
  return copy;
}

export async function touchOpened(id: string): Promise<void> {
  const db = await getDatabase();
  await db.run('UPDATE documents SET last_opened_at = ? WHERE id = ?', [new Date().toISOString(), id]);
}

export async function searchDocuments(query: string, limit = 30): Promise<DocumentSummary[]> {
  if (!query.trim()) return [];
  return listDocumentSummaries({ search: query, limit });
}

export async function getRecentDocuments(limit = 6): Promise<DocumentSummary[]> {
  return listDocumentSummaries({ limit, sort: 'updated_desc' });
}

export async function getDocumentStats(): Promise<DocumentStats> {
  const db = await getDatabase();
  const row = await db.get<{
    total: number | string;
    notes: number | string;
    archived: number | string;
    trashed: number | string;
    favorites: number | string;
    words: number | string;
  }>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN deleted_at IS NULL AND is_archived = 0 THEN 1 ELSE 0 END) AS notes,
       SUM(CASE WHEN deleted_at IS NULL AND is_archived = 1 THEN 1 ELSE 0 END) AS archived,
       SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS trashed,
       SUM(CASE WHEN is_favorite = 1 AND deleted_at IS NULL THEN 1 ELSE 0 END) AS favorites,
       COALESCE(SUM(word_count), 0) AS words
     FROM documents`,
  );
  const notebookRow = await db.get<{ count: number | string }>(
    'SELECT COUNT(*) AS count FROM notebooks WHERE deleted_at IS NULL',
  );
  return {
    total: Number(row?.total ?? 0),
    notes: Number(row?.notes ?? 0),
    archived: Number(row?.archived ?? 0),
    trashed: Number(row?.trashed ?? 0),
    favorites: Number(row?.favorites ?? 0),
    words: Number(row?.words ?? 0),
    notebooks: Number(notebookRow?.count ?? 0),
  };
}

export async function countDocuments(): Promise<number> {
  const db = await getDatabase();
  const row = await db.get<{ count: number | string }>(
    'SELECT COUNT(*) AS count FROM documents WHERE deleted_at IS NULL AND is_archived = 0',
  );
  return Number(row?.count ?? 0);
}
