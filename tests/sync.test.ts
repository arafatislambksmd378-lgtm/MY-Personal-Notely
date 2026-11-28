import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestDatabase, type TestDatabase } from './helpers/testDb';
import { seedIfEmpty } from '@/db/seed';
import { getDocument, listDocuments, saveDocumentContent } from '@/db/repositories/documents';
import { countVersions, listVersions } from '@/db/repositories/versions';
import { getSyncMeta, getSyncDocument, setSyncMeta } from '@/db/repositories/sync';
import { syncNow, pushPending, pullRemote, getSyncStatus } from '@/services/sync';
import {
  createSyncClient,
  isSyncConfigured,
  resolveSyncConfig,
  saveSyncConfig,
  SupabaseError,
  type RemoteDocument,
  type SyncClient,
  type SyncConfig,
} from '@/services/supabase';

const secrets = new Map<string, string>();

vi.mock('@/services/secureStorage', () => ({
  setSecret: async (key: string, value: string) => void secrets.set(key, value),
  getSecret: async (key: string) => secrets.get(key) ?? null,
  deleteSecret: async (key: string) => void secrets.delete(key),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
  Appearance: { getColorScheme: () => 'light' },
}));

let ctx: TestDatabase;

const CONFIG: SyncConfig = {
  url: 'https://demo-project.supabase.co',
  anonKey: 'anon-key-value-that-is-long-enough',
  token: 'a-long-random-token',
  spaceId: 'studio',
};

/** In-memory stand-in for PostgREST, sharing the same contract as the client. */
function fakeClient(config: SyncConfig = CONFIG) {
  const remote = new Map<string, RemoteDocument>();
  const upsertCalls: RemoteDocument[][] = [];
  const client: SyncClient & { remote: Map<string, RemoteDocument>; upsertCalls: RemoteDocument[][] } = {
    config,
    remote,
    upsertCalls,
    ping: async () => undefined,
    upsertDocuments: async (rows) => {
      upsertCalls.push(rows);
      for (const row of rows) remote.set(row.doc_id, { ...row });
    },
    pullDocuments: async (since, limit = 200) => {
      const rows = [...remote.values()]
        .filter((row) => !since || row.updated_at > since)
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
      return rows.slice(0, limit);
    },
    deleteDocuments: async (ids) => {
      for (const id of ids) remote.delete(id);
    },
  };
  return client;
}

function remoteDoc(overrides: Partial<RemoteDocument> = {}): RemoteDocument {
  return {
    space_id: CONFIG.spaceId,
    doc_id: 'remote_doc_1',
    notebook_id: 'nb_remote',
    notebook_name: 'From the laptop',
    title: 'Written elsewhere',
    content_html: '<p>Remote body</p>',
    page_setup: '{}',
    card_color: 'blue',
    is_favorite: false,
    is_pinned: false,
    is_archived: false,
    deleted_at: null,
    created_at: '2026-02-01T09:00:00.000Z',
    updated_at: '2026-02-01T09:05:00.000Z',
    device_id: 'dev_laptop',
    ...overrides,
  };
}

beforeEach(async () => {
  secrets.clear();
  ctx = await createTestDatabase();
  await seedIfEmpty(ctx.db);
});

afterEach(async () => {
  await ctx.close();
});

describe('sync configuration', () => {
  it('starts unconfigured and explains why', async () => {
    expect(await resolveSyncConfig()).toBeNull();
    const status = await getSyncStatus();
    expect(status.connected).toBe(false);
    const result = await syncNow();
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not connected/i);
  });

  it('validates and persists a project configuration', async () => {
    await expect(saveSyncConfig({ ...CONFIG, url: 'not a url' })).rejects.toThrow(/project URL/i);
    await expect(saveSyncConfig({ ...CONFIG, spaceId: 'x' })).rejects.toThrow(/Workspace id/i);
    await expect(saveSyncConfig({ ...CONFIG, token: 'short' })).rejects.toThrow(/sync token/i);

    await saveSyncConfig(CONFIG);
    const resolved = await resolveSyncConfig();
    expect(resolved).toEqual(CONFIG);
    expect(isSyncConfigured(resolved)).toBe(true);
    // The anon key and token are secrets, the URL and space id are plain meta.
    expect(await getSyncMeta('url')).toBe(CONFIG.url);
    expect(secrets.get('notely.sync.anonKey')).toBe(CONFIG.anonKey);
  });
});

describe('Supabase client', () => {
  function mockFetch(response: { ok?: boolean; status?: number; payload?: unknown }) {
    const calls: { url: string; init: RequestInit }[] = [];
    const impl = (async (url: string, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      return {
        ok: response.ok ?? true,
        status: response.status ?? 200,
        json: async () => response.payload ?? [],
        text: async () => JSON.stringify(response.payload ?? ''),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    return { impl, calls };
  }

  it('upserts with on_conflict, auth headers and merge duplicates', async () => {
    const { impl, calls } = mockFetch({});
    const client = createSyncClient(CONFIG, impl);
    await client.upsertDocuments([remoteDoc()]);
    const call = calls[0];
    expect(call.url).toBe('https://demo-project.supabase.co/rest/v1/notely_documents?on_conflict=space_id,doc_id');
    expect(call.init.method).toBe('POST');
    const headers = call.init.headers as Record<string, string>;
    expect(headers.apikey).toBe(CONFIG.anonKey);
    expect(headers['x-sync-token']).toBe(CONFIG.token);
    expect(headers.Prefer).toContain('merge-duplicates');
    expect(JSON.parse(String(call.init.body))[0].doc_id).toBe('remote_doc_1');
  });

  it('pulls with a space filter and an updated_at watermark', async () => {
    const { impl, calls } = mockFetch({ payload: [remoteDoc()] });
    const client = createSyncClient(CONFIG, impl);
    const rows = await client.pullDocuments('2026-01-01T00:00:00.000Z', 25);
    expect(rows).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.searchParams.get('space_id')).toBe('eq.studio');
    expect(url.searchParams.get('updated_at')).toBe('gt.2026-01-01T00:00:00.000Z');
    expect(url.searchParams.get('limit')).toBe('25');
    expect(url.searchParams.get('order')).toBe('updated_at.asc');
  });

  it('turns HTTP failures into actionable errors', async () => {
    const missing = mockFetch({ ok: false, status: 404, payload: { message: 'relation does not exist' } });
    await expect(createSyncClient(CONFIG, missing.impl).ping()).rejects.toThrow(/schema\.sql/i);

    const denied = mockFetch({ ok: false, status: 401, payload: { message: 'JWT' } });
    await expect(createSyncClient(CONFIG, denied.impl).ping()).rejects.toThrow(/anon key/i);

    const offline = (async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    }) as unknown as typeof fetch;
    await expect(createSyncClient(CONFIG, offline).ping()).rejects.toBeInstanceOf(SupabaseError);
  });
});

describe('sync engine', () => {
  it('pushes every local note once, then nothing', async () => {
    const client = fakeClient();
    const first = await syncNow({ client });
    expect(first.ok).toBe(true);
    expect(first.pushed).toBe(6);
    expect(client.upsertCalls[0]).toHaveLength(6);
    expect(client.upsertCalls[0][0].space_id).toBe('studio');

    const second = await syncNow({ client });
    expect(second.pushed).toBe(0);
  });

  it('pushes only what changed locally', async () => {
    const client = fakeClient();
    await syncNow({ client });
    const docs = await listDocuments({ limit: 10 });
    const target = docs.find((doc) => !doc.deletedAt) ?? docs[0];
    await saveDocumentContent(target.id, { html: '<p>Edited after sync</p>', title: 'Edited' });

    const pending = await getSyncDocument(target.id);
    expect(pending?.syncState).toBe('pending');

    const result = await syncNow({ client });
    expect(result.pushed).toBe(1);
    expect(client.remote.get(target.id)?.content_html).toContain('Edited after sync');
    expect((await getSyncDocument(target.id))?.syncState).toBe('synced');
  });

  it('applies newer remote notes and records the watermark', async () => {
    const client = fakeClient();
    client.remote.set('remote_doc_1', remoteDoc());

    const first = await syncNow({ client });
    expect(first.pulled).toBe(1);
    expect(first.updated).toBe(1);
    const imported = await getDocument('remote_doc_1');
    expect(imported?.title).toBe('Written elsewhere');
    expect(imported?.contentHtml).toBe('<p>Remote body</p>');
    // The watermark moves past both the pulled row and the rows we pushed.
    const watermark = await getSyncMeta('last_pull_at');
    expect(watermark).toBeTruthy();
    expect(watermark! >= '2026-02-01T09:05:00.000Z').toBe(true);

    const second = await syncNow({ client });
    expect(second.pulled).toBe(0);
  });

  it('resolves conflicts last-write-wins and keeps the local draft in history', async () => {
    const client = fakeClient();
    await syncNow({ client });

    const docs = await listDocuments({ limit: 10 });
    const target = docs[0];
    const versionsBefore = await countVersions(target.id);
    // Local draft that was never pushed…
    await saveDocumentContent(target.id, { html: '<p>Local draft</p>', title: 'Draft' });
    // …and a newer remote edit to the same note.
    client.remote.set(
      target.id,
      remoteDoc({
        doc_id: target.id,
        notebook_id: target.notebookId,
        title: 'Remote wins',
        content_html: '<p>Remote edited</p>',
        updated_at: new Date(Date.now() + 60_000).toISOString(),
      }),
    );

    const result = await syncNow({ client });
    expect(result.conflicts).toBe(1);
    const after = await getDocument(target.id);
    expect(after?.title).toBe('Remote wins');
    expect(after?.contentHtml).toBe('<p>Remote edited</p>');
    // The overwritten local draft is preserved as a version snapshot.
    expect(await countVersions(target.id)).toBeGreaterThan(versionsBefore);
    const versions = await listVersions(target.id);
    expect(versions.some((version) => version.contentHtml.includes('Local draft'))).toBe(true);
  });

  it('creates a notebook for notes from an unknown space', async () => {
    const client = fakeClient();
    client.remote.set('remote_doc_2', remoteDoc({ doc_id: 'remote_doc_2', notebook_id: 'nb_unknown', notebook_name: 'Shared' }));
    await syncNow({ client });
    const imported = await getDocument('remote_doc_2');
    expect(imported?.notebookId).toBe('nb_unknown');
    const notebook = await ctx.db.get<{ name: string }>('SELECT name FROM notebooks WHERE id = ?', ['nb_unknown']);
    expect(notebook?.name).toBe('Shared');
  });

  it('moves remote tombstones into the trash instead of resurrecting notes', async () => {
    const client = fakeClient();
    await syncNow({ client });
    const docs = await listDocuments({ limit: 10 });
    const target = docs.find((doc) => !doc.deletedAt) ?? docs[0];
    client.remote.set(
      target.id,
      remoteDoc({
        doc_id: target.id,
        notebook_id: target.notebookId,
        title: target.title,
        deleted_at: new Date().toISOString(),
        updated_at: new Date(Date.now() + 30_000).toISOString(),
      }),
    );

    const result = await syncNow({ client });
    expect(result.updated).toBe(1);
    expect((await getDocument(target.id))?.deletedAt).toBeTruthy();
  });

  it('reports failures without destroying data', async () => {
    const client = fakeClient();
    client.pullDocuments = async () => {
      throw new SupabaseError('Supabase replied 500.');
    };
    const before = await listDocuments({ limit: 50 });
    const result = await syncNow({ client });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('500');
    const after = await listDocuments({ limit: 50 });
    expect(after.length).toBe(before.length);
    const stored = await getSyncMeta('last_result');
    expect(stored).toContain('Supabase replied 500');
  });

  it('can pull without pushing', async () => {
    const client = fakeClient();
    client.remote.set('remote_doc_3', remoteDoc({ doc_id: 'remote_doc_3' }));
    const result = await syncNow({ client, pullOnly: true });
    expect(result.pushed).toBe(0);
    expect(result.pulled).toBe(1);
  });

  it('pushPending batches and pullRemote is idempotent', async () => {
    const client = fakeClient();
    expect((await pushPending(client)).count).toBe(6);
    const first = await pullRemote(client, null);
    const second = await pullRemote(client, first.watermark);
    expect(first.pulled).toBe(6);
    expect(second.pulled).toBe(0);
  });
});

describe('sync state persists in SQLite', () => {
  it('stores sync metadata across calls', async () => {
    await setSyncMeta('last_sync_at', '2026-03-01T00:00:00.000Z');
    expect(await getSyncMeta('last_sync_at')).toBe('2026-03-01T00:00:00.000Z');
    await setSyncMeta('last_sync_at', '2026-03-02T00:00:00.000Z');
    expect(await getSyncMeta('last_sync_at')).toBe('2026-03-02T00:00:00.000Z');
  });
});
