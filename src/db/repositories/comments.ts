/** Comments attached to a document (optionally quoting selected text). */
import { getDatabase } from '../index';
import { mapComment, type CommentRow } from '../rows';
import type { DocComment } from '@/types/models';
import { createId } from '@/utils/id';
import { commentInputSchema, validationMessage } from '@/utils/validation';

export async function listComments(documentId: string): Promise<DocComment[]> {
  const db = await getDatabase();
  const rows = await db.all<CommentRow>(
    'SELECT * FROM comments WHERE document_id = ? ORDER BY created_at DESC',
    [documentId],
  );
  return rows.map(mapComment);
}

export async function addComment(input: {
  documentId: string;
  body: string;
  quote?: string | null;
  author?: string;
}): Promise<DocComment> {
  const parsed = commentInputSchema.safeParse({
    documentId: input.documentId,
    body: input.body,
    quote: input.quote ?? null,
    author: input.author ?? 'You',
  });
  if (!parsed.success) throw new Error(validationMessage(parsed.error));
  const db = await getDatabase();
  const id = createId('cmt');
  const now = new Date().toISOString();
  await db.run(
    'INSERT INTO comments (id, document_id, author, body, quote, is_resolved, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
    [id, parsed.data.documentId, parsed.data.author, parsed.data.body, parsed.data.quote, now],
  );
  return {
    id,
    documentId: parsed.data.documentId,
    author: parsed.data.author,
    body: parsed.data.body,
    quote: parsed.data.quote,
    isResolved: false,
    createdAt: now,
  };
}

export async function toggleCommentResolved(id: string): Promise<void> {
  const db = await getDatabase();
  await db.run('UPDATE comments SET is_resolved = CASE is_resolved WHEN 0 THEN 1 ELSE 0 END WHERE id = ?', [
    id,
  ]);
}

export async function deleteComment(id: string): Promise<void> {
  const db = await getDatabase();
  await db.run('DELETE FROM comments WHERE id = ?', [id]);
}

export async function countComments(documentId: string): Promise<number> {
  const db = await getDatabase();
  const row = await db.get<{ count: number | string }>(
    'SELECT COUNT(*) AS count FROM comments WHERE document_id = ? AND is_resolved = 0',
    [documentId],
  );
  return Number(row?.count ?? 0);
}
