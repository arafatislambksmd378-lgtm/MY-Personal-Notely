/** Media assets referenced by documents (images, drawings, charts, scans). */
import { getDatabase } from '../index';
import { mapMedia, type MediaRow } from '../rows';
import type { MediaAsset, MediaKind } from '@/types/models';
import { createId } from '@/utils/id';

export async function recordMediaAsset(input: {
  documentId: string;
  kind: MediaKind;
  uri: string;
  byteSize?: number;
}): Promise<MediaAsset> {
  const db = await getDatabase();
  const id = createId('med');
  const now = new Date().toISOString();
  const byteSize = Math.max(0, Math.floor(input.byteSize ?? input.uri.length));
  await db.run(
    'INSERT INTO media_assets (id, document_id, kind, uri, byte_size, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, input.documentId, input.kind, input.uri, byteSize, now],
  );
  return {
    id,
    documentId: input.documentId,
    kind: input.kind,
    uri: input.uri,
    byteSize,
    createdAt: now,
  };
}

export async function listMediaAssets(documentId: string): Promise<MediaAsset[]> {
  const db = await getDatabase();
  const rows = await db.all<MediaRow>('SELECT * FROM media_assets WHERE document_id = ?', [documentId]);
  return rows.map(mapMedia);
}

export async function totalMediaBytes(): Promise<number> {
  const db = await getDatabase();
  const row = await db.get<{ total: number | string | null }>(
    'SELECT SUM(byte_size) AS total FROM media_assets',
  );
  return Number(row?.total ?? 0);
}
