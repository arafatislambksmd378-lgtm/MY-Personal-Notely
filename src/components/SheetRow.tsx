/**
 * Row used inside "Note options", "Insert" and settings sheets — the visual
 * pattern of the note options reference: 40pt tinted icon, label, optional
 * value, chevron.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { AppText } from './AppText';
import { IconTile, type IoniconName } from './IconTile';
import { useColors } from '@/store/useSettingsStore';
import type { AccentName } from '@/design/tokens';
import { radii, spacing } from '@/design/tokens';

interface SheetRowProps {
  label: string;
  icon?: IoniconName;
  accent?: AccentName;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  danger?: boolean;
  right?: ReactNode;
  testID?: string;
}

export function SheetRow({
  label,
  icon,
  accent = 'purple',
  value,
  onPress,
  showChevron = true,
  danger,
  right,
  testID,
}: SheetRowProps) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {icon ? <IconTile name={icon} accent={danger ? 'red' : accent} size="md" /> : null}
      <AppText variant="bodyStrong" style={[styles.label, danger && { color: colors.danger }]}>
        {label}
      </AppText>
      {value ? (
        <AppText variant="caption" tone="muted">
          {value}
        </AppText>
      ) : null}
      {right}
      {showChevron ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 60,
  },
  label: { flex: 1 },
});
