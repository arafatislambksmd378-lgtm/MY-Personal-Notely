/**
 * Root layout: fonts, database bootstrap, theme, app-lock gate and global
 * overlays. Nothing else renders until the local database is ready, so no
 * screen can ever read from an unopened database.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';

import { notelyFonts } from '@/design/fonts';
import { useColors, useSettingsStore } from '@/store/useSettingsStore';
import { getDatabase , flushDatabase } from '@/db';
import { logEvent } from '@/db/repositories/events';
import { useLibraryStore } from '@/store/useLibraryStore';
import { ToastHost } from '@/components/ToastHost';
import { LockScreen } from '@/features/security/LockScreen';
import { useLockStore } from '@/store/useLockStore';
import { StartupError } from '@/features/system/StartupError';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

type BootState = 'loading' | 'ready' | 'error';

export default function RootLayout() {
  const colors = useColors();
  const scheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts(notelyFonts);
  const [boot, setBoot] = useState<BootState>('loading');
  const [bootError, setBootError] = useState<string | null>(null);
  const loadSettings = useSettingsStore((state) => state.load);
  const settingsStatus = useSettingsStore((state) => state.status);
  const setSystemScheme = useSettingsStore((state) => state.setSystemScheme);
  const refreshLibrary = useLibraryStore((state) => state.refresh);
  const locked = useLockStore((state) => state.locked);
  const lock = useLockStore((state) => state.lock);
  const settings = useSettingsStore((state) => state.settings);

  const bootstrap = useCallback(async () => {
    setBoot('loading');
    setBootError(null);
    try {
      await getDatabase();
      await loadSettings();
      await refreshLibrary();
      const current = useSettingsStore.getState().settings;
      // A protected notebook always starts locked.
      if (current.appLockEnabled) lock();
      setBoot('ready');

      // Background sync is best-effort: it never delays the first paint and a
      // failure is recorded in Settings → Cloud sync instead of interrupting.
      if (current.cloudSyncEnabled) {
        void (async () => {
          const { syncNow } = await import('@/services/sync');
          const result = await syncNow();
          if (result.ok && (result.pulled > 0 || result.pushed > 0)) await refreshLibrary();
        })().catch(() => undefined);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBootError(message);
      setBoot('error');
      void logEvent('error', 'startup', 'Database bootstrap failed', { message });
    }
  }, [loadSettings, lock, refreshLibrary]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      setSystemScheme(media.matches ? 'dark' : 'light');
      const listener = (event: MediaQueryListEvent) => setSystemScheme(event.matches ? 'dark' : 'light');
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
    setSystemScheme(scheme === 'dark' ? 'dark' : 'light');
    return undefined;
  }, [scheme, setSystemScheme]);

  // Re-lock when the app leaves the foreground (privacy by default).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' && useSettingsStore.getState().settings.appLockEnabled) {
        lock();
      }
      if (state !== 'active') void flushDatabase();
    });
    return () => subscription.remove();
  }, [lock]);

  const ready = fontsLoaded && boot === 'ready' && settingsStatus === 'ready';

  useEffect(() => {
    if (ready || fontError || boot === 'error') {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [boot, fontError, ready]);

  const headerOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: colors.canvas },
      animation: 'slide_from_right' as const,
    }),
    [colors.canvas],
  );

  if (boot === 'error') {
    return (
      <SafeAreaProvider>
        <StartupError message={bootError ?? 'Unknown error'} onRetry={() => void bootstrap()} />
      </SafeAreaProvider>
    );
  }

  if (!ready) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <StatusBar style={settings.themeMode === 'dark' || (settings.themeMode === 'system' && scheme === 'dark') ? 'light' : 'dark'} />
        <View style={styles.flex}>
          <Stack screenOptions={headerOptions}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="note/[id]" />
            <Stack.Screen name="notebook/[id]" />
            <Stack.Screen name="search" />
            <Stack.Screen name="collection/[kind]" />
            <Stack.Screen name="templates" />
            <Stack.Screen name="settings/security" />
            <Stack.Screen name="settings/appearance" />
            <Stack.Screen name="settings/backup" />
            <Stack.Screen name="settings/tags" />
            <Stack.Screen name="settings/cloud" />
            <Stack.Screen name="settings/diagnostics" />
            <Stack.Screen name="settings/about" />
            <Stack.Screen name="+not-found" />
          </Stack>
          <ToastHost />
          {locked ? <LockScreen /> : null}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
