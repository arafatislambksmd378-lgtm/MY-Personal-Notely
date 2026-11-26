/** Horizontal notebook tile (reference: 118pt card, icon tile, name, note count). */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { IconTile, type IoniconName } from '@/components/IconTile';
import { useColors } from '@/store/useSettingsStore';
import { layout, radii, shadows, spacing } from '@/design/tokens';
import type { NotebookWithCount } from '@/types/models';
import { notebookIconName } from '@/features/notebooks/icons';
import { pluralize } from '@/utils/text';

interface NotebookCardProps {
  notebook: NotebookWithCount;
  onPress: () => void;
}

export const NotebookCard = React.memo(function NotebookCard({ notebook, onPress }: NotebookCardProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${notebook.name}, ${pluralize(notebook.noteCount, 'note')}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        shadows.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <IconTile name={notebookIconName(notebook.icon) as IoniconName} accent={notebook.color} size="lg" />
      <View style={styles.texts}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {notebook.name}
        </AppText>
        <AppText variant="caption" tone="muted">
          {pluralize(notebook.noteCount, 'note')}
        </AppText>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: layout.notebookCardWidth,
    minHeight: 116,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.md,
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  texts: { gap: 1 },
});
