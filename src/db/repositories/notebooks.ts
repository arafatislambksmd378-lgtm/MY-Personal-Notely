/** Notebook persistence. All writes validate input and keep ordering stable. */
import { getDatabase } from '../index';
import { mapNotebook, mapNotebookWithCount, type NotebookRow } from '../rows';
import type { Notebook, NotebookWithCount } from '@/types/models';
import { notebookInputSchema, validationMessage } from '@/utils/validation';
import { createId } from '@/utils/id';
import type { AccentName } from '@/design/tokens';

const NOTE_COUNT_SQL = `
  SELECT nb.*,
    (SELECT COUNT(*) FROM documents d
      WHERE d.notebook_id = nb.id AND d.deleted_at IS NULL AND d.is_archived = 0) AS note_count
  FROM notebooks nb
  WHERE nb.deleted_at IS NULL
`;

export async function listNotebooks(): Promise<NotebookWithCount[]> {
  const db = await getDatabase();
  const rows = await db.all<NotebookRow>(`${NOTE_COUNT_SQL} ORDER BY nb.sort_order ASC, nb.created_at ASC`);
  return rows.map(mapNotebookWithCount);
}

export async function getNotebook(id: string): Promise<Notebook | null> {
  const db = await getDatabase();
  const row = await db.get<NotebookRow>(
    'SELECT * FROM notebooks WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  return row ? mapNotebook(row) : null;
}

export async function getNotebookWithCount(id: string): Promise<NotebookWithCount | null> {
  const db = await getDatabase();
  const row = await db.get<NotebookRow>(`${NOTE_COUNT_SQL} AND nb.id = ?`, [id]);
  return row ? mapNotebookWithCount(row) : null;
}

export async function getDefaultNotebook(): Promise<Notebook> {
  const db = await getDatabase();
  const row = await db.get<NotebookRow>(
    'SELECT * FROM notebooks WHERE deleted_at IS NULL ORDER BY is_default DESC, sort_order ASC, created_at ASC LIMIT 1',
  );
  if (row) return mapNotebook(row);
  return createNotebook({ name: 'Personal', color: 'purple', icon: 'book' });
}

export async function createNotebook(input: {
  name: string;
  color?: AccentName;
  icon?: string;
}): Promise<Notebook> {
  const parsed = notebookInputSchema.safeParse({
    name: input.name,
    color: input.color ?? 'purple',
    icon: input.icon ?? 'book',
  });
  if (!parsed.success) throw new Error(validationMessage(parsed.error));

  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = createId('nb');
  const orderRow = await db.get<{ next: number | null }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM notebooks',
  );
  const sortOrder = Number(orderRow?.next ?? 0);
  const countRow = await db.get<{ count: number | string }>('SELECT COUNT(*) AS count FROM notebooks');
  const isDefault = Number(countRow?.count ?? 0) === 0 ? 1 : 0;

  await db.run(
    `INSERT INTO notebooks (id, name, color, icon, sort_order, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, parsed.data.name, parsed.data.color, parsed.data.icon, sortOrder, isDefault, now, now],
  );

  return {
    id,
    name: parsed.data.name,
    color: parsed.data.color,
    icon: parsed.data.icon,
    sortOrder,
    isDefault: Boolean(isDefault),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export async function updateNotebook(
  id: string,
  patch: { name?: string; color?: AccentName; icon?: string },
): Promise<void> {
  const db = await getDatabase();
  const current = await getNotebook(id);
  if (!current) throw new Error('Notebook not found');
  const next = notebookInputSchema.safeParse({
    name: patch.name ?? current.name,
    color: patch.color ?? current.color,
    icon: patch.icon ?? current.icon,
  });
  if (!next.success) throw new Error(validationMessage(next.error));
  await db.run(
    'UPDATE notebooks SET name = ?, color = ?, icon = ?, updated_at = ? WHERE id = ?',
    [next.data.name, next.data.color, next.data.icon, new Date().toISOString(), id],
  );
}

/** Soft deletes a notebook and moves its notes to the fallback notebook. */
export async function deleteNotebook(id: string, fallbackNotebookId?: string): Promise<void> {
  const db = await getDatabase();
  const notebook = await getNotebook(id);
  if (!notebook) return;
  const target = fallbackNotebookId ?? (await getDefaultNotebook()).id;
  if (target === id) throw new Error('Choose a different notebook to keep your notes in.');
  const now = new Date().toISOString();

  await db.transaction(async () => {
    await db.run('UPDATE documents SET notebook_id = ?, updated_at = ? WHERE notebook_id = ?', [
      target,
      now,
      id,
    ]);
    await db.run('UPDATE notebooks SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);
  });
}

export async function reorderNotebooks(orderedIds: string[]): Promise<void> {
  const db = await getDatabase();
  await db.transaction(async () => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await db.run('UPDATE notebooks SET sort_order = ? WHERE id = ?', [index, orderedIds[index]]);
    }
  });
}

export async function countNotebooks(): Promise<number> {
  const db = await getDatabase();
  const row = await db.get<{ count: number | string }>(
    'SELECT COUNT(*) AS count FROM notebooks WHERE deleted_at IS NULL',
  );
  return Number(row?.count ?? 0);
}
