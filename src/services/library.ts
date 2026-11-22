/**
 * Small cross-repository helpers used by screens. Keeping them here avoids
 * importing several repositories inside components.
 */
import { addTagToDocument, listTags } from '@/db/repositories/tags';
import { listDocumentSummaries } from '@/db/repositories/documents';
import type { Tag } from '@/types/models';

export async function tagDocument(documentId: string, tag: string): Promise<Tag> {
  return addTagToDocument(documentId, tag);
}

export async function allTags(): Promise<Tag[]> {
  return listTags();
}

export async function notesForNotebook(notebookId: string) {
  return listDocumentSummaries({ notebookId });
}
