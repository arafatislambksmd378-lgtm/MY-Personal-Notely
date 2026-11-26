/** Notebooks screen: every notebook with its live note count. Uses FlatList for virtualized scrolling. */
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { IconTile } from '@/components/IconTile';
import { CountBadge } from '@/components/CountBadge';
import { EmptyState } from '@/components/EmptyState';
import { PromptDialog } from '@/components/PromptDialog';
import { useLibraryStore } from '@/store/useLibraryStore';
import { useColors } from '@/store/useSettingsStore';
import { notebookIconName } from '@/features/notebooks/icons';
import { pluralize } from '@/utils/text';
import { radii, spacing } from '@/design/tokens';
import { toast } from '@/store/useToastStore';
import type { NotebookWithCount } from '@/types/models';

export default function NotebooksScreen() {
  const router = useRouter();
  const colors = useColors();
  const { notebooks, stats, refresh, createNotebook } = useLibraryStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const renderRow = useCallback(
    ({ item }: { item: NotebookWithCount }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${pluralize(item.noteCount, 'note')}`}
        onPress={() =>
          router.push({ pathname: '/notebook/[id]', params: { id: item.id } })
        }
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <IconTile name={notebookIconName(item.icon)} accent={item.color} size="lg" />
        <View style={styles.rowTexts}>
          <AppText variant="bodyStrong">{item.name}</AppText>
          <AppText variant="caption" tone="muted">
            {pluralize(item.noteCount, 'note')}
          </AppText>
        </View>
        <CountBadge count={item.noteCount} accent={item.color} />
        <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
      </Pressable>
    ),
    [colors, router],
  );

  const renderNewNotebook = useCallback(() => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New notebook"
      onPress={() => setCreateOpen(true)}
      style={({ pressed }) => [
        styles.newNotebook,
        {
          borderColor: colors.primary,
          backgroundColor: pressed ? colors.primarySoft : 'transparent',
        },
      ]}
    >
      <Ionicons name="add" size={19} color={colors.primary} />
      <AppText variant={'button' as const} tone="primary">
        New notebook
      </AppText>
    </Pressable>
  ), [colors]);

  const keyExtractor = useCallback((item: NotebookWithCount) => item.id, []);

  const listHeader = (
    <View style={styles.header}>
      <AppText variant="title1">Notebooks</AppText>
      <AppText variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: spacing.xl }}>
        {pluralize(stats.notebooks, 'notebook')} · {pluralize(stats.notes, 'note')} total
      </AppText>
    </View>
  );

  return (
    <>
      <Screen scroll={false}>
        <FlatList
          data={notebooks}
          renderItem={renderRow}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await refresh();
                setRefreshing(false);
              }}
              tintColor={colors.primary}
            />
          }
          ListFooterComponent={renderNewNotebook}
          ListEmptyComponent={
            <EmptyState
              title="No notebooks yet"
              message="Notebooks group your notes by project, subject or mood."
              icon="albums-outline"
              actionLabel="Create notebook"
              onAction={() => setCreateOpen(true)}
            />
          }
        />
      </Screen>

      <PromptDialog
        visible={createOpen}
        title="New notebook"
        message="Name your notebook — you can pick a color and icon after creating it."
        placeholder="e.g. Research"
        submitLabel="Create"
        onSubmit={async (name) => {
          const notebook = await createNotebook({ name });
          toast.success(`“${notebook.name}” created`);
        }}
        onClose={() => setCreateOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  header: {
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 76,
  },
  rowTexts: { flex: 1, gap: 1 },
  newNotebook: {
    marginTop: spacing.lg,
    height: 54,
    borderRadius: radii.md + 2,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
