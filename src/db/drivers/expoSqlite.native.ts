/**
 * Android/iOS driver backed by expo-sqlite.
 *
 * WAL journaling keeps autosave writes fast and crash-safe; foreign keys are
 * enforced so notebook/document relationships cannot be orphaned.
 */
import * as SQLite from 'expo-sqlite';
import type { SqlDatabase, SqlValue } from '../sql';

const DB_NAME = 'notely.db';

export async function openNativeDatabase(): Promise<SqlDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('PRAGMA synchronous = NORMAL;');

  let txDepth = 0;
  let txQueue: Promise<unknown> = Promise.resolve();

  const driver: SqlDatabase = {
    driver: 'expo-sqlite',

    async exec(sql: string) {
      await db.execAsync(sql);
    },

    async run(sql: string, params: SqlValue[] = []) {
      await db.runAsync(sql, params);
    },

    async all<T>(sql: string, params: SqlValue[] = []) {
      return (await db.getAllAsync(sql, params)) as T[];
    },

    async get<T>(sql: string, params: SqlValue[] = []) {
      const row = await db.getFirstAsync(sql, params);
      return (row as T | null) ?? null;
    },

    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      if (txDepth > 0) return fn();
      const execute = async (): Promise<T> => {
        txDepth += 1;
        await db.execAsync('BEGIN IMMEDIATE;');
        try {
          const result = await fn();
          await db.execAsync('COMMIT;');
          return result;
        } catch (error) {
          try {
            await db.execAsync('ROLLBACK;');
          } catch {
            /* original error wins */
          }
          throw error;
        } finally {
          txDepth -= 1;
        }
      };
      const next = txQueue.then(execute, execute);
      txQueue = next.catch(() => undefined);
      return next;
    },

    async flush() {
      // expo-sqlite writes through to disk; nothing buffered here.
    },

    async close() {
      await db.closeAsync();
    },
  };

  return driver;
}
