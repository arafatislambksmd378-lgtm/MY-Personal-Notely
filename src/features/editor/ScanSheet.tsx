/**
 * Scan pages into a note: camera capture, optional on-device text recognition,
 * page thumbnails, then insert (or create a note from the caller).
 */
import { useCallback, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BottomSheet } from '@/components/BottomSheet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { useColors } from '@/store/useSettingsStore';
import { pickImage } from '@/services/media';
import { ocrAvailable } from '@/services/ocr';
import { buildScanHtml, captureScanPage, recognisePage, scannedPageCountText, type ScanPage } from '@/services/scan';
import { toast } from '@/store/useToastStore';
import { radii, spacing } from '@/design/tokens';

interface ScanSheetProps {
  visible: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
}

export function ScanSheet({ visible, onClose, onInsert }: ScanSheetProps) {
  const colors = useColors();
  const ocr = ocrAvailable();
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [includeText, setIncludeText] = useState(true);
  const [busy, setBusy] = useState<'capture' | 'insert' | null>(null);

  const reset = useCallback(() => {
    setPages([]);
    setBusy(null);
  }, []);

  const capture = async () => {
    if (pages.length >= 10) {
      toast.show('Ten pages is the limit for one scan. Insert them, then scan again.');
      return;
    }
    setBusy('capture');
    try {
      const page = await captureScanPage(() => pickImage('camera'));
      if (!page) return;
      const recognised = ocr.available && includeText ? await recognisePage(page) : page;
      setPages((current) => [...current, recognised]);
      if (recognised.ocrError) toast.show(recognised.ocrError);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not capture the page');
    } finally {
      setBusy(null);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Scan pages"
      subtitle={ocr.available ? 'Camera + on-device text recognition' : 'Camera only'}
    >
      <View style={{ gap: spacing.sm }}>
        <View style={[styles.notice, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Ionicons name={ocr.available ? 'scan-circle-outline' : 'information-circle-outline'} size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="label" tone="secondary">
              {ocr.available
                ? 'Each page is photographed, recognised on this device and added to the note with its text.'
                : 'Pages are added as photos. Text recognition runs in the Android app build when ML Kit is available.'}
            </AppText>
            {!ocr.available ? (
              <AppText variant="label" tone="muted">
                {ocr.reason}
              </AppText>
            ) : null}
          </View>
        </View>

        {pages.length > 0 ? (
          <>
            <AppText variant="overline" tone="muted">
              {scannedPageCountText(pages.length)}
            </AppText>
            <View style={styles.pages}>
              {pages.map((page, index) => (
                <View key={`${index}-${page.dataUri.length}`} style={[styles.thumb, { borderColor: colors.border }]}>
                  <Image source={{ uri: page.dataUri }} style={styles.thumbImage} resizeMode="cover" />
                  <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                    <AppText variant="label" style={{ color: colors.onPrimary }}>
                      {index + 1}
                    </AppText>
                  </View>
                  {page.text ? (
                    <View style={[styles.textBadge, { backgroundColor: colors.success }]}>
                      <Ionicons name="text" size={11} color="#FFFFFF" />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        ) : null}

        {ocr.available ? (
          <View style={styles.toggleRow}>
            <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
              Include recognised text under each page
            </AppText>
            <ToggleSwitch value={includeText} onChange={setIncludeText} accessibilityLabel="Include recognised text" />
          </View>
        ) : null}

        <Button
          label={busy === 'capture' ? 'Capturing…' : pages.length ? 'Capture another page' : 'Capture page'}
          icon="camera-outline"
          variant="soft"
          loading={busy === 'capture'}
          onPress={() => void capture()}
          fullWidth
        />

        <Button
          label={pages.length ? `Insert ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}` : 'Insert pages'}
          icon="checkmark"
          disabled={!pages.length}
          loading={busy === 'insert'}
          onPress={() => {
            if (!pages.length) return;
            setBusy('insert');
            onInsert(buildScanHtml(pages, { includeText }));
            toast.success('Scanned pages inserted');
            reset();
            onClose();
          }}
          fullWidth
        />
        {pages.length ? <Button label="Clear pages" variant="ghost" onPress={reset} fullWidth /> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', gap: spacing.sm, borderRadius: radii.md, borderWidth: 1, padding: spacing.md },
  pages: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  thumb: { width: 74, height: 96, borderRadius: radii.sm, borderWidth: 1, overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    left: 3,
    top: 3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  textBadge: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
