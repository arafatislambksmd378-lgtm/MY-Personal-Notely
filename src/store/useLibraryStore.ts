/**
 * Library state: notebooks, recent notes and aggregate stats.
 *
 * Screens read from here and call the repositories through these actions, so
 * every mutation keeps the visible lists in sync (no stale counts).
 */
import { create } from 'zustand';
import type { NotebookWithCount, DocumentRecord, DocumentSummary } from '@/types/models';
import type { AccentName } from '@/design/tokens';
import * as notebookRepo from '@/db/repositories/notebooks';
import * as documentRepo from '@/db/repositories/documents';
import { tagDocument } from '@/services/library';

interface LibraryState {
  notebooks: NotebookWithCount[];
  recent: DocumentSummary[];
  pinned: DocumentSummary[];
  stats: documentRepo.DocumentStats;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  refresh: () => Promise<void>;
  refreshNotebooks: () => Promise<void>;
  createNotebook: (input: { name: string; color?: AccentName; icon?: string }) => Promise<NotebookWithCount>;
  createNote: (input?: { notebookId?: string; title?: string; html?: string; cardColor?: AccentName }) => Promise<DocumentRecord>;
}

const emptyStats: documentRepo.DocumentStats = {
  total: 0,
  notes: 0,
  archived: 0,
  trashed: 0,
  favorites: 0,
  words: 0,
  notebooks: 0,
};

export const useLibraryStore = create<LibraryState>((set, get) => ({
  notebooks: [],
  recent: [],
  pinned: [],
  stats: emptyStats,
  status: 'idle',
  error: null,

  refresh: async () => {
    set({ status: get().status === 'ready' ? 'ready' : 'loading', error: null });
    try {
      const [notebooks, recent, pinned, stats] = await Promise.all([
        notebookRepo.listNotebooks(),
        documentRepo.getRecentDocuments(8),
        documentRepo.listDocumentSummaries({ pinned: true, limit: 4 }),
        documentRepo.getDocumentStats(),
      ]);
      set({ notebooks, recent, pinned, stats, status: 'ready' });
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Could not load library' });
    }
  },

  refreshNotebooks: async () => {
    const notebooks = await notebookRepo.listNotebooks();
    set({ notebooks, stats: await documentRepo.getDocumentStats() });
  },

  createNotebook: async (input) => {
    const created = await notebookRepo.createNotebook(input);
    const notebooks = await notebookRepo.listNotebooks();
    set({ notebooks });
    return notebooks.find((n) => n.id === created.id) ?? { ...created, noteCount: 0 };
  },

  createNote: async (input) => {
    const notebookId = input?.notebookId ?? get().notebooks[0]?.id;
    const doc = await documentRepo.createDocument({
      notebookId,
      title: input?.title ?? '',
      contentHtml: input?.html ?? '',
      cardColor: input?.cardColor ?? 'purple',
    });
    await get().refresh();
    return doc;
  },
}));

/** Convenience wrapper used by screens that tag and then refresh. */
export async function createTaggedNote(tag: string, notebookId?: string) {
  const doc = await useLibraryStore.getState().createNote({ notebookId });
  await tagDocument(doc.id, tag);
  await useLibraryStore.getState().refresh();
  return doc;
}
