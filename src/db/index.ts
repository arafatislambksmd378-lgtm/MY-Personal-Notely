/**
 * Database singleton.
 *
 * Opening the database, running migrations and seeding are all idempotent and
 * happen exactly once per app process. Every repository awaits `getDatabase()`.
 */
import { openPlatformDatabase } from './platformStore';
import { runMigrations, currentSchemaVersion } from './migrate';
import { seedIfEmpty } from './seed';
import type { SqlDatabase } from './sql';

export type { SqlDatabase, SqlValue } from './sql';

let databasePromise: Promise<SqlDatabase> | null = null;
let schemaVersion = 0;

async function initialise(): Promise<SqlDatabase> {
  const db = await openPlatformDatabase();
  const result = await runMigrations(db);
  schemaVersion = result.version;
  await seedIfEmpty(db);
  return db;
}

export function getDatabase(): Promise<SqlDatabase> {
  if (!databasePromise) {
    databasePromise = initialise().catch((error) => {
      // Reset so a retry (e.g. after the engine script loads late) is possible.
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export async function getSchemaVersion(): Promise<number> {
  if (schemaVersion) return schemaVersion;
  const db = await getDatabase();
  schemaVersion = await currentSchemaVersion(db);
  return schemaVersion;
}

export async function closeDatabase(): Promise<void> {
  if (!databasePromise) return;
  const db = await databasePromise.catch(() => null);
  if (db) await db.close();
  databasePromise = null;
  schemaVersion = 0;
}

export async function flushDatabase(): Promise<void> {
  if (!databasePromise) return;
  const db = await databasePromise;
  await db.flush?.();
}

/** Test helper: inject an already-open database (vitest). */
export function __setDatabaseForTests(db: SqlDatabase | null): void {
  databasePromise = db ? Promise.resolve(db) : null;
  schemaVersion = 0;
}
