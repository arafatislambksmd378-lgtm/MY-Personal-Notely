/** Document bookmarks (saved positions inside the document). */
import { getDatabase } from '../index';
import { mapBookmark, type BookmarkRow } from '../rows';
import type { Bookmark } from '@/types/models';
import { createId } from '@/utils/id';
import { bookmarkInputSchema, validationMessage } from '@/utils/validation';

export async function listBookmarks(documentId: string): Promise<Bookmark[]> {
  const db = await getDatabase();
  const rows = await db.all<BookmarkRow>(
    'SELECT * FROM bookmarks WHERE document_id = ? ORDER BY created_at DESC',
    [documentId],
  );
  return rows.map(mapBookmark);
}

export async function addBookmark(input: {
  documentId: string;
  label: string;
  anchor: string;
}): Promise<Bookmark> {
  const parsed = bookmarkInputSchema.safeParse(input);
  if (!parsed.success) throw new Error(validationMessage(parsed.error));
  const db = await getDatabase();
  const id = createId('bkm');
  const now = new Date().toISOString();
  await db.run('INSERT INTO bookmarks (id, document_id, label, anchor, created_at) VALUES (?, ?, ?, ?, ?)', [
    id,
    parsed.data.documentId,
    parsed.data.label,
    parsed.data.anchor,
    now,
  ]);
  return {
    id,
    documentId: parsed.data.documentId,
    label: parsed.data.label,
    anchor: parsed.data.anchor,
    createdAt: now,
  };
}

export async function deleteBookmark(id: string): Promise<void> {
  const db = await getDatabase();
  await db.run('DELETE FROM bookmarks WHERE id = ?', [id]);
}
