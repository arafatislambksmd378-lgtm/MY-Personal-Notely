/**
 * Page setup: orientation, paper size, margins, page colour, header, footer,
 * page numbers and line spacing. Every change is applied live to the editor.
 */
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/BottomSheet';
import { AppText } from '@/components/AppText';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { useColors } from '@/store/useSettingsStore';
import { fontFamily } from '@/design/typography';
import { radii, spacing } from '@/design/tokens';
import type { PageSetup, PaperSize } from '@/types/models';

const PAPER_SIZES: PaperSize[] = ['A4', 'A5', 'Letter', 'Legal'];
const PAGE_COLORS = ['#FFFFFF', '#FFFDF5', '#FAF7FF', '#F4FBF7', '#F5F7FA', '#FFF7F2'];

interface PageSetupSheetProps {
  visible: boolean;
  onClose: () => void;
  pageSetup: PageSetup;
  onChange: (setup: PageSetup) => void;
}

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.stepperRow}>
      <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
        {label}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        onPress={() => onChange(Math.max(0, value - 8))}
        style={[styles.stepperButton, { backgroundColor: colors.surfaceMuted }]}
      >
        <Ionicons name="remove" size={15} color={colors.textSecondary} />
      </Pressable>
      <AppText variant="caption" style={{ width: 46, textAlign: 'center' }}>
        {value}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        onPress={() => onChange(Math.min(200, value + 8))}
        style={[styles.stepperButton, { backgroundColor: colors.surfaceMuted }]}
      >
        <Ionicons name="add" size={15} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

export function PageSetupSheet({ visible, onClose, pageSetup, onChange }: PageSetupSheetProps) {
  const colors = useColors();
  const update = (patch: Partial<PageSetup>) => onChange({ ...pageSetup, ...patch });

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Page setup" subtitle="Applies to this note only">
      <AppText variant="overline" tone="muted">
        Orientation
      </AppText>
      <View style={styles.segmentRow}>
        {(['portrait', 'landscape'] as const).map((orientation) => (
          <Pressable
            key={orientation}
            accessibilityRole="button"
            accessibilityState={{ selected: pageSetup.orientation === orientation }}
            onPress={() => update({ orientation })}
            style={[
              styles.segment,
              {
                backgroundColor: pageSetup.orientation === orientation ? colors.primarySoft : colors.surface,
                borderColor: pageSetup.orientation === orientation ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons
              name={orientation === 'portrait' ? 'phone-portrait-outline' : 'tablet-landscape-outline'}
              size={16}
              color={pageSetup.orientation === orientation ? colors.primary : colors.textSecondary}
            />
            <AppText variant="caption" style={{ textTransform: 'capitalize' }}>
              {orientation}
            </AppText>
          </Pressable>
        ))}
      </View>

      <AppText variant="overline" tone="muted" style={{ marginTop: spacing.md }}>
        Paper size
      </AppText>
      <View style={styles.chipRow}>
        {PAPER_SIZES.map((size) => (
          <Pressable
            key={size}
            accessibilityRole="button"
            accessibilityState={{ selected: pageSetup.paperSize === size }}
            onPress={() => update({ paperSize: size })}
            style={[
              styles.chip,
              {
                backgroundColor: pageSetup.paperSize === size ? colors.primarySoft : colors.surface,
                borderColor: pageSetup.paperSize === size ? colors.primary : colors.border,
              },
            ]}
          >
            <AppText variant="caption" tone={pageSetup.paperSize === size ? 'primary' : 'secondary'}>
              {size}
            </AppText>
          </Pressable>
        ))}
      </View>

      <AppText variant="overline" tone="muted" style={{ marginTop: spacing.md }}>
        Margins (points)
      </AppText>
      <View style={[styles.card, { borderColor: colors.border }]}>
        <Stepper label="Top" value={pageSetup.margins.top} onChange={(top) => update({ margins: { ...pageSetup.margins, top } })} />
        <Stepper
          label="Bottom"
          value={pageSetup.margins.bottom}
          onChange={(bottom) => update({ margins: { ...pageSetup.margins, bottom } })}
        />
        <Stepper label="Left" value={pageSetup.margins.left} onChange={(left) => update({ margins: { ...pageSetup.margins, left } })} />
        <Stepper
          label="Right"
          value={pageSetup.margins.right}
          onChange={(right) => update({ margins: { ...pageSetup.margins, right } })}
        />
      </View>

      <AppText variant="overline" tone="muted" style={{ marginTop: spacing.md }}>
        Page color
      </AppText>
      <View style={styles.chipRow}>
        {PAGE_COLORS.map((color) => (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityLabel={`Page color ${color}`}
            accessibilityState={{ selected: pageSetup.pageColor === color }}
            onPress={() => update({ pageColor: color })}
            style={[
              styles.colorSwatch,
              {
                backgroundColor: color,
                borderColor: pageSetup.pageColor === color ? colors.primary : colors.border,
              },
            ]}
          >
            {pageSetup.pageColor === color ? <Ionicons name="checkmark" size={14} color={colors.text} /> : null}
          </Pressable>
        ))}
      </View>

      <AppText variant="overline" tone="muted" style={{ marginTop: spacing.md }}>
        Header & footer
      </AppText>
      <TextInput
        value={pageSetup.headerText}
        onChangeText={(headerText) => update({ headerText })}
        placeholder="Header (e.g. Product strategy)"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Header text"
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      <TextInput
        value={pageSetup.footerText}
        onChangeText={(footerText) => update({ footerText })}
        placeholder="Footer (e.g. Confidential)"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Footer text"
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      <View style={styles.toggleRow}>
        <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
          Page numbers
        </AppText>
        <ToggleSwitch value={pageSetup.pageNumbers} onChange={(pageNumbers) => update({ pageNumbers })} accessibilityLabel="Page numbers" />
      </View>

      <AppText variant="overline" tone="muted" style={{ marginTop: spacing.md }}>
        Line spacing
      </AppText>
      <View style={styles.chipRow}>
        {[1.3, 1.55, 1.8, 2].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: pageSetup.lineHeight === value }}
            onPress={() => update({ lineHeight: value })}
            style={[
              styles.chip,
              {
                backgroundColor: pageSetup.lineHeight === value ? colors.primarySoft : colors.surface,
                borderColor: pageSetup.lineHeight === value ? colors.primary : colors.border,
              },
            ]}
          >
            <AppText variant="caption" tone={pageSetup.lineHeight === value ? 'primary' : 'secondary'}>
              {value}×
            </AppText>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  segmentRow: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm, borderWidth: 1 },
  card: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperButton: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 44,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
});
