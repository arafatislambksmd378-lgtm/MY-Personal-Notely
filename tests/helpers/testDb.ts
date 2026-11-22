/**
 * Test harness: boots a real SQLite database with sql.js in Node, runs the
 * production migrations, and injects it into the app's singleton so repository
 * code under test is exactly the code that ships.
 */
import initSqlJs from 'sql.js';
import { openSqlJsDatabase } from '@/db/drivers/sqljsCore';
import { runMigrations } from '@/db/migrate';
import { __setDatabaseForTests, type SqlDatabase } from '@/db';

export interface TestDatabase {
  db: SqlDatabase;
  close: () => Promise<void>;
}

export async function createTestDatabase(options: { migrate?: boolean } = {}): Promise<TestDatabase> {
  const SQL = await initSqlJs();
  const db = await openSqlJsDatabase(SQL);
  if (options.migrate !== false) {
    await runMigrations(db);
  }
  __setDatabaseForTests(db);
  return {
    db,
    close: async () => {
      __setDatabaseForTests(null);
      await db.close();
    },
  };
}

/** Deterministic clock helper for autosave/version timing tests. */
export function atTime(iso: string): Date {
  return new Date(iso);
}
