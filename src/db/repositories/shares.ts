/** Audit trail of exports/shares performed from the app. */
import { getDatabase } from '../index';
import { createId } from '@/utils/id';

export interface ShareRecord {
  id: string;
  documentId: string;
  format: string;
  target: string;
  createdAt: string;
}

export async function recordShare(input: {
  documentId: string;
  format: string;
  target: string;
}): Promise<ShareRecord> {
  const db = await getDatabase();
  const id = createId('shr');
  const now = new Date().toISOString();
  await db.run(
    'INSERT INTO document_shares (id, document_id, format, target, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, input.documentId, input.format, input.target, now],
  );
  return { id, documentId: input.documentId, format: input.format, target: input.target, createdAt: now };
}

export async function listShares(documentId: string): Promise<ShareRecord[]> {
  const db = await getDatabase();
  const rows = await db.all<{
    id: string;
    document_id: string;
    format: string;
    target: string;
    created_at: string;
  }>('SELECT * FROM document_shares WHERE document_id = ? ORDER BY created_at DESC', [documentId]);
  return rows.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    format: row.format,
    target: row.target,
    createdAt: row.created_at,
  }));
}
