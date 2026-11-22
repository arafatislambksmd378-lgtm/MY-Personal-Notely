/**
 * Backup & restore. Everything is created on-device: a human-readable JSON
 * file, a ZIP archive for safekeeping, or a restore from either format.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useColors, useSettingsStore } from '@/store/useSettingsStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { createBackup, createBackupArchive, restoreBackup, restoreFromArchive } from '@/services/backup';
import { saveAndShare } from '@/services/files';
import { pickAndImport } from '@/services/import';
import { createDocument } from '@/db/repositories/documents';
import { listTags } from '@/db/repositories/tags';
import { formatFullDate } from '@/utils/dates';
import { toast } from '@/store/useToastStore';
import { logEvent } from '@/db/repositories/events';
import { spacing } from '@/design/tokens';

export default function BackupSettings() {
  const colors = useColors();
  const settings = useSettingsStore((state) => state.settings);
  const patch = useSettingsStore((state) => state.patch);
  const stats = useLibraryStore((state) => state.stats);
  const refresh = useLibraryStore((state) => state.refresh);
  const [busy, setBusy] = useState<'json' | 'zip' | 'restore' | 'import' | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<{ json: string; name: string } | null>(null);
  const pendingArchive = useRef<Uint8Array | null>(null);

  const [tagCount, setTagCount] = useState<number | null>(null);

  useEffect(() => {
    void listTags()
      .then((tags) => setTagCount(tags.length))
      .catch(() => undefined);
  }, []);

  const exportJson = useCallback(async () => {
    setBusy('json');
    try {
      const { json, counts: exported } = await createBackup({ pretty: true });
      const result = await saveAndShare({
        fileName: `notely-backup-${new Date().toISOString().slice(0, 10)}.json`,
        mimeType: 'application/json',
        data: json,
        dialogTitle: 'Save Notely backup',
      });
      await patch({ lastBackupAt: new Date().toISOString() });
      setLastResult(`${exported.documents} notes · ${exported.notebooks} notebooks · ${result.locationLabel}`);
      toast.success('Backup created');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Backup failed';
      toast.error(message);
      void logEvent('error', 'backup', 'Backup failed', { message });
    } finally {
      setBusy(null);
    }
  }, [patch]);

  const exportZip = useCallback(async () => {
    setBusy('zip');
    try {
      const bytes = await createBackupArchive();
      const result = await saveAndShare({
        fileName: `notely-backup-${new Date().toISOString().slice(0, 10)}.zip`,
        mimeType: 'application/zip',
        data: bytes,
        dialogTitle: 'Save Notely archive',
      });
      await patch({ lastBackupAt: new Date().toISOString() });
      setLastResult(result.locationLabel);
      toast.success('Archive created');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Backup failed');
    } finally {
      setBusy(null);
    }
  }, [patch]);

  const chooseRestore = useCallback(async () => {
    setBusy('restore');
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: ['application/json', 'application/zip', 'application/x-zip-compressed', '*/*'],
      });
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      const file = asset.file ?? new File(asset.uri);
      const buffer = new Uint8Array(await file.arrayBuffer());
      const name = asset.name ?? 'backup';
      if (name.toLowerCase().endsWith('.zip')) {
        const bytes = buffer;
        setConfirmRestore({ json: `zip:${Array.from(bytes).length}`, name });
        // Restores run after confirmation; keep the bytes for the handler below.
        pendingArchive.current = bytes;
      } else {
        pendingArchive.current = null;
        setConfirmRestore({ json: new TextDecoder().decode(buffer), name });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read that file');
    } finally {
      setBusy(null);
    }
  }, []);

  const importDocument = useCallback(async () => {
    setBusy('import');
    try {
      const result = await pickAndImport();
      if (!result) return;
      const doc = await createDocument({ title: result.title, contentHtml: result.html });
      await refresh();
      toast.success(`Imported “${doc.title}” into your library`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  return (
    <Screen>
      <ScreenHeader title="Backup & restore" subtitle="Your notebook, in a file you own" />

      <Card style={{ gap: spacing.xs }}>
        <AppText variant="title3">{stats.notes + stats.archived} notes saved</AppText>
        <AppText variant="caption" tone="muted">
          {stats.notebooks} notebooks · {stats.trashed} in trash ·{' '}
          {settings.lastBackupAt ? `last backup ${formatFullDate(settings.lastBackupAt)}` : 'no backup yet'}
        </AppText>
        {tagCount !== null ? (
          <AppText variant="label" tone="muted">
            {tagCount} tags plus every note version, comment and bookmark are included in each backup.
          </AppText>
        ) : null}
      </Card>

      <SectionHeader title="Export" overline style={{ marginTop: spacing.lg }} />
      <Card style={{ gap: spacing.sm }}>
        <Button
          label={busy === 'json' ? 'Preparing…' : 'Save a JSON backup'}
          icon="document-text-outline"
          variant="soft"
          fullWidth
          loading={busy === 'json'}
          onPress={() => void exportJson()}
        />
        <AppText variant="label" tone="muted">
          Readable, diff-friendly and small. Includes notebooks, notes, versions, tags, comments and bookmarks — but
          never your PIN.
        </AppText>
        <Button
          label={busy === 'zip' ? 'Preparing…' : 'Save a .zip archive'}
          icon="archive-outline"
          variant="secondary"
          fullWidth
          loading={busy === 'zip'}
          onPress={() => void exportZip()}
        />
        <AppText variant="label" tone="muted">
          One file that is easy to keep in cloud storage. Same contents as the JSON backup.
        </AppText>
      </Card>

      <SectionHeader title="Restore" overline style={{ marginTop: spacing.lg }} />
      <Card style={{ gap: spacing.sm }}>
        <Button
          label={busy === 'restore' ? 'Reading…' : 'Restore from a backup'}
          icon="cloud-download-outline"
          variant="secondary"
          fullWidth
          loading={busy === 'restore'}
          onPress={() => void chooseRestore()}
        />
        <AppText variant="label" tone="muted">
          Notes that already exist are kept as they are; new ones are added. Nothing is deleted without a confirmation.
        </AppText>
      </Card>

      <SectionHeader title="Bring in a document" overline style={{ marginTop: spacing.lg }} />
      <Card style={{ gap: spacing.sm }}>
        <ListRow
          icon="cloud-upload-outline"
          accent="blue"
          title="Import DOCX, ODT, Markdown, HTML or TXT"
          subtitle="Converted to a new note on this device"
          onPress={() => void importDocument()}
        />
        {busy === 'import' ? (
          <AppText variant="label" tone="muted">
            Converting…
          </AppText>
        ) : null}
      </Card>

      {lastResult ? (
        <View style={[styles.result, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <AppText variant="label" tone="secondary">
            {lastResult}
          </AppText>
        </View>
      ) : null}

      <View style={{ height: spacing.xl }} />

      <ConfirmDialog
        visible={Boolean(confirmRestore)}
        title="Restore this backup?"
        message={
          confirmRestore
            ? `“${confirmRestore.name}” will be merged into your library. Existing notes with the same id are skipped, so nothing you have written is overwritten.`
            : ''
        }
        confirmLabel="Restore"
        onConfirm={async () => {
          if (!confirmRestore) return;
          const archive = pendingArchive.current;
          const result = confirmRestore.json.startsWith('zip:') && archive
            ? await restoreFromArchive(archive)
            : await restoreBackup(confirmRestore.json, { mode: 'merge' });
          await refresh();
          toast.success(`Restored ${result.documents} notes${result.skipped ? `, ${result.skipped} already present` : ''}`);
          setLastResult(`Restored ${result.documents} notes · ${result.notebooks} notebooks`);
        }}
        onClose={() => setConfirmRestore(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  result: { marginTop: spacing.md, borderRadius: 12, borderWidth: 1, padding: spacing.md },
});
