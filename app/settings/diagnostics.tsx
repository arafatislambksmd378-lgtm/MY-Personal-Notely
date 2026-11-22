/**
 * Diagnostics: database integrity, storage usage, event log and maintenance
 * actions (checkpoint, vacuum, clear events, export a support report).
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SectionHeader } from '@/components/SectionHeader';
import { useColors } from '@/store/useSettingsStore';
import {
  buildDiagnosticsText,
  checkpointWal,
  clearDiagnosticsEvents,
  formatBytes,
  runDiagnostics,
  vacuumDatabase,
  type DiagnosticsReport,
} from '@/services/diagnostics';
import { saveAndShare } from '@/services/files';
import { toast } from '@/store/useToastStore';
import { relativeTime } from '@/utils/dates';
import { accentSoft, radii, spacing } from '@/design/tokens';

export default function DiagnosticsSettings() {
  const colors = useColors();
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReport(await runDiagnostics());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read diagnostics');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const run = async (label: string, action: () => Promise<unknown>, success: string) => {
    setBusy(label);
    try {
      await action();
      await load();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const shareReport = async () => {
    setBusy('report');
    try {
      const text = await buildDiagnosticsText();
      const result = await saveAndShare({
        fileName: `notely-diagnostics-${new Date().toISOString().slice(0, 10)}.txt`,
        mimeType: 'text/plain',
        data: text,
        dialogTitle: 'Share diagnostics',
      });
      toast.success(`Report ready · ${result.locationLabel}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the report');
    } finally {
      setBusy(null);
    }
  };

  const health = report?.health;
  const healthy = health?.integrity === 'ok';

  return (
    <Screen scroll={false}>
      <ScreenHeader title="Diagnostics" subtitle="Local health, no telemetry" />
      {!report ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="caption" tone="muted">
            Reading database…
          </AppText>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <Card style={{ gap: spacing.xs }}>
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: healthy ? colors.success : colors.danger }]} />
              <AppText variant="title3">{healthy ? 'Database healthy' : 'Needs attention'}</AppText>
            </View>
            <AppText variant="caption" tone="muted">
              SQLite {health?.integrity} · schema v{health?.schemaVersion} · {formatBytes(health?.sizeBytes ?? 0)} on disk
            </AppText>
            <AppText variant="label" tone="muted">
              WAL {health?.walMode ? 'enabled' : 'disabled'} · foreign keys {health?.foreignKeysOk ? 'enforced' : 'off'} ·{' '}
              {health?.pageCount} pages × {formatBytes(health?.pageSize ?? 0)}
            </AppText>
          </Card>

          <SectionHeader title="Library" overline style={{ marginTop: spacing.lg }} />
          <Card style={{ gap: spacing.xs }}>
            <AppText variant="caption" tone="secondary">
              {report.counts.notes} active notes · {report.counts.archived} archived · {report.counts.trashed} trashed
            </AppText>
            <AppText variant="caption" tone="secondary">
              {report.counts.notebooks} notebooks · {report.counts.versions} saved versions
            </AppText>
            <AppText variant="caption" tone="secondary">
              {report.counts.media} media files · {formatBytes(report.counts.mediaBytes)} stored inline
            </AppText>
          </Card>

          <SectionHeader title="Maintenance" overline style={{ marginTop: spacing.lg }} />
          <Card style={{ gap: spacing.sm }}>
            <Button
              label={busy === 'check' ? 'Checking…' : 'Run integrity check'}
              icon="shield-checkmark-outline"
              variant="secondary"
              fullWidth
              loading={busy === 'check'}
              onPress={() => void run('check', load, 'Integrity check finished')}
            />
            <Button
              label={busy === 'checkpoint' ? 'Working…' : 'Checkpoint write-ahead log'}
              icon="save-outline"
              variant="ghost"
              fullWidth
              loading={busy === 'checkpoint'}
              onPress={() => void run('checkpoint', checkpointWal, 'WAL checkpointed')}
            />
            <Button
              label={busy === 'vacuum' ? 'Compacting…' : 'Compact database (VACUUM)'}
              icon="albums-outline"
              variant="ghost"
              fullWidth
              loading={busy === 'vacuum'}
              onPress={() => void run('vacuum', vacuumDatabase, 'Database compacted')}
            />
            <Button
              label={busy === 'report' ? 'Preparing…' : 'Share a diagnostics report'}
              icon="share-outline"
              variant="soft"
              fullWidth
              loading={busy === 'report'}
              onPress={() => void shareReport()}
            />
          </Card>

          <SectionHeader
            title="Recent events"
            overline
            style={{ marginTop: spacing.lg }}
            actionLabel={report.events.length ? 'Clear' : undefined}
            onAction={() => void run('clear', clearDiagnosticsEvents, 'Event log cleared')}
          />
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {report.events.length === 0 ? (
              <AppText variant="caption" tone="muted" style={{ padding: spacing.md }}>
                No events recorded. Errors and warnings appear here — never note content.
              </AppText>
            ) : (
              report.events.map((event, index) => (
                <View
                  key={event.id}
                  style={[
                    styles.event,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  ]}
                >
                  <View style={[styles.level, { backgroundColor: event.level === 'error' ? colors.dangerSoft : event.level === 'warn' ? accentSoft.amber : colors.surfaceMuted }]}>
                    <AppText variant="label" style={{ color: event.level === 'error' ? colors.danger : colors.textSecondary }}>
                      {event.level}
                    </AppText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="label" numberOfLines={2}>
                      {event.message}
                    </AppText>
                    <AppText variant="label" tone="muted">
                      {event.scope} · {relativeTime(event.createdAt)}
                    </AppText>
                  </View>
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  event: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md },
  level: { borderRadius: radii.sm, paddingHorizontal: 7, paddingVertical: 3, minWidth: 48, alignItems: 'center' },
});
