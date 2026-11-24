/**
 * Hand-off store for the full-screen drawing editor.
 *
 * The drawing editor is its own route, so the finished drawing cannot be passed
 * back through component state. Publishing it here — keyed by note id — means
 * the note editor inserts it into the right document even if it re-renders or
 * remounts while the drawing screen is on top, and the payload is never lost on
 * navigation.
 */
import { create } from 'zustand';

export interface DrawingResult {
  noteId: string;
  dataUri: string;
  bytes: number;
  createdAt: number;
}

interface DrawingState {
  pending: DrawingResult | null;
  publish: (result: DrawingResult) => void;
  clear: (noteId: string) => void;
}

export const useDrawingStore = create<DrawingState>((set) => ({
  pending: null,
  publish: (result) => set({ pending: result }),
  clear: (noteId) =>
    set((state) => (state.pending && state.pending.noteId === noteId ? { pending: null } : state)),
}));
