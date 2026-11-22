/** Store-level smoke tests: the library and settings stores hydrate from SQLite. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The stores only need `Appearance` from React Native; the real entry point is
// Flow-typed and cannot be parsed by Node, so it is stubbed for this suite.
vi.mock('react-native', () => ({
  Appearance: { getColorScheme: () => 'light', addChangeListener: () => ({ remove: () => undefined }) },
  Platform: { OS: 'android', select: (options: Record<string, unknown>) => options.android ?? options.default },
}));
import { createTestDatabase, type TestDatabase } from './helpers/testDb';
import { seedIfEmpty } from '@/db/seed';
import { useLibraryStore } from '@/store/useLibraryStore';
import { useSettingsStore } from '@/store/useSettingsStore';

let ctx: TestDatabase;

beforeEach(async () => {
  ctx = await createTestDatabase();
  await seedIfEmpty(ctx.db);
});

afterEach(async () => {
  await ctx.close();
  useLibraryStore.setState({ notebooks: [], recent: [], pinned: [], stats: undefined as never, status: 'idle' });
});

describe('library store', () => {
  it('hydrates notebooks, recent notes, pinned notes and stats', async () => {
    await useLibraryStore.getState().refresh();
    const state = useLibraryStore.getState();
    expect(state.notebooks.length).toBe(4);
    expect(state.recent.length).toBeGreaterThan(0);
    expect(state.pinned.length).toBeGreaterThanOrEqual(1);
    expect(state.stats.notes).toBe(6);
    expect(state.notebooks[0].noteCount).toBeGreaterThanOrEqual(0);
  });

  it('creates a note and reflects it in the library', async () => {
    await useLibraryStore.getState().refresh();
    const before = useLibraryStore.getState().stats.notes;
    const doc = await useLibraryStore.getState().createNote({ title: 'Store note' });
    await useLibraryStore.getState().refresh();
    expect(doc.title).toBe('Store note');
    expect(useLibraryStore.getState().stats.notes).toBe(before + 1);
    expect(useLibraryStore.getState().recent.some((note) => note.id === doc.id)).toBe(true);
  });
});

describe('settings store', () => {
  it('loads persisted settings and patches them', async () => {
    useSettingsStore.setState({ status: 'idle' });
    await useSettingsStore.getState().load();
    expect(useSettingsStore.getState().settings.themeMode).toBe('light');
    await useSettingsStore.getState().patch({ themeMode: 'dark', accent: 'teal' });
    expect(useSettingsStore.getState().settings.themeMode).toBe('dark');
    expect(useSettingsStore.getState().settings.accent).toBe('teal');
  });

  it('resolves the colour scheme from theme mode', async () => {
    useSettingsStore.setState({ status: 'idle', systemScheme: 'light' });
    await useSettingsStore.getState().load();
    await useSettingsStore.getState().patch({ themeMode: 'dark' });
    expect(useSettingsStore.getState().settings.themeMode).toBe('dark');
    await useSettingsStore.getState().patch({ themeMode: 'system' });
    expect(useSettingsStore.getState().systemScheme).toBe('light');
  });
});
