/**
 * Cloud sync. Notely is offline-first: this screen reports the true state of
 * the optional Supabase backend and never pretends a sync happened.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { SectionHeader } from '@/components/SectionHeader';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { Button } from '@/components/Button';
import { useColors, useSettingsStore } from '@/store/useSettingsStore';
import { APP_CONFIG, isCloudConfigured } from '@/config/app';
import { toast } from '@/store/useToastStore';
import { logEvent } from '@/db/repositories/events';
import { spacing } from '@/design/tokens';

type CheckState = 'idle' | 'checking' | 'ok' | 'error';

export default function CloudSettings() {
  const colors = useColors();
  const settings = useSettingsStore((state) => state.settings);
  const patch = useSettingsStore((state) => state.patch);
  const [state, setState] = useState<CheckState>('idle');
  const [detail, setDetail] = useState<string | null>(null);

  const testConnection = useCallback(async () => {
    if (!isCloudConfigured) return;
    setState('checking');
    setDetail(null);
    try {
      const response = await fetch(`${APP_CONFIG.supabaseUrl.replace(/\/$/, '')}/rest/v1/`, {
        headers: {
          apikey: APP_CONFIG.supabaseAnonKey,
          Authorization: `Bearer ${APP_CONFIG.supabaseAnonKey}`,
        },
      });
      if (!response.ok) throw new Error(`Backend replied ${response.status}`);
      setState('ok');
      setDetail('Reachable with the configured anon key. Row-level security still decides what this device can read.');
      toast.success('Supabase is reachable');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      setState('error');
      setDetail(message);
      void logEvent('warn', 'cloud', 'Supabase check failed', { message });
      toast.error(message);
    }
  }, []);

  const copyEnv = useCallback(async () => {
    await Clipboard.setStringAsync(
      `EXPO_PUBLIC_SUPABASE_URL=${APP_CONFIG.supabaseUrl || 'https://your-project.supabase.co'}\nEXPO_PUBLIC_SUPABASE_ANON_KEY=${APP_CONFIG.supabaseAnonKey || 'your-anon-key'}`,
    );
    toast.success('Environment snippet copied');
  }, []);

  return (
    <Screen>
      <ScreenHeader title="Cloud sync" subtitle="Optional, off by default" />

      <Card style={{ gap: spacing.sm }}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: isCloudConfigured ? colors.success : colors.textMuted }]} />
          <AppText variant="bodyStrong">
            {isCloudConfigured ? 'Backend configured' : 'Local-only mode'}
          </AppText>
        </View>
        <AppText variant="caption" tone="muted">
          {isCloudConfigured
            ? `Connected to ${APP_CONFIG.supabaseUrl}. Sync is still dormant until you enable it below.`
            : 'Every note lives in SQLite on this device. Nothing is uploaded, and the app works without a network.'}
        </AppText>
      </Card>

      <SectionHeader title="Sync" overline style={{ marginTop: spacing.lg }} />
      <Card style={{ gap: spacing.sm }}>
        <ListRow
          icon="cloud-outline"
          accent="blue"
          title="Enable cloud sync"
          subtitle={isCloudConfigured ? 'Mirror backups to your Supabase project' : 'Requires Supabase credentials'}
          showChevron={false}
          right={
            <ToggleSwitch
              value={settings.cloudSyncEnabled}
              disabled={!isCloudConfigured}
              onChange={(value) => {
                if (value && !isCloudConfigured) {
                  toast.show('Add Supabase credentials first.');
                  return;
                }
                void patch({ cloudSyncEnabled: value });
              }}
              accessibilityLabel="Cloud sync"
            />
          }
        />
        <Button
          label={state === 'checking' ? 'Checking…' : 'Test backend connection'}
          icon="pulse-outline"
          variant="secondary"
          disabled={!isCloudConfigured || state === 'checking'}
          loading={state === 'checking'}
          onPress={() => void testConnection()}
        />
        {detail ? (
          <AppText variant="label" tone={state === 'error' ? 'default' : 'muted'}>
            {detail}
          </AppText>
        ) : null}
      </Card>

      <SectionHeader title="How to connect" overline style={{ marginTop: spacing.lg }} />
      <Card style={{ gap: spacing.sm }}>
        <AppText variant="caption" tone="secondary">
          1. Create a Supabase project and enable a Postgres table for backups.{'\n'}
          2. Copy the project URL and anon key.{'\n'}
          3. Put them in your environment before starting the app:
        </AppText>
        <View style={[styles.code, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <AppText variant="label" tone="secondary" selectable>
            EXPO_PUBLIC_SUPABASE_URL=…{'\n'}EXPO_PUBLIC_SUPABASE_ANON_KEY=…
          </AppText>
        </View>
        <Button label="Copy environment snippet" icon="copy-outline" variant="ghost" onPress={() => void copyEnv()} />
        <AppText variant="label" tone="muted">
          The anon key is a public identifier; never paste a service-role key into the app. Row-level security is what
          protects your data.
        </AppText>
      </Card>

      <SectionHeader title="What sync would do" overline style={{ marginTop: spacing.lg }} />
      <Card>
        <AppText variant="caption" tone="muted">
          Notes are written locally first and remain fully usable offline. A future sync pass uploads changed notes and
          pulls remote versions, with local edits winning conflicts. Until that pass exists, Notely does not claim to
          sync anything.
        </AppText>
      </Card>

      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  code: { borderRadius: 10, borderWidth: 1, padding: spacing.md },
});
