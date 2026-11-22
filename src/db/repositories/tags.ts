/** Tags and the document↔tag join table. */
import { getDatabase } from '../index';
import { mapTag, type TagRow } from '../rows';
import type { Tag } from '@/types/models';
import type { AccentName } from '@/design/tokens';
import { createId } from '@/utils/id';
import { tagInputSchema, validationMessage } from '@/utils/validation';

export async function listTags(): Promise<Tag[]> {
  const db = await getDatabase();
  const rows = await db.all<TagRow>('SELECT * FROM tags ORDER BY name COLLATE NOCASE ASC');
  return rows.map(mapTag);
}

export async function createTag(name: string, color: AccentName = 'purple'): Promise<Tag> {
  const parsed = tagInputSchema.safeParse({ name, color });
  if (!parsed.success) throw new Error(validationMessage(parsed.error));
  const db = await getDatabase();
  const existing = await db.get<TagRow>('SELECT * FROM tags WHERE name = ? COLLATE NOCASE', [
    parsed.data.name,
  ]);
  if (existing) return mapTag(existing);
  const id = createId('tag');
  const now = new Date().toISOString();
  await db.run('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)', [
    id,
    parsed.data.name,
    parsed.data.color,
    now,
  ]);
  return { id, name: parsed.data.name, color: parsed.data.color, createdAt: now };
}

export async function deleteTag(id: string): Promise<void> {
  const db = await getDatabase();
  await db.run('DELETE FROM tags WHERE id = ?', [id]);
}

export async function addTagToDocument(documentId: string, name: string): Promise<Tag> {
  const tag = await createTag(name);
  const db = await getDatabase();
  await db.run('INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)', [
    documentId,
    tag.id,
  ]);
  return tag;
}

export async function removeTagFromDocument(documentId: string, tagId: string): Promise<void> {
  const db = await getDatabase();
  await db.run('DELETE FROM document_tags WHERE document_id = ? AND tag_id = ?', [documentId, tagId]);
}

export async function listDocumentTags(documentId: string): Promise<Tag[]> {
  const db = await getDatabase();
  const rows = await db.all<TagRow>(
    `SELECT t.* FROM tags t JOIN document_tags dt ON dt.tag_id = t.id
     WHERE dt.document_id = ? ORDER BY t.name COLLATE NOCASE ASC`,
    [documentId],
  );
  return rows.map(mapTag);
}
