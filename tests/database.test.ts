import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './helpers/testDb';
import { runMigrations, currentSchemaVersion } from '@/db/migrate';
import { migrations } from '@/db/migrations';
import { seedIfEmpty } from '@/db/seed';
import { getDatabase } from '@/db';

let ctx: TestDatabase;

beforeEach(async () => {
  ctx = await createTestDatabase();
});

afterEach(async () => {
  await ctx.close();
});

describe('migrations', () => {
  it('applies the full migration chain and records versions', async () => {
    const version = await currentSchemaVersion(ctx.db);
    expect(version).toBe(Math.max(...migrations.map((m) => m.version)));
    const rows = await ctx.db.all<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version');
    expect(rows.map((r) => Number(r.version))).toEqual(migrations.map((m) => m.version));
  });

  it('is idempotent (re-running applies nothing)', async () => {
    const again = await runMigrations(ctx.db);
    expect(again.applied).toHaveLength(0);
  });

  it('creates every required table', async () => {
    const rows = await ctx.db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const names = rows.map((r) => r.name);
    for (const table of [
      'notebooks',
      'documents',
      'document_versions',
      'tags',
      'document_tags',
      'comments',
      'bookmarks',
      'media_assets',
      'document_shares',
      'user_settings',
      'sync_queue',
      'app_events',
    ]) {
      expect(names).toContain(table);
    }
  });

  it('enforces foreign keys', async () => {
    await expect(
      ctx.db.run(
        'INSERT INTO documents (id, notebook_id, title, content_html, plain_text, excerpt, card_color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['d1', 'missing-notebook', 't', '', '', '', 'purple', 'now', 'now'],
      ),
    ).rejects.toBeTruthy();
  });
});

describe('seeding', () => {
  it('creates the reference notebook set exactly once', async () => {
    const seeded = await seedIfEmpty(ctx.db);
    expect(seeded).toBe(true);
    const notebooks = await ctx.db.all<{ name: string }>('SELECT name FROM notebooks ORDER BY sort_order');
    expect(notebooks.map((n) => n.name)).toEqual(['Personal', 'Work', 'Ideas', 'Study']);
    const docs = await ctx.db.all<{ count: number }>('SELECT COUNT(*) AS count FROM documents');
    expect(Number(docs[0].count)).toBe(6);

    const again = await seedIfEmpty(ctx.db);
    expect(again).toBe(false);
    const docsAfter = await ctx.db.all<{ count: number }>('SELECT COUNT(*) AS count FROM documents');
    expect(Number(docsAfter[0].count)).toBe(6);
  });

  it('does not re-seed after the user deletes everything', async () => {
    await seedIfEmpty(ctx.db);
    await ctx.db.run('DELETE FROM documents');
    await ctx.db.run('UPDATE user_settings SET value = ? WHERE key = ?', ['1', 'seed.version']);
    const seeded = await seedIfEmpty(ctx.db);
    expect(seeded).toBe(false);
  });

  it('exposes the singleton database to repositories', async () => {
    const db = await getDatabase();
    const rows = await db.all('SELECT 1 AS ok');
    expect(rows[0]).toMatchObject({ ok: 1 });
  });
});
