/** App-lock state (mirrors the persisted appLockEnabled setting). */
import { create } from 'zustand';

interface LockState {
  locked: boolean;
  failedAttempts: number;
  lock: () => void;
  unlock: () => void;
  registerFailure: () => void;
  resetFailures: () => void;
}

export const useLockStore = create<LockState>((set) => ({
  locked: false,
  failedAttempts: 0,
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false, failedAttempts: 0 }),
  registerFailure: () => set((state) => ({ failedAttempts: state.failedAttempts + 1 })),
  resetFailures: () => set({ failedAttempts: 0 }),
}));
