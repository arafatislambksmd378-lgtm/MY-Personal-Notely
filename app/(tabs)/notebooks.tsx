/** Notebooks screen: every notebook with its live note count. */
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View , Pressable } from 'react-native';
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

  return (
    <>
      <Screen scroll={false}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
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
        >
          <AppText variant="title1">Notebooks</AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: 2, marginBottom: spacing.xl }}>
            {pluralize(stats.notebooks, 'notebook')} · {pluralize(stats.notes, 'note')} total
          </AppText>

          {notebooks.length === 0 ? (
            <EmptyState
              title="No notebooks yet"
              message="Notebooks group your notes by project, subject or mood."
              icon="albums-outline"
              actionLabel="Create notebook"
              onAction={() => setCreateOpen(true)}
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {notebooks.map((notebook) => (
                <Pressable
                  key={notebook.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${notebook.name}, ${pluralize(notebook.noteCount, 'note')}`}
                  onPress={() => router.push({ pathname: '/notebook/[id]', params: { id: notebook.id } })}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <IconTile name={notebookIconName(notebook.icon)} accent={notebook.color} size="lg" />
                  <View style={styles.rowTexts}>
                    <AppText variant="bodyStrong">{notebook.name}</AppText>
                    <AppText variant="caption" tone="muted">
                      {pluralize(notebook.noteCount, 'note')}
                    </AppText>
                  </View>
                  <CountBadge count={notebook.noteCount} accent={notebook.color} />
                  <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}

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
        </ScrollView>
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
  scroll: { paddingBottom: spacing.xxxl },
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
