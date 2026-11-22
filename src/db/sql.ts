/**
 * Thin SQL surface shared by every driver.
 *
 * Both the Android driver (`expo-sqlite`) and the browser/test driver (`sql.js`)
 * implement this interface, which means the schema, migrations and repository
 * queries are literally the same SQL everywhere.
 */
export type SqlValue = string | number | null;

export interface SqlDatabase {
  /** Execute one or more statements without parameters (migrations, pragmas). */
  exec(sql: string): Promise<void>;
  /** Execute a single parameterised statement. */
  run(sql: string, params?: SqlValue[]): Promise<void>;
  /** Query rows as plain objects. */
  all<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  /** Query the first row or null. */
  get<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /** Run a callback atomically. Nested calls are flattened into the outer transaction. */
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
  readonly driver: 'expo-sqlite' | 'sql.js';
  /** Flush any pending persistence (browser driver persists to IndexedDB). */
  flush?(): Promise<void>;
  /** Raw SQLite file image — available on the sql.js driver (web + tests). */
  exportBytes?(): Promise<Uint8Array>;
}

export class SqlError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'SqlError';
  }
}
