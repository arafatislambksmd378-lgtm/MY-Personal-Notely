/**
 * Share & export sheet. Lists only formats that have a working exporter and
 * reports the real outcome of each attempt.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/BottomSheet';
import { AppText } from '@/components/AppText';
import { SheetRow } from '@/components/SheetRow';
import { Button } from '@/components/Button';
import { useColors } from '@/store/useSettingsStore';
import { EXPORT_FORMATS, shareDocument, type ExportFormat } from '@/services/export';
import type { DocumentRecord } from '@/types/models';
import type { AccentName } from '@/design/tokens';
import { radii, spacing } from '@/design/tokens';
import { toast } from '@/store/useToastStore';

const ACCENTS: Record<ExportFormat, AccentName> = {
  pdf: 'red',
  docx: 'blue',
  odt: 'teal',
  rtf: 'amber',
  html: 'purple',
  md: 'green',
  txt: 'pink',
};

interface ShareExportSheetProps {
  visible: boolean;
  onClose: () => void;
  document: DocumentRecord;
}

export function ShareExportSheet({ visible, onClose, document }: ShareExportSheetProps) {
  const colors = useColors();
  const [busyFormat, setBusyFormat] = useState<ExportFormat | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const run = async (format: ExportFormat) => {
    setBusyFormat(format);
    setLastResult(null);
    try {
      const outcome = await shareDocument(document, format);
      setLastResult(`${outcome.fileName} · ${outcome.locationLabel}`);
      toast.success(`${format.toUpperCase()} export ready`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      setLastResult(`Export failed: ${message}`);
      toast.error(message);
    } finally {
      setBusyFormat(null);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Share & export" subtitle="Keeps your formatting">
      <View style={{ gap: spacing.sm }}>
        {EXPORT_FORMATS.map((info) => (
          <SheetRow
            key={info.format}
            label={info.label}
            icon={
              info.format === 'pdf'
                ? 'document-text-outline'
                : info.format === 'docx'
                  ? 'document-outline'
                  : info.format === 'md'
                    ? 'logo-markdown'
                    : info.format === 'html'
                      ? 'code-slash-outline'
                      : info.format === 'txt'
                        ? 'text-outline'
                        : 'document-attach-outline'
            }
            accent={ACCENTS[info.format]}
            value={busyFormat === info.format ? 'Working…' : undefined}
            showChevron={false}
            onPress={() => void run(info.format)}
            right={<Ionicons name="share-outline" size={16} color={colors.textMuted} />}
          />
        ))}
      </View>

      {lastResult ? (
        <View style={[styles.result, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <AppText variant="label" tone="secondary">
            {lastResult}
          </AppText>
        </View>
      ) : null}

      <AppText variant="label" tone="muted">
        PDF export uses the system print service (choose “Save as PDF” if prompted). DOCX, ODT and RTF open in
        Word, LibreOffice, WPS Office and Google Docs.
      </AppText>

      <Button label="Done" variant="secondary" onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  result: { borderRadius: radii.md, borderWidth: 1, padding: spacing.md },
});
