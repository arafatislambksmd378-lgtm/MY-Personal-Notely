/**
 * Cloud sync engine (Supabase / PostgREST).
 *
 * Design decisions, in plain terms:
 * - Local SQLite stays the source of truth; sync is push + pull, never a remote
 *   query that blocks the UI.
 * - Documents are the unit of sync. Notebook names travel with their notes so a
 *   fresh device can rebuild the library.
 * - Conflicts resolve last-write-wins on `updated_at`. When a remote row wins
 *   and the local copy had unsynced edits, the local copy is snapshotted into
 *   version history first — nothing is silently destroyed.
 * - Deletions travel as tombstones (`deleted_at`) so a device that was offline
 *   removes the note instead of resurrecting it.
 */
import {
  createSyncClient,
  isSyncConfigured,
  resolveSyncConfig,
  SupabaseError,
  type RemoteDocument,
  type SyncClient,
  type SyncConfig,
} from './supabase';
import {
  applyRemoteDocument,
  getOrCreateDeviceId,
  getSyncMeta,
  getSyncDocument,
  listUnsyncedDocuments,
  markDocumentsSynced,
  setSyncMeta,
  type SyncDocumentPayload,
} from '@/db/repositories/sync';
import { createVersion } from '@/db/repositories/versions';
import { listNotebooks } from '@/db/repositories/notebooks';
import { logEvent } from '@/db/repositories/events';

export interface SyncResult {
  ok: boolean;
  pushed: number;
  pulled: number;
  updated: number;
  conflicts: number;
  skipped: number;
  spaceId: string;
  at: string;
  durationMs: number;
  error?: string;
}

export const PUSH_BATCH_SIZE = 50;
export const PULL_BATCH_SIZE = 200;

function payloadToRow(
  doc: SyncDocumentPayload,
  config: SyncConfig,
  notebookNames: Map<string, string>,
  deviceId: string,
): RemoteDocument {
  return {
    space_id: config.spaceId,
    doc_id: doc.id,
    notebook_id: doc.notebookId,
    notebook_name: notebookNames.get(doc.notebookId) ?? null,
    title: doc.title,
    content_html: doc.contentHtml,
    page_setup: doc.pageSetupJson,
    card_color: doc.cardColor,
    is_favorite: doc.isFavorite,
    is_pinned: doc.isPinned,
    is_archived: doc.isArchived,
    deleted_at: doc.deletedAt,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
    device_id: deviceId,
  };
}

async function notebookNameMap(): Promise<Map<string, string>> {
  const notebooks = await listNotebooks();
  return new Map(notebooks.map((notebook) => [notebook.id, notebook.name]));
}

export interface PushOutcome {
  count: number;
  /** Newest `updated_at` we wrote, so the pull watermark can advance past it. */
  maxUpdatedAt: string | null;
}

/** Pushes every locally-changed document in batches. */
export async function pushPending(client: SyncClient): Promise<PushOutcome> {
  const deviceId = await getOrCreateDeviceId();
  const names = await notebookNameMap();
  let pushed = 0;
  let maxUpdatedAt: string | null = null;

  for (;;) {
    const batch = await listUnsyncedDocuments(PUSH_BATCH_SIZE);
    if (!batch.length) break;
    const rows = batch.map((doc) => payloadToRow(doc, client.config, names, deviceId));
    await client.upsertDocuments(rows);
    const now = new Date().toISOString();
    await markDocumentsSynced(
      batch.map((doc) => doc.id),
      now,
    );
    pushed += batch.length;
    for (const doc of batch) {
      if (!maxUpdatedAt || doc.updatedAt > maxUpdatedAt) maxUpdatedAt = doc.updatedAt;
    }
    if (batch.length < PUSH_BATCH_SIZE) break;
  }

  return { count: pushed, maxUpdatedAt };
}

/** Applies remote changes, protecting unsynced local edits with a snapshot. */
export async function pullRemote(
  client: SyncClient,
  since: string | null,
): Promise<{ pulled: number; updated: number; conflicts: number; skipped: number; watermark: string | null }> {
  let cursor = since;
  let pulled = 0;
  let updated = 0;
  let conflicts = 0;
  let skipped = 0;
  let watermark: string | null = since;

  for (;;) {
    const rows = await client.pullDocuments(cursor, PULL_BATCH_SIZE);
    if (!rows.length) break;

    for (const row of rows) {
      pulled += 1;
      const remoteUpdatedAt = row.updated_at;
      // Snapshot local work before a remote overwrite can replace it.
      const existing = await getSyncDocument(row.doc_id);
      if (existing && existing.updatedAt < remoteUpdatedAt && existing.syncState !== 'synced') {
        await snapshotBeforeRemoteOverwrite(row.doc_id);
      }
      const outcome = await applyRemoteDocument({
        id: row.doc_id,
        notebookId: row.notebook_id,
        notebookName: row.notebook_name ?? undefined,
        title: row.title ?? '',
        contentHtml: row.content_html ?? '',
        pageSetupJson: row.page_setup ?? undefined,
        cardColor: row.card_color ?? undefined,
        isFavorite: row.is_favorite,
        isPinned: row.is_pinned,
        isArchived: row.is_archived,
        deletedAt: row.deleted_at,
        createdAt: row.created_at,
        updatedAt: remoteUpdatedAt,
      });
      if (outcome === 'inserted' || outcome === 'updated') updated += 1;
      else if (outcome === 'conflict') {
        conflicts += 1;
        updated += 1;
      } else skipped += 1;
    }

    const last = rows[rows.length - 1]?.updated_at ?? null;
    if (last && (!watermark || last > watermark)) watermark = last;
    if (rows.length < PULL_BATCH_SIZE) break;
    cursor = last ?? cursor;
    if (!cursor) break;
  }

  return { pulled, updated, conflicts, skipped, watermark };
}

export interface SyncOptions {
  client?: SyncClient;
  /** Pull only (used when another device should not be pushed to). */
  pullOnly?: boolean;
}

/** Runs a full push + pull cycle and records the outcome. */
export async function syncNow(options: SyncOptions = {}): Promise<SyncResult> {
  const startedAt = Date.now();
  const startedIso = new Date().toISOString();

  let client = options.client;
  if (!client) {
    const config = await resolveSyncConfig();
    if (!isSyncConfigured(config)) {
      return {
        ok: false,
        pushed: 0,
        pulled: 0,
        updated: 0,
        conflicts: 0,
        skipped: 0,
        spaceId: '—',
        at: startedIso,
        durationMs: 0,
        error: 'Cloud sync is not connected. Add your Supabase URL, anon key and sync token in Settings → Cloud sync.',
      };
    }
    client = createSyncClient(config);
  }

  const config = client.config;
  try {
    const since = await getSyncMeta('last_pull_at');
    const pull = await pullRemote(client, since);
    const push = options.pullOnly ? { count: 0, maxUpdatedAt: null } : await pushPending(client);
    const pushed = push.count;

    const at = new Date().toISOString();
    await setSyncMeta('last_sync_at', at);
    // Advance the watermark past both what we pulled and what we just wrote,
    // otherwise our own uploads would be pulled back on the next run.
    const watermarkCandidates = [pull.watermark, push.maxUpdatedAt].filter((value): value is string => Boolean(value));
    if (watermarkCandidates.length) {
      await setSyncMeta('last_pull_at', watermarkCandidates.sort().at(-1) as string);
    }

    const result: SyncResult = {
      ok: true,
      pushed,
      pulled: pull.pulled,
      updated: pull.updated,
      conflicts: pull.conflicts,
      skipped: pull.skipped,
      spaceId: config.spaceId,
      at,
      durationMs: Date.now() - startedAt,
    };
    await setSyncMeta('last_result', JSON.stringify(result));
    void logEvent('info', 'sync', 'Sync completed', {
      pushed,
      pulled: pull.pulled,
      conflicts: pull.conflicts,
    });
    return result;
  } catch (error) {
    const message =
      error instanceof SupabaseError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Sync failed for an unknown reason.';
    const result: SyncResult = {
      ok: false,
      pushed: 0,
      pulled: 0,
      updated: 0,
      conflicts: 0,
      skipped: 0,
      spaceId: config.spaceId,
      at: startedIso,
      durationMs: Date.now() - startedAt,
      error: message,
    };
    await setSyncMeta('last_result', JSON.stringify(result));
    void logEvent('warn', 'sync', 'Sync failed', { message });
    return result;
  }
}

/** Last recorded result, for the settings screen. */
export async function getLastSyncResult(): Promise<SyncResult | null> {
  const raw = await getSyncMeta('last_result');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SyncResult;
  } catch {
    return null;
  }
}

export async function getSyncStatus(): Promise<{
  connected: boolean;
  spaceId: string | null;
  url: string | null;
  lastSyncAt: string | null;
  lastResult: SyncResult | null;
}> {
  const config = await resolveSyncConfig();
  const [lastSyncAt, lastResult] = await Promise.all([getSyncMeta('last_sync_at'), getLastSyncResult()]);
  return {
    connected: isSyncConfigured(config),
    spaceId: config?.spaceId ?? null,
    url: config?.url ?? null,
    lastSyncAt,
    lastResult,
  };
}

/** Creates a version snapshot before a remote overwrite (used by the pull loop). */
export async function snapshotBeforeRemoteOverwrite(documentId: string): Promise<void> {
  await createVersion(documentId, { force: true, label: 'Before cloud sync', minIntervalMs: 0 });
}
