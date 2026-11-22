/**
 * Minimal Supabase (PostgREST) client for Notely sync.
 *
 * Only the four operations the sync engine needs are implemented, with explicit
 * headers and no SDK: `ping`, `upsertDocuments`, `pullDocuments` and
 * `deleteDocuments`. Errors are surfaced verbatim so the UI can explain what a
 * project is missing instead of failing silently.
 */
import { APP_CONFIG } from '@/config/app';
import { getSecret, setSecret, deleteSecret } from './secureStorage';
import { getSyncMeta, setSyncMeta, deleteSyncMeta } from '@/db/repositories/sync';

export const DOCUMENTS_TABLE = 'notely_documents';

const SECRET_KEY = 'notely.sync.anonKey';
const SECRET_TOKEN = 'notely.sync.token';

export interface SyncConfig {
  url: string;
  anonKey: string;
  /** Shared secret checked by the RLS policy (see supabase/schema.sql). */
  token: string;
  /** Logical workspace; several devices share one space id. */
  spaceId: string;
}

export interface RemoteDocument {
  space_id: string;
  doc_id: string;
  notebook_id: string;
  notebook_name: string | null;
  title: string;
  content_html: string;
  page_setup: string | null;
  card_color: string | null;
  is_favorite: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  device_id: string;
}

export class SupabaseError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'SupabaseError';
  }
}

function normaliseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function isSyncConfigured(config: SyncConfig | null): config is SyncConfig {
  return Boolean(config?.url && config.anonKey && config.token && config.spaceId);
}

/** Environment first (build-time), then whatever the user connected in Settings. */
export async function resolveSyncConfig(): Promise<SyncConfig | null> {
  const storedUrl = await getSyncMeta('url');
  const storedSpace = await getSyncMeta('space_id');
  const storedKey = await getSecret(SECRET_KEY).catch(() => null);
  const storedToken = await getSecret(SECRET_TOKEN).catch(() => null);

  const url = storedUrl ?? (APP_CONFIG.supabaseUrl || null);
  const spaceId = storedSpace ?? 'default';
  const anonKey = storedKey ?? (APP_CONFIG.supabaseAnonKey || null);
  const token = storedToken ?? (url && anonKey ? spaceId : null);

  if (!url || !anonKey || !token) return null;
  return { url: normaliseUrl(url), anonKey, token, spaceId };
}

export async function saveSyncConfig(config: SyncConfig): Promise<void> {
  const url = normaliseUrl(config.url);
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && !/^https?:\/\//i.test(url)) {
    throw new Error('Enter the full project URL, e.g. https://abcd.supabase.co');
  }
  if (!/^[a-z0-9-]{2,40}$/i.test(config.spaceId)) {
    throw new Error('Workspace id must be 2–40 letters, numbers or dashes.');
  }
  if (config.anonKey.length < 20) throw new Error('That anon key looks too short.');
  if (config.token.length < 8) throw new Error('Use a sync token of at least 8 characters.');
  await setSyncMeta('url', url);
  await setSyncMeta('space_id', config.spaceId);
  await setSecret(SECRET_KEY, config.anonKey);
  await setSecret(SECRET_TOKEN, config.token);
}

export async function clearSyncConfig(): Promise<void> {
  await deleteSyncMeta('url');
  await deleteSyncMeta('space_id');
  await deleteSyncMeta('last_pull_at');
  await deleteSyncMeta('last_sync_at');
  await deleteSyncMeta('last_result');
  await deleteSecret(SECRET_KEY);
  await deleteSecret(SECRET_TOKEN);
}

export interface SyncClient {
  config: SyncConfig;
  ping: () => Promise<void>;
  upsertDocuments: (rows: RemoteDocument[]) => Promise<void>;
  pullDocuments: (sinceIso: string | null, limit?: number) => Promise<RemoteDocument[]>;
  deleteDocuments: (docIds: string[]) => Promise<void>;
}

export function createSyncClient(config: SyncConfig, fetchImpl: typeof fetch = fetch): SyncClient {
  const base = `${normaliseUrl(config.url)}/rest/v1/${DOCUMENTS_TABLE}`;
  const headers: Record<string, string> = {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    'Content-Type': 'application/json',
    'x-sync-token': config.token,
  };

  async function request(path: string, init: RequestInit = {}): Promise<Response> {
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        ...init,
        headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
      });
    } catch (error) {
      throw new SupabaseError(
        `Network error: ${error instanceof Error ? error.message : 'could not reach Supabase'}`,
      );
    }
    if (!response.ok) {
      let detail = '';
      try {
        detail = (await response.text()).slice(0, 300);
      } catch {
        /* ignore */
      }
      const hint =
        response.status === 404
          ? ' Table "notely_documents" is missing — run supabase/schema.sql in the SQL editor.'
          : response.status === 401 || response.status === 403
            ? ' Check the anon key and the sync token in the RLS policy.'
            : '';
      throw new SupabaseError(`Supabase replied ${response.status}.${hint} ${detail}`.trim(), response.status);
    }
    return response;
  }

  return {
    config,
    async ping() {
      await request('?select=doc_id&limit=1');
    },
    async upsertDocuments(rows) {
      if (!rows.length) return;
      await request('?on_conflict=space_id,doc_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      });
    },
    async pullDocuments(sinceIso, limit = 200) {
      const params = new URLSearchParams({
        select: '*',
        space_id: `eq.${config.spaceId}`,
        order: 'updated_at.asc',
        limit: String(limit),
      });
      if (sinceIso) params.set('updated_at', `gt.${sinceIso}`);
      const response = await request(`?${params.toString()}`);
      const body = (await response.json()) as RemoteDocument[];
      return Array.isArray(body) ? body : [];
    },
    async deleteDocuments(docIds) {
      if (!docIds.length) return;
      const params = new URLSearchParams({
        space_id: `eq.${config.spaceId}`,
        doc_id: `in.(${docIds.join(',')})`,
      });
      await request(`?${params.toString()}`, { method: 'DELETE' });
    },
  };
}
