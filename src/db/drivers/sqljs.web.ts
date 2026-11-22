/**
 * Browser driver: real SQLite compiled to WebAssembly (`sql.js`).
 *
 * The engine script and wasm binary are served from /public (see
 * `scripts/vendor-web-assets.mjs`) and injected by `app/+html.tsx`. The
 * database file is persisted to IndexedDB (localStorage fallback) so the web
 * build keeps data across reloads exactly like the Android build.
 */
import { openSqlJsDatabase } from './sqljsCore';
import type { SqlDatabase } from '../sql';

declare global {
  interface Window {
    initSqlJs?: (config?: Record<string, unknown>) => Promise<unknown>;
  }
}

const IDB_NAME = 'notely-storage';
const IDB_STORE = 'kv';
const DB_KEY = 'notely-sqlite';
const LS_KEY = 'notely-sqlite-bytes';

function openIndexedDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function loadBytes(): Promise<Uint8Array | null> {
  const idb = await openIndexedDb();
  if (idb) {
    try {
      const value = await new Promise<unknown>((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readonly');
        const request = tx.objectStore(IDB_STORE).get(DB_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      if (value instanceof Uint8Array) return value;
      if (value instanceof ArrayBuffer) return new Uint8Array(value);
    } catch {
      /* fall through to localStorage */
    } finally {
      idb.close();
    }
  }
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function saveBytes(bytes: Uint8Array): Promise<void> {
  const idb = await openIndexedDb();
  if (idb) {
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(bytes, DB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      idb.close();
      return;
    } catch {
      idb.close();
    }
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  window.localStorage.setItem(LS_KEY, btoa(binary));
}

function waitForEngine(timeoutMs = 20000): Promise<(config?: Record<string, unknown>) => Promise<unknown>> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (window.initSqlJs) {
        resolve(window.initSqlJs);
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(
          new Error(
            'The SQLite WebAssembly engine could not be loaded. Run "npm run build:web" so /sql.js and /sql-wasm.wasm are served.',
          ),
        );
        return;
      }
      setTimeout(check, 50);
    };
    check();
  });
}

export async function openWebDatabase(): Promise<SqlDatabase> {
  const initSqlJs = await waitForEngine();
  const SQL = (await initSqlJs({ locateFile: (file: string) => `/${file}` })) as never;
  const db = await openSqlJsDatabase(SQL, {
    persistence: { load: loadBytes, save: saveBytes },
  });

  // Persist eagerly when the tab is hidden or closed so nothing is lost.
  if (typeof document !== 'undefined') {
    const flush = () => {
      void db.flush?.();
    };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  }

  return db;
}
