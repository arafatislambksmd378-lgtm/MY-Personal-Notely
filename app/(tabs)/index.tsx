/**
 * Home screen.
 *
 * Reference layout: greeting + pencil FAB, search field, horizontal notebook
 * tiles, then recent-note cards with a floating "+" action.
 */
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { SearchBar } from '@/components/SearchBar';
import { SectionHeader } from '@/components/SectionHeader';
import { Fab } from '@/components/Fab';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { PromptDialog } from '@/components/PromptDialog';
import { useLibraryStore } from '@/store/useLibraryStore';
import { useSettingsStore, useColors } from '@/store/useSettingsStore';
import { NotebookCard } from '@/features/home/NotebookCard';
import { NoteCard } from '@/features/home/NoteCard';
import { NoteOptionsSheet } from '@/features/editor/NoteOptionsSheet';
import { formatHeaderDate, greeting } from '@/utils/dates';
import { pluralize } from '@/utils/text';
import { spacing } from '@/design/tokens';
import { toast } from '@/store/useToastStore';
import { logEvent } from '@/db/repositories/events';
import { duplicateDocument, patchDocument, togglePinned, trashDocument } from '@/db/repositories/documents';
import type { DocumentSummary } from '@/types/models';

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { notebooks, recent, pinned, stats, refresh } = useLibraryStore();
  const createNote = useLibraryStore((state) => state.createNote);
  const createNotebook = useLibraryStore((state) => state.createNotebook);
  const userName = useSettingsStore((state) => state.settings.userName);
  const [refreshing, setRefreshing] = useState(false);
  const [newNotebookOpen, setNewNotebookOpen] = useState(false);
  const [optionsNote, setOptionsNote] = useState<DocumentSummary | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);

  const openNoteOptions = useCallback((note: DocumentSummary) => {
    setOptionsNote(note);
    setOptionsVisible(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const startNote = useCallback(async () => {
    try {
      const doc = await createNote();
      router.push({ pathname: '/note/[id]', params: { id: doc.id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create a note';
      toast.error(message);
      void logEvent('error', 'home', 'Quick note failed', { message });
    }
  }, [createNote, router]);

  const recentToShow = useMemo(() => {
    const hidden = new Set(pinned.map((note) => note.id));
    const merged = [...recent.filter((note) => !hidden.has(note.id))];
    return merged.slice(0, 8);
  }, [pinned, recent]);

  const hasContent = notebooks.length > 0 || recent.length > 0;

  return (
    <>
      <Screen
        contentStyle={{ paddingTop: insets.top > 0 ? 0 : spacing.md }}
        footer={null}
        scroll={false}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <AppText variant="caption" tone="muted">
                {formatHeaderDate()}
              </AppText>
              <AppText variant="display" style={{ marginTop: 2 }}>
                {greeting()}
              </AppText>
              <AppText variant="display">{userName}</AppText>
            </View>
            <Fab onPress={startNote} accessibilityLabel="Create a new note" testID="home-new-note" />
          </View>

          <SearchBar onPress={() => router.push('/search')} editable={false} placeholder="Search notes, tables, ideas…" />

          {!hasContent ? (
            <EmptyState
              title="Your notebook is empty"
              message="Create your first note to see it here, or add a notebook to organise your work."
              icon="sparkles-outline"
              actionLabel="Create a note"
              onAction={startNote}
            />
          ) : null}

          {notebooks.length > 0 ? (
            <>
              <SectionHeader
                title="Notebooks"
                actionLabel="See all"
                onAction={() => router.push('/notebooks')}
                style={{ marginTop: spacing.xxl }}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontal}
              >
                {notebooks.map((notebook) => (
                  <NotebookCard
                    key={notebook.id}
                    notebook={notebook}
                    onPress={() => router.push({ pathname: '/notebook/[id]', params: { id: notebook.id } })}
                  />
                ))}
                <View style={styles.addCard}>
                  <Button label="New" variant="secondary" size="sm" icon="add" onPress={() => setNewNotebookOpen(true)} />
                </View>
              </ScrollView>
            </>
          ) : null}

          {pinned.length > 0 && recentToShow.length > 0 ? (
            <SectionHeader title="Pinned" style={{ marginTop: spacing.xxl }} />
          ) : null}

          {pinned.length > 0 && recentToShow.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
              {pinned.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onPress={() => router.push({ pathname: '/note/[id]', params: { id: note.id } })}
                  onLongPress={() => openNoteOptions(note)}
                />
              ))}
            </ScrollView>
          ) : null}

          {recent.length > 0 ? (
            <>
              <SectionHeader
                title="Recent notes"
                actionLabel="See all"
                onAction={() => router.push({ pathname: '/collection/[kind]', params: { kind: 'all' } })}
                style={{ marginTop: spacing.xxl }}
              />
              <View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontal}
                >
                  {recentToShow.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      onPress={() => router.push({ pathname: '/note/[id]', params: { id: note.id } })}
                      onLongPress={() => openNoteOptions(note)}
                    />
                  ))}
                </ScrollView>
              </View>
            </>
          ) : null}

          {hasContent ? (
            <View style={[styles.summary, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <AppText variant="caption" tone="secondary">
                {pluralize(stats.notes, 'note')} · {pluralize(stats.notebooks, 'notebook')} ·{' '}
                {stats.words.toLocaleString()} words
              </AppText>
              <AppText variant="label" tone="muted" style={{ marginTop: 2 }}>
                Stored locally on this device
              </AppText>
            </View>
          ) : null}
        </ScrollView>
      </Screen>

      <PromptDialog
        visible={newNotebookOpen}
        title="New notebook"
        message="Give your notebook a name. You can change the color and icon later."
        placeholder="e.g. Research"
        submitLabel="Create"
        onSubmit={async (name) => {
          const notebook = await createNotebook({ name });
          toast.success(`“${notebook.name}” created`);
        }}
        onClose={() => setNewNotebookOpen(false)}
      />

      {optionsNote && (
        <NoteOptionsSheet
          visible={optionsVisible}
          variant="noteList"
          onClose={() => setOptionsVisible(false)}
          note={optionsNote}
          onColorChange={async (color) => {
            await patchDocument(optionsNote!.id, { cardColor: color });
            await refresh();
            toast.show('Note colour updated');
          }}
          onPinToggle={async () => {
            await togglePinned(optionsNote!.id);
            await refresh();
            toast.show(optionsNote!.isPinned ? 'Unpinned from top' : 'Pinned to top');
          }}
          onDuplicate={async () => {
            const copy = await duplicateDocument(optionsNote!.id);
            await refresh();
            toast.show('Copy created');
            router.push({ pathname: '/note/[id]', params: { id: copy.id } });
          }}
          onOpenEditor={() => {
            router.push({ pathname: '/note/[id]', params: { id: optionsNote!.id } });
          }}
          onDelete={async () => {
            await trashDocument(optionsNote!.id);
            await refresh();
            toast.show('Moved to Trash');
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  headerText: { flex: 1 },
  horizontal: { gap: spacing.md, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  addCard: { justifyContent: 'center' },
  summary: {
    marginTop: spacing.xxl,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.lg,
  },
});
