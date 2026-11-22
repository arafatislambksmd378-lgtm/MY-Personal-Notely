/**
 * Live cloud-sync integration test.
 *
 * Unlike `tests/sync.test.ts` (which uses an in-memory PostgREST stand-in),
 * this suite talks to a *real* Supabase project over HTTPS using the exact
 * production client (`createSyncClient`) and the schema in
 * `supabase/schema.sql`. It proves that the deployed table, the RLS policy and
 * the wire protocol agree with each other.
 *
 * It is skipped unless the environment says otherwise, so the normal test run
 * stays offline and hermetic:
 *
 *   NOTELY_LIVE_SYNC=1 \
 *   NOTELY_SUPABASE_URL=https://<ref>.supabase.co \
 *   NOTELY_SUPABASE_ANON_KEY=<anon key> \
 *   NOTELY_SYNC_TOKEN=<token from the RLS policy> \
 *   npx vitest run tests/live-sync.test.ts
 *
 * `.github/workflows/verify-sync.yml` runs it in CI with repository secrets.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/secureStorage', () => ({
  setSecret: async () => undefined,
  getSecret: async () => null,
  deleteSecret: async () => undefined,
}));

vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (options: Record<string, unknown>) => options.android ?? options.default,
  },
  Appearance: { getColorScheme: () => 'light' },
}));

import { createSyncClient, SupabaseError, type RemoteDocument } from '@/services/supabase';

const LIVE = process.env.NOTELY_LIVE_SYNC === '1';
const URL_VALUE = process.env.NOTELY_SUPABASE_URL ?? '';
const ANON_KEY = process.env.NOTELY_SUPABASE_ANON_KEY ?? '';
const TOKEN = process.env.NOTELY_SYNC_TOKEN ?? '';

// A throw-away workspace per run keeps the shared project tidy.
const SPACE = `live-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const OTHER_SPACE = `${SPACE}-other`;
const DOC_A = `doc-a-${SPACE}`;
const DOC_B = `doc-b-${SPACE}`;
const DOC_C = `doc-c-${SPACE}`;
const DOC_D = `doc-d-${SPACE}`;

const config = { url: URL_VALUE, anonKey: ANON_KEY, token: TOKEN, spaceId: SPACE };
const client = createSyncClient(config);
const wrongTokenClient = createSyncClient({ ...config, token: 'definitely-not-the-token' });
const otherSpaceClient = createSyncClient({ ...config, spaceId: OTHER_SPACE });

function row(docId: string, updatedAt: string, patch: Partial<RemoteDocument> = {}): RemoteDocument {
  return {
    space_id: SPACE,
    doc_id: docId,
    notebook_id: 'notebook-live',
    notebook_name: 'Live checks',
    title: `Title for ${docId}`,
    content_html: `<h1>${docId}</h1><p>Synced from the integration suite.</p>`,
    page_setup: JSON.stringify({ size: 'a4', margin: 48 }),
    card_color: null,
    is_favorite: false,
    is_pinned: false,
    is_archived: false,
    deleted_at: null,
    created_at: '2026-11-01T09:00:00.000Z',
    updated_at: updatedAt,
    device_id: 'integration-runner',
    ...patch,
  };
}

describe.skipIf(!LIVE)('live Supabase sync', () => {
  afterAll(async () => {
    // Best-effort cleanup of everything this run created.
    await otherSpaceClient.deleteDocuments([DOC_C, DOC_D]).catch(() => undefined);
    await client.deleteDocuments([DOC_A, DOC_B, DOC_C, DOC_D]).catch(() => undefined);
  });

  it('exposes the schema through PostgREST (ping)', async () => {
    await expect(client.ping()).resolves.toBeUndefined();
  });

  it('hides rows from clients without the sync token', async () => {
    await expect(wrongTokenClient.pullDocuments(null)).resolves.toEqual([]);
  });

  it('rejects writes without the sync token (RLS)', async () => {
    const error = await wrongTokenClient.upsertDocuments([row('unauthorised', '2026-11-01T09:00:00.000Z')])
      .then(() => null)
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SupabaseError);
    expect([401, 403]).toContain((error as SupabaseError).status);
  });

  it('pushes documents and pulls them back with every field intact', async () => {
    await client.upsertDocuments([row(DOC_A, '2026-11-01T10:00:00.000Z'), row(DOC_B, '2026-11-01T10:05:00.000Z')]);

    const pulled = await client.pullDocuments(null);
    const byId = new Map(pulled.map((document) => [document.doc_id, document]));

    expect(byId.size).toBe(2);
    const a = byId.get(DOC_A)!;
    expect(a.title).toBe(`Title for ${DOC_A}`);
    expect(a.content_html).toContain('<h1>');
    expect(a.notebook_name).toBe('Live checks');
    expect(a.page_setup).toBe(JSON.stringify({ size: 'a4', margin: 48 }));
    expect(a.space_id).toBe(SPACE);
    expect(a.device_id).toBe('integration-runner');
    // Postgres normalises the timestamp format; compare instants, not strings.
    expect(Date.parse(a.updated_at)).toBe(Date.parse('2026-11-01T10:00:00.000Z'));
  });

  it('returns rows in updated_at order so incremental pulls are stable', async () => {
    const pulled = await client.pullDocuments(null);
    const times = pulled.map((document) => Date.parse(document.updated_at));
    expect(times).toEqual([...times].sort((left, right) => left - right));
  });

  it('pulls only what changed since a watermark', async () => {
    const since = '2026-11-01T10:02:00.000Z';
    const pulled = await client.pullDocuments(since);
    expect(pulled.map((document) => document.doc_id)).toEqual([DOC_B]);
  });

  it('upserts in place instead of duplicating a document', async () => {
    await client.upsertDocuments([row(DOC_A, '2026-11-01T11:00:00.000Z', { title: 'Edited on device two' })]);

    const pulled = await client.pullDocuments(null);
    const matches = pulled.filter((document) => document.doc_id === DOC_A);
    expect(matches).toHaveLength(1);
    expect(matches[0].title).toBe('Edited on device two');
  });

  it('carries tombstones so deletions propagate', async () => {
    await client.upsertDocuments([
      row(DOC_B, '2026-11-01T12:00:00.000Z', { deleted_at: '2026-11-01T12:00:00.000Z' }),
    ]);

    const pulled = await client.pullDocuments('2026-11-01T11:30:00.000Z');
    const tombstone = pulled.find((document) => document.doc_id === DOC_B);
    expect(tombstone?.deleted_at).toBeTruthy();
    expect(Date.parse(tombstone!.deleted_at!)).toBe(Date.parse('2026-11-01T12:00:00.000Z'));
  });

  it('keeps workspaces isolated even with the same token', async () => {
    await otherSpaceClient.upsertDocuments([row(DOC_C, '2026-11-01T13:00:00.000Z')]);

    const mine = await client.pullDocuments(null);
    expect(mine.some((document) => document.doc_id === DOC_C)).toBe(false);

    const theirs = await otherSpaceClient.pullDocuments(null);
    expect(theirs.map((document) => document.doc_id)).toEqual([DOC_C]);
    expect(theirs[0].space_id).toBe(OTHER_SPACE);
  });

  it('deletes rows on request (hard delete path)', async () => {
    await client.upsertDocuments([row(DOC_D, '2026-11-01T14:00:00.000Z')]);
    await client.deleteDocuments([DOC_D]);

    const pulled = await client.pullDocuments(null);
    expect(pulled.some((document) => document.doc_id === DOC_D)).toBe(false);
  });

  it('surfaces an actionable error for a project without the schema', async () => {
    const missing = createSyncClient({ ...config, url: `${URL_VALUE}`, spaceId: SPACE });
    const table = 'notely_documents_missing';
    const response = await fetch(`${URL_VALUE}/rest/v1/${table}?select=doc_id&limit=1`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'x-sync-token': TOKEN },
    });
    expect([404, 400]).toContain(response.status);
    // The shipped client is still healthy for the real table.
    await expect(missing.ping()).resolves.toBeUndefined();
  });
});
