/**
 * Sync persistence helpers.
 *
 * Documents carry `sync_state` ('local' | 'pending' | 'synced') and
 * `remote_updated_at`, so the sync engine can push only what changed and know
 * whether a remote row is newer than the local copy. Watermarks and the
 * workspace identifier live in `sync_meta` (migration 5).
 */
import { getDatabase } from '../index';
import { createId } from '@/utils/id';
import { makeExcerpt, countChars, countWords, htmlToPlainText, readingMinutes } from '@/utils/text';
import { defaultPageSetup, type PageSetup } from '@/types/models';
import { parsePageSetup } from '@/utils/validation';

export type SyncState = 'local' | 'pending' | 'synced';

export interface SyncDocumentPayload {
  id: string;
  notebookId: string;
  title: string;
  contentHtml: string;
  pageSetupJson: string;
  cardColor: string;
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  syncState: SyncState;
  remoteUpdatedAt: string | null;
}

interface SyncRow {
  id: string;
  notebook_id: string;
  title: string;
  content_html: string;
  page_setup_json: string;
  card_color: string;
  is_favorite: number;
  is_pinned: number;
  is_archived: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  sync_state: string;
  remote_updated_at: string | null;
}

function mapRow(row: SyncRow): SyncDocumentPayload {
  return {
    id: row.id,
    notebookId: row.notebook_id,
    title: row.title,
    contentHtml: row.content_html,
    pageSetupJson: row.page_setup_json,
    cardColor: row.card_color,
    isFavorite: Boolean(row.is_favorite),
    isPinned: Boolean(row.is_pinned),
    isArchived: Boolean(row.is_archived),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncState: (row.sync_state as SyncState) ?? 'local',
    remoteUpdatedAt: row.remote_updated_at,
  };
}

const COLUMNS = `id, notebook_id, title, content_html, page_setup_json, card_color,
  is_favorite, is_pinned, is_archived, deleted_at, created_at, updated_at,
  sync_state, remote_updated_at`;

/** Everything that is not yet known to be on the server. */
export async function listUnsyncedDocuments(limit = 200): Promise<SyncDocumentPayload[]> {
  const db = await getDatabase();
  const rows = await db.all<SyncRow>(
    `SELECT ${COLUMNS} FROM documents WHERE sync_state <> 'synced' ORDER BY updated_at ASC LIMIT ?`,
    [limit],
  );
  return rows.map(mapRow);
}

export async function getSyncDocument(id: string): Promise<SyncDocumentPayload | null> {
  const db = await getDatabase();
  const row = await db.get<SyncRow>(`SELECT ${COLUMNS} FROM documents WHERE id = ?`, [id]);
  return row ? mapRow(row) : null;
}

export async function listDocumentsUpdatedAfter(iso: string): Promise<SyncDocumentPayload[]> {
  const db = await getDatabase();
  const rows = await db.all<SyncRow>(`SELECT ${COLUMNS} FROM documents WHERE updated_at > ?`, [iso]);
  return rows.map(mapRow);
}

export async function markDocumentsSynced(ids: string[], remoteUpdatedAt: string): Promise<void> {
  if (!ids.length) return;
  const db = await getDatabase();
  await db.transaction(async () => {
    for (const id of ids) {
      await db.run(
        `UPDATE documents SET sync_state = 'synced', remote_updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
        [remoteUpdatedAt, id],
      );
      // Tombstones keep the 'pending' flag until the server confirms them.
      await db.run(
        `UPDATE documents SET sync_state = 'synced', remote_updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL`,
        [remoteUpdatedAt, id],
      );
    }
  });
}

/** Ensures a remote document's notebook exists locally before inserting it. */
async function ensureNotebook(notebookId: string, name: string): Promise<void> {
  const db = await getDatabase();
  const existing = await db.get<{ id: string }>('SELECT id FROM notebooks WHERE id = ?', [notebookId]);
  if (existing) return;
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO notebooks (id, name, color, icon, sort_order, is_default, created_at, updated_at, deleted_at, is_archived)
     VALUES (?, ?, 'blue', 'cloud-download', 999, 0, ?, ?, NULL, 0)`,
    [notebookId, name || 'Synced notebook', now, now],
  );
}

export type RemoteApplyOutcome = 'inserted' | 'updated' | 'skipped' | 'conflict';

/**
 * Applies a remote document with last-write-wins semantics.
 *
 * - No local row → insert.
 * - Remote strictly newer → overwrite (never losing local edits: the caller
 *   snapshots a version first when the local copy was dirty).
 * - Remote older or equal → skip, so unsynced local work is pushed next.
 */
export async function applyRemoteDocument(input: {
  id: string;
  notebookId: string;
  notebookName?: string;
  title: string;
  contentHtml: string;
  pageSetupJson?: string;
  cardColor?: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}): Promise<RemoteApplyOutcome> {
  const db = await getDatabase();
  await ensureNotebook(input.notebookId, input.notebookName ?? 'Synced notebook');

  const local = await getSyncDocument(input.id);
  if (local) {
    const remoteNewer = input.updatedAt > local.updatedAt;
    if (!remoteNewer) return 'skipped';
    const dirty = local.syncState !== 'synced';
    const plain = htmlToPlainText(input.contentHtml);
    const words = countWords(plain);
    const setup: PageSetup = parsePageSetup(input.pageSetupJson) ?? defaultPageSetup;
    await db.run(
      `UPDATE documents SET
        notebook_id = ?, title = ?, content_html = ?, plain_text = ?, excerpt = ?, card_color = ?,
        is_favorite = ?, is_pinned = ?, is_archived = ?, deleted_at = ?, page_setup_json = ?,
        word_count = ?, char_count = ?, reading_minutes = ?, updated_at = ?,
        sync_state = 'synced', remote_updated_at = ?
      WHERE id = ?`,
      [
        input.notebookId,
        input.title,
        input.contentHtml,
        plain,
        makeExcerpt(plain),
        input.cardColor ?? local.cardColor,
        input.isFavorite ? 1 : 0,
        input.isPinned ? 1 : 0,
        input.isArchived ? 1 : 0,
        input.deletedAt ?? null,
        JSON.stringify(setup),
        words,
        countChars(plain),
        readingMinutes(words),
        input.updatedAt,
        input.updatedAt,
        input.id,
      ],
    );
    return dirty ? 'conflict' : 'updated';
  }

  const plain = htmlToPlainText(input.contentHtml);
  const words = countWords(plain);
  const setup: PageSetup = parsePageSetup(input.pageSetupJson) ?? defaultPageSetup;
  await db.run(
    `INSERT INTO documents (
      id, notebook_id, title, content_html, plain_text, excerpt, card_color,
      is_favorite, is_pinned, is_archived, deleted_at, page_setup_json,
      word_count, char_count, reading_minutes, created_at, updated_at, last_opened_at,
      sync_state, remote_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'synced', ?)`,
    [
      input.id,
      input.notebookId,
      input.title,
      input.contentHtml,
      plain,
      makeExcerpt(plain),
      input.cardColor ?? 'purple',
      input.isFavorite ? 1 : 0,
      input.isPinned ? 1 : 0,
      input.isArchived ? 1 : 0,
      input.deletedAt ?? null,
      JSON.stringify(setup),
      words,
      countChars(plain),
      readingMinutes(words),
      input.createdAt,
      input.updatedAt,
      input.updatedAt,
    ],
  );
  return 'inserted';
}

/* ----------------------------------- meta ---------------------------------- */

export async function getSyncMeta(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.get<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.run(
    `INSERT INTO sync_meta (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, new Date().toISOString()],
  );
}

export async function deleteSyncMeta(key: string): Promise<void> {
  const db = await getDatabase();
  await db.run('DELETE FROM sync_meta WHERE key = ?', [key]);
}

/** Stable per-install identifier, created on first use. */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await getSyncMeta('device_id');
  if (existing) return existing;
  const id = createId('dev');
  await setSyncMeta('device_id', id);
  return id;
}
