/** Icon + title + subtitle + trailing slot, used by settings, notebooks and sheets. */
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { AppText } from './AppText';
import { IconTile, type IoniconName } from './IconTile';
import { useColors } from '@/store/useSettingsStore';
import { radii, spacing } from '@/design/tokens';
import type { AccentName } from '@/design/tokens';

interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IoniconName;
  accent?: AccentName;
  onPress?: () => void;
  right?: ReactNode;
  showChevron?: boolean;
  danger?: boolean;
  style?: ViewStyle;
  titleColor?: string;
  testID?: string;
}

export const ListRow = React.memo(function ListRow({
  title,
  subtitle,
  icon,
  accent = 'purple',
  onPress,
  right,
  showChevron,
  danger,
  style,
  titleColor,
  testID,
}: ListRowProps) {
  const colors = useColors();
  const content = (
    <View style={styles.row}>
      {icon ? <IconTile name={icon} accent={danger ? 'red' : accent} size="md" /> : null}
      <View style={styles.texts}>
        <AppText variant="bodyStrong" style={titleColor || danger ? { color: danger ? colors.danger : titleColor } : undefined}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" style={{ marginTop: 1 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
      {showChevron ? <Ionicons name="chevron-forward" size={17} color={colors.textMuted} /> : null}
    </View>
  );

  if (!onPress) {
    return <View style={[styles.wrapper, { backgroundColor: colors.surface }, style]}>{content}</View>;
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrapper,
        { backgroundColor: pressed ? colors.surfaceMuted : colors.surface },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  wrapper: { borderRadius: radii.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  texts: { flex: 1 },
});
