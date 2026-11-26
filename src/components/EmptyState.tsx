/** Friendly empty state used by every list screen. */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { IconTile, type IoniconName } from './IconTile';
import { Button } from './Button';
import { spacing } from '@/design/tokens';
import type { AccentName } from '@/design/tokens';

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: IoniconName;
  accent?: AccentName;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState = React.memo(function EmptyState({ title, message, icon = 'document-text-outline', accent = 'purple', actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrapper}>
      <IconTile name={icon} accent={accent} size="xl" />
      <AppText variant="title3" center style={{ marginTop: spacing.lg }}>
        {title}
      </AppText>
      <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.xs, maxWidth: 280 }}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="soft" size="sm" style={{ marginTop: spacing.lg }} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.xs },
});
