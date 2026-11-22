/** Diagnostics: database health, storage usage and recent event log. */
import { getDatabase, getSchemaVersion } from '@/db';
import { listEvents, clearEvents } from '@/db/repositories/events';
import { getDocumentStats } from '@/db/repositories/documents';
import { countVersionsAll } from '@/db/repositories/versions';
import { getMediaUsage } from '@/db/repositories/media';
import { APP_CONFIG } from '@/config/app';
import type { AppEvent, EventLevel } from '@/db/repositories/events';

export interface DatabaseHealth {
  schemaVersion: number;
  pageCount: number;
  pageSize: number;
  sizeBytes: number;
  integrity: string;
  foreignKeysOk: boolean;
  walMode: boolean;
}

export interface DiagnosticsReport {
  health: DatabaseHealth;
  counts: {
    notes: number;
    archived: number;
    trashed: number;
    notebooks: number;
    versions: number;
    media: number;
    mediaBytes: number;
  };
  events: AppEvent[];
  generatedAt: string;
}

export async function runDiagnostics(limit = 40): Promise<DiagnosticsReport> {
  const db = await getDatabase();
  const pragmaOne = async (sql: string): Promise<string> => {
    const row = await db.get<Record<string, unknown>>(sql);
    const value = row ? Object.values(row)[0] : null;
    return value === null || value === undefined ? '' : String(value);
  };

  const [pageCount, pageSize, integrity, journalMode, foreignKeys] = await Promise.all([
    pragmaOne('PRAGMA page_count'),
    pragmaOne('PRAGMA page_size'),
    pragmaOne('PRAGMA integrity_check'),
    pragmaOne('PRAGMA journal_mode'),
    pragmaOne('PRAGMA foreign_keys'),
  ]);

  const [stats, notebooks, versions, media, events, schemaVersion] = await Promise.all([
    getDocumentStats(),
    db.get<{ count: number }>('SELECT COUNT(*) AS count FROM notebooks WHERE deleted_at IS NULL'),
    countVersionsAll(),
    getMediaUsage(),
    listEvents(limit),
    getSchemaVersion(),
  ]);

  const pages = Number(pageCount) || 0;
  const size = Number(pageSize) || 0;

  return {
    health: {
      schemaVersion,
      pageCount: pages,
      pageSize: size,
      sizeBytes: pages * size,
      integrity: integrity || 'unknown',
      foreignKeysOk: foreignKeys === '1' || foreignKeys === 'on',
      walMode: journalMode.toLowerCase().includes('wal'),
    },
    counts: {
      notes: stats.notes,
      archived: stats.archived,
      trashed: stats.trashed,
      notebooks: notebooks?.count ?? 0,
      versions,
      media: media.count,
      mediaBytes: media.bytes,
    },
    events,
    generatedAt: new Date().toISOString(),
  };
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

export async function vacuumDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.run('VACUUM');
}

export async function checkpointWal(): Promise<void> {
  const db = await getDatabase();
  await db.run('PRAGMA wal_checkpoint(TRUNCATE)');
}

export async function clearDiagnosticsEvents(): Promise<void> {
  await clearEvents();
}

/** Human-readable report for sharing/support. */
export async function buildDiagnosticsText(): Promise<string> {
  const report = await runDiagnostics(30);
  const lines = [
    `${APP_CONFIG.name} ${APP_CONFIG.version} diagnostics`,
    `Generated: ${report.generatedAt}`,
    '',
    `Schema version: ${report.health.schemaVersion}`,
    `Database: ${formatBytes(report.health.sizeBytes)} · ${report.health.pageCount} pages × ${report.health.pageSize} B`,
    `Integrity: ${report.health.integrity} · WAL: ${report.health.walMode ? 'on' : 'off'} · Foreign keys: ${report.health.foreignKeysOk ? 'on' : 'off'}`,
    '',
    `Notes: ${report.counts.notes} active · ${report.counts.archived} archived · ${report.counts.trashed} trashed`,
    `Notebooks: ${report.counts.notebooks} · Versions: ${report.counts.versions}`,
    `Media: ${report.counts.media} files · ${formatBytes(report.counts.mediaBytes)}`,
    '',
    'Recent events:',
    ...report.events.map((event) => {
      const level = (event.level as EventLevel).toUpperCase().padEnd(5);
      return `${event.createdAt} ${level} [${event.scope}] ${event.message}`;
    }),
  ];
  return lines.join('\n');
}
