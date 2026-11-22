/**
 * Shared `sql.js` driver core.
 *
 * Used by the browser preview/development build (persisted to IndexedDB) and by
 * the Node test-suite (in-memory, or persisted to a byte buffer). Keeping the
 * SQL execution semantics here means the test suite exercises exactly the same
 * code path as the browser.
 */
import type { Database, SqlJsStatic } from 'sql.js';
import type { SqlDatabase, SqlValue } from '../sql';

export interface SqlJsPersistence {
  load(): Promise<Uint8Array | null>;
  save(bytes: Uint8Array): Promise<void>;
}

export interface SqlJsDriverOptions {
  persistence?: SqlJsPersistence;
  /** Debounce window for persisting to storage. */
  persistDebounceMs?: number;
}

type SqlJsModule = SqlJsStatic;

export function createSqlJsDriver(
  SQL: SqlJsModule,
  database: Database,
  options: SqlJsDriverOptions = {},
): SqlDatabase {
  const { persistence, persistDebounceMs = 350 } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let txDepth = 0;
  let txQueue: Promise<unknown> = Promise.resolve();

  function persistNow(): Promise<void> {
    if (!persistence || closed) return Promise.resolve();
    try {
      const bytes = database.export();
      return persistence.save(bytes);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function schedulePersist() {
    if (!persistence) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void persistNow().catch(() => {
        /* persistence failures surface through diagnostics, not the UI thread */
      });
    }, persistDebounceMs);
  }

  function runDirect(sql: string, params: SqlValue[] = []) {
    const statement = database.prepare(sql);
    try {
      statement.run(params.length ? params : undefined);
    } finally {
      statement.free();
    }
  }

  const driver: SqlDatabase = {
    driver: 'sql.js',

    async exec(sql: string) {
      database.exec(sql);
      if (txDepth === 0) schedulePersist();
    },

    async run(sql: string, params: SqlValue[] = []) {
      runDirect(sql, params);
      if (txDepth === 0) schedulePersist();
    },

    async all<T>(sql: string, params: SqlValue[] = []) {
      const statement = database.prepare(sql);
      const rows: T[] = [];
      try {
        if (params.length) statement.bind(params);
        while (statement.step()) {
          rows.push(statement.getAsObject() as T);
        }
      } finally {
        statement.free();
      }
      return rows;
    },

    async get<T>(sql: string, params: SqlValue[] = []) {
      const rows = await driver.all<T>(sql, params);
      return rows[0] ?? null;
    },

    async transaction<T>(fn: () => Promise<T>): Promise<T> {
      if (txDepth > 0) return fn();
      const execute = async (): Promise<T> => {
        txDepth += 1;
        database.run('BEGIN IMMEDIATE');
        try {
          const result = await fn();
          database.run('COMMIT');
          return result;
        } catch (error) {
          try {
            database.run('ROLLBACK');
          } catch {
            /* ignore rollback failure — original error is more useful */
          }
          throw error;
        } finally {
          txDepth -= 1;
          if (txDepth === 0) schedulePersist();
        }
      };
      const next = txQueue.then(execute, execute);
      txQueue = next.catch(() => undefined);
      return next;
    },

    async exportBytes() {
      return database.export();
    },

    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await persistNow();
    },

    async close() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await persistNow().catch(() => undefined);
      closed = true;
      database.close();
    },
  };

  return driver;
}

/** Opens (or creates) a sql.js database, restoring persisted bytes when present. */
export async function openSqlJsDatabase(
  SQL: SqlJsModule,
  options: SqlJsDriverOptions = {},
): Promise<SqlDatabase> {
  let bytes: Uint8Array | null = null;
  if (options.persistence) {
    try {
      bytes = await options.persistence.load();
    } catch {
      bytes = null;
    }
  }
  let database: Database;
  if (bytes && bytes.length) {
    try {
      database = new SQL.Database(bytes);
      // Validate the restored file before trusting it.
      database.exec('SELECT count(*) FROM sqlite_master;');
    } catch {
      database = new SQL.Database();
    }
  } else {
    database = new SQL.Database();
  }
  database.run('PRAGMA foreign_keys = ON;');
  return createSqlJsDriver(SQL, database, options);
}
