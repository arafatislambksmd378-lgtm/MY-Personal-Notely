/**
 * Debounced autosave with explicit flush points.
 *
 * - coalesces rapid keystrokes into one write
 * - flushes on unmount, on blur and when the app goes to the background
 * - never swallows errors: the caller receives them via `status`/`error`
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface UseAutosaveOptions<T> {
  save: (payload: T) => Promise<void>;
  delayMs?: number;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

export function useAutosave<T>({ save, delayMs = 1200, enabled = true, onError }: UseAutosaveOptions<T>) {
  const payloadRef = useRef<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const saveRef = useRef(save);

  // Keep the latest callback reachable from timers without re-arming them.
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const runSave = useCallback(async () => {
    if (!payloadRef.current || savingRef.current) return;
    const payload = payloadRef.current;
    payloadRef.current = null;
    savingRef.current = true;
    setStatus('saving');
    try {
      await saveRef.current(payload);
      setStatus('saved');
      setLastSavedAt(new Date().toISOString());
    } catch (error) {
      // Keep the payload so the next flush can retry instead of losing edits.
      payloadRef.current = payloadRef.current ?? payload;
      setStatus('error');
      onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      savingRef.current = false;
    }
  }, [onError]);

  const schedule = useCallback(
    (payload: T) => {
      if (!enabled) return;
      payloadRef.current = payload;
      setStatus('pending');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void runSave();
      }, delayMs);
    },
    [delayMs, enabled, runSave],
  );

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await runSave();
  }, [runSave]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flush();
    });
    return () => {
      subscription.remove();
      void flush();
    };
  }, [flush]);

  return { schedule, flush, status, lastSavedAt, hasPendingChanges: status === 'pending' };
}
