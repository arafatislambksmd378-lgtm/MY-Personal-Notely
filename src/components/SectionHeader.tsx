/** Section title with optional trailing action (reference: "Notebooks" / "See all"). */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ReactNode } from 'react';
import { AppText } from './AppText';
import { useColors } from '@/store/useSettingsStore';
import { spacing } from '@/design/tokens';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  right?: ReactNode;
  overline?: boolean;
  style?: object;
}

export const SectionHeader = React.memo(function SectionHeader({ title, actionLabel, onAction, right, overline, style }: SectionHeaderProps) {
  const colors = useColors();
  return (
    <View style={[styles.row, style]}>
      <AppText variant={overline ? 'overline' : 'title3'} tone={overline ? 'muted' : 'default'}>
        {title}
      </AppText>
      {right}
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <AppText variant="caption" style={{ color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' }}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
});
