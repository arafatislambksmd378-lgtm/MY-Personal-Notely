import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './helpers/testDb';
import { seedIfEmpty } from '@/db/seed';
import { createBackup, restoreBackup, createBackupArchive, restoreFromArchive, BACKUP_VERSION } from '@/services/backup';
import * as documents from '@/db/repositories/documents';
import * as notebooks from '@/db/repositories/notebooks';
import { getSettings } from '@/db/repositories/settings';

let ctx: TestDatabase;

beforeEach(async () => {
  ctx = await createTestDatabase();
  await seedIfEmpty(ctx.db);
});

afterEach(async () => {
  await ctx.close();
});

describe('backup & restore', () => {
  it('exports every entity with the expected counts', async () => {
    const { json, counts } = await createBackup();
    const payload = JSON.parse(json);
    expect(payload.format).toBe('notely-backup');
    expect(payload.version).toBe(BACKUP_VERSION);
    expect(counts.notebooks).toBe(4);
    expect(counts.documents).toBe(6);
    expect(payload.settings.userName).toBe('Writer');
  });

  it('never exports PIN material', async () => {
    const { json } = await createBackup();
    // PIN hashes live in secure storage, never in the database or a backup.
    expect(json).not.toContain('pinHash');
    expect(json).not.toContain('pinSalt');
    const payload = JSON.parse(json);
    expect(payload.settings.pinHash).toBeUndefined();
    expect(payload.settings.pinSalt).toBeUndefined();
  });

  it('restores into an empty database (replace mode)', async () => {
    await documents.saveDocumentContent(
      (await documents.getRecentDocuments(1))[0].id,
      { html: '<p>Edited before backup</p>' },
    );
    const { json } = await createBackup();
    const expected = await documents.getDocumentStats();
    const expectedNotebooks = await notebooks.countNotebooks();

    // Fresh database, then restore.
    const fresh = await createTestDatabase();
    try {
      const result = await restoreBackup(json, { mode: 'replace' });
      expect(result.documents).toBe(expected.notes + expected.archived + expected.trashed);
      const stats = await documents.getDocumentStats();
      expect(stats.notes).toBe(expected.notes);
      expect(stats.notebooks).toBe(expectedNotebooks);
      const restored = await documents.getRecentDocuments(20);
      expect(restored.some((note) => note.title === 'Welcome to Notely')).toBe(true);
      expect((await getSettings()).userName).toBe('Writer');
    } finally {
      await fresh.close();
    }
  });

  it('merges without duplicating existing rows', async () => {
    const { json } = await createBackup();
    const before = await documents.getDocumentStats();
    const result = await restoreBackup(json, { mode: 'merge' });
    expect(result.documents).toBe(0);
    expect(result.skipped).toBeGreaterThan(0);
    const after = await documents.getDocumentStats();
    expect(after.total).toBe(before.total);
  });

  it('rejects malformed backups without touching data', async () => {
    const before = await documents.getDocumentStats();
    await expect(restoreBackup('{"format":"something-else"}')).rejects.toThrow(/not valid/i);
    await expect(restoreBackup('not json at all')).rejects.toThrow(/invalid JSON/i);
    const after = await documents.getDocumentStats();
    expect(after.total).toBe(before.total);
  });

  it('round-trips through the .zip archive', async () => {
    const archive = await createBackupArchive();
    const fresh = await createTestDatabase();
    try {
      const restored = await restoreFromArchive(archive);
      expect(restored.notebooks).toBe(4);
      expect(restored.documents).toBe(6);
      expect((await documents.getDocumentStats()).notes).toBe(6);
    } finally {
      await fresh.close();
    }
  });

  it('rejects an archive without a backup file', async () => {
    await expect(restoreFromArchive(new Uint8Array([0, 1, 2, 3]))).rejects.toThrow();
  });
});
