/** Settings + resolved theme, loaded once at boot from the database. */
import { create } from 'zustand';
import { Appearance } from 'react-native';
import { defaultSettings, type UserSettings } from '@/types/models';
import { getSettings, updateSettings } from '@/db/repositories/settings';
import { accents, darkColors, lightColors, type AppColors } from '@/design/tokens';

interface SettingsState {
  settings: UserSettings;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  systemScheme: 'light' | 'dark';
  load: () => Promise<void>;
  patch: (patch: Partial<UserSettings>) => Promise<void>;
  setSystemScheme: (scheme: 'light' | 'dark') => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  status: 'idle',
  error: null,
  systemScheme: Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
  load: async () => {
    set({ status: 'loading', error: null });
    try {
      const settings = await getSettings();
      set({ settings, status: 'ready' });
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Settings could not be loaded',
      });
    }
  },
  patch: async (patch) => {
    const previous = get().settings;
    set({ settings: { ...previous, ...patch } });
    try {
      const saved = await updateSettings({ ...previous, ...patch });
      set({ settings: saved });
    } catch (error) {
      set({ settings: previous, error: error instanceof Error ? error.message : 'Could not save' });
      throw error;
    }
  },
  setSystemScheme: (scheme) => set({ systemScheme: scheme }),
  reset: () => set({ settings: defaultSettings, status: 'idle', error: null }),
}));

export function resolveScheme(
  mode: UserSettings['themeMode'],
  systemScheme: 'light' | 'dark',
): 'light' | 'dark' {
  if (mode === 'system') return systemScheme;
  return mode;
}

/** Resolved colour palette for the current theme + accent choice. */
export function useColors(): AppColors & { accent: string } {
  const settings = useSettingsStore((state) => state.settings);
  const systemScheme = useSettingsStore((state) => state.systemScheme);
  const scheme = resolveScheme(settings.themeMode, systemScheme);
  const base = scheme === 'dark' ? darkColors : lightColors;
  const accentHex = accents[settings.accent] ?? accents.purple;
  if (settings.accent === 'purple') return { ...base, accent: base.primary };
  return { ...base, accent: accentHex, primary: accentHex };
}
