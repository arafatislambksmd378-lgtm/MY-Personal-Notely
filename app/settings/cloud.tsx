/**
 * Cloud sync settings.
 *
 * Real sync against a Supabase project: connect, test, sync now. Every number
 * shown here comes from an actual sync run; when nothing is connected the
 * screen says so instead of implying background magic.
 */
import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { SectionHeader } from '@/components/SectionHeader';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { Button } from '@/components/Button';
import { CloudConnectSheet } from '@/features/settings/CloudConnectSheet';
import { useColors, useSettingsStore } from '@/store/useSettingsStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { clearSyncConfig, createSyncClient, resolveSyncConfig, type SyncConfig } from '@/services/supabase';
import { getSyncStatus, syncNow, type SyncResult } from '@/services/sync';
import { relativeTime } from '@/utils/dates';
import { toast } from '@/store/useToastStore';
import { spacing } from '@/design/tokens';

export default function CloudSettings() {
  const colors = useColors();
  const settings = useSettingsStore((state) => state.settings);
  const patch = useSettingsStore((state) => state.patch);
  const refreshLibrary = useLibraryStore((state) => state.refresh);

  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [status, setStatus] = useState<{
    connected: boolean;
    spaceId: string | null;
    url: string | null;
    lastSyncAt: string | null;
    lastResult: SyncResult | null;
  } | null>(null);
  const [busy, setBusy] = useState<'test' | 'sync' | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);

  const load = useCallback(async () => {
    setConfig(await resolveSyncConfig());
    setStatus(await getSyncStatus());
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const test = async () => {
    setBusy('test');
    setDetail(null);
    try {
      if (!config) throw new Error('Connect a project first.');
      await createSyncClient(config).ping();
      setDetail('Reachable, table found, token accepted.');
      toast.success('Supabase connection works');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      setDetail(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const runSync = async () => {
    setBusy('sync');
    setDetail(null);
    try {
      const result = await syncNow();
      await refreshLibrary();
      await load();
      if (result.ok) {
        setDetail(
          `Pushed ${result.pushed}, pulled ${result.pulled}${result.conflicts ? `, ${result.conflicts} conflict${result.conflicts === 1 ? '' : 's'} resolved (local drafts kept in history)` : ''}.`,
        );
        toast.success('Sync finished');
      } else {
        setDetail(result.error ?? 'Sync failed');
        toast.error(result.error ?? 'Sync failed');
      }
    } finally {
      setBusy(null);
    }
  };

  const connected = Boolean(config);
  const result = status?.lastResult;

  return (
    <Screen>
      <ScreenHeader title="Cloud sync" subtitle={connected ? `Workspace “${config?.spaceId}”` : 'Off — everything stays on this device'} />

      <Card style={{ gap: spacing.sm }}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: connected ? colors.success : colors.textMuted }]} />
          <AppText variant="bodyStrong">{connected ? 'Connected to Supabase' : 'Local-only mode'}</AppText>
        </View>
        <AppText variant="caption" tone="muted">
          {connected
            ? `${config?.url} · last sync ${status?.lastSyncAt ? relativeTime(status.lastSyncAt) : 'never'}`
            : 'Notes live in SQLite on this device. Connect a Supabase project to mirror them between your devices.'}
        </AppText>
        {connected ? (
          <View style={styles.actions}>
            <Button
              label={busy === 'sync' ? 'Syncing…' : 'Sync now'}
              icon="sync-outline"
              loading={busy === 'sync'}
              onPress={() => void runSync()}
            />
            <Button
              label={busy === 'test' ? 'Testing…' : 'Test connection'}
              icon="pulse-outline"
              variant="secondary"
              loading={busy === 'test'}
              onPress={() => void test()}
            />
          </View>
        ) : (
          <Button label="Connect a Supabase project" icon="cloud-outline" onPress={() => setConnectOpen(true)} />
        )}
        {detail ? (
          <AppText variant="label" tone="secondary">
            {detail}
          </AppText>
        ) : null}
      </Card>

      {result ? (
        <>
          <SectionHeader title="Last sync" overline style={{ marginTop: spacing.lg }} />
          <Card style={{ gap: spacing.xs }}>
            <AppText variant="caption" tone={result.ok ? 'secondary' : 'default'}>
              {result.ok ? 'Completed' : 'Failed'} · {relativeTime(result.at)} · {(result.durationMs / 1000).toFixed(1)}s
            </AppText>
            <AppText variant="label" tone="muted">
              {result.pushed} pushed · {result.pulled} pulled · {result.updated} applied · {result.conflicts} conflicts ·{' '}
              {result.skipped} already current
            </AppText>
            {result.error ? (
              <AppText variant="label" style={{ color: colors.danger }}>
                {result.error}
              </AppText>
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Behaviour" overline style={{ marginTop: spacing.lg }} />
      <Card style={{ gap: spacing.sm }}>
        <ListRow
          icon="sync-outline"
          accent="blue"
          title="Sync in the background"
          subtitle="Push and pull whenever the app opens (still offline-first)"
          showChevron={false}
          right={
            <ToggleSwitch
              value={settings.cloudSyncEnabled}
              disabled={!connected}
              onChange={(value) => void patch({ cloudSyncEnabled: value })}
              accessibilityLabel="Background sync"
            />
          }
        />
        <ListRow
          icon="git-compare-outline"
          accent="purple"
          title="Conflict policy"
          subtitle="Last write wins; the overwritten local draft is kept in version history"
        />
        {connected ? (
          <Button
            label="Disconnect project"
            icon="cloud-offline-outline"
            variant="ghost"
            onPress={async () => {
              await clearSyncConfig();
              await patch({ cloudSyncEnabled: false });
              await load();
              setDetail('Disconnected. Local notes are untouched.');
              toast.success('Cloud sync disconnected');
            }}
          />
        ) : null}
      </Card>

      <SectionHeader title="Setting it up" overline style={{ marginTop: spacing.lg }} />
      <Card style={{ gap: spacing.sm }}>
        <AppText variant="caption" tone="secondary">
          1. Create a Supabase project and open the SQL editor.{'\n'}
          2. Paste supabase/schema.sql from this repository and replace the token literal.{'\n'}
          3. Use the same token here, together with the project URL and anon key.{'\n'}
          4. Pick a workspace id shared by the devices you want to keep in sync.
        </AppText>
        <View style={styles.actions}>
          <Button
            label="Copy connect checklist"
            icon="copy-outline"
            variant="ghost"
            onPress={async () => {
              await Clipboard.setStringAsync(
                'Notely sync setup\n1. Run supabase/schema.sql in your Supabase SQL editor.\n2. Replace the token literal in the RLS policy.\n3. Settings → Cloud sync → Connect a Supabase project.\n4. Use the same workspace id on every device.',
              );
              toast.success('Checklist copied');
            }}
          />
          <Button
            label="Schema file"
            icon="document-text-outline"
            variant="ghost"
            onPress={() => {
              void Linking.openURL('https://github.com/arafatislambksmd378-lgtm/MY-Personal-Notely/blob/main/supabase/schema.sql').catch(
                () => toast.error('Could not open the browser'),
              );
            }}
          />
        </View>
        <AppText variant="label" tone="muted">
          Security: the anon key is public by design, so access is gated by the token in the RLS policy. Treat that token
          as the password for this workspace — rotate it in both places if it leaks. Multi-user sharing needs Supabase
          Auth with per-user policies instead.
        </AppText>
      </Card>

      <CloudConnectSheet
        visible={connectOpen}
        onClose={() => setConnectOpen(false)}
        initial={{ url: config?.url ?? '' , spaceId: config?.spaceId ?? 'default' }}
        onConnected={() => {
          void patch({ cloudSyncEnabled: true });
          void load();
        }}
      />

      <View style={{ height: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  actions: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
});
