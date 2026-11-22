/** Tiny global snackbar queue for non-blocking feedback. */
import { create } from 'zustand';

export type ToastTone = 'default' | 'success' | 'error';

interface ToastState {
  message: string | null;
  tone: ToastTone;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
}

let timeout: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  tone: 'default',
  show: (message, tone = 'default') => {
    if (timeout) clearTimeout(timeout);
    set({ message, tone });
    timeout = setTimeout(() => set({ message: null }), 2600);
  },
  hide: () => {
    if (timeout) clearTimeout(timeout);
    set({ message: null });
  },
}));

export const toast = {
  show: (message: string, tone: ToastTone = 'default') => useToastStore.getState().show(message, tone),
  success: (message: string) => useToastStore.getState().show(message, 'success'),
  error: (message: string) => useToastStore.getState().show(message, 'error'),
};
