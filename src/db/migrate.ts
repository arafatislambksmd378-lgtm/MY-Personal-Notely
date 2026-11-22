/** Forward-only migration runner shared by native, web and the test-suite. */
import { migrations, type Migration } from './migrations';
import type { SqlDatabase } from './sql';

export interface MigrationResult {
  applied: Migration[];
  version: number;
}

export async function runMigrations(db: SqlDatabase): Promise<MigrationResult> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const rows = await db.all<{ version: number | string }>('SELECT version FROM schema_migrations');
  const appliedVersions = new Set(rows.map((row) => Number(row.version)));
  const ordered = [...migrations].sort((a, b) => a.version - b.version);
  const applied: Migration[] = [];

  for (const migration of ordered) {
    if (appliedVersions.has(migration.version)) continue;
    try {
      await db.transaction(async () => {
        await db.exec(migration.up);
        await db.run(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
          [migration.version, migration.name, new Date().toISOString()],
        );
      });
      applied.push(migration);
      appliedVersions.add(migration.version);
    } catch (error) {
      throw new Error(
        `Migration ${migration.version} (${migration.name}) failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  const version = appliedVersions.size ? Math.max(...appliedVersions) : 0;
  return { applied, version };
}

export async function currentSchemaVersion(db: SqlDatabase): Promise<number> {
  try {
    const row = await db.get<{ version: number | string | null }>(
      'SELECT MAX(version) AS version FROM schema_migrations',
    );
    return row?.version ? Number(row.version) : 0;
  } catch {
    return 0;
  }
}
