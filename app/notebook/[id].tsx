/** Notebook detail: notes inside a notebook plus rename/color/icon/delete. */
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Fab } from '@/components/Fab';
import { IconTile } from '@/components/IconTile';
import { BottomSheet } from '@/components/BottomSheet';
import { SheetRow } from '@/components/SheetRow';
import { ColorSwatchRow } from '@/components/ColorSwatchRow';
import { PromptDialog } from '@/components/PromptDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { NoteCard } from '@/features/home/NoteCard';
import { NOTEBOOK_ICONS, notebookIconName } from '@/features/notebooks/icons';
import { getNotebookWithCount, updateNotebook, deleteNotebook } from '@/db/repositories/notebooks';
import {
  listDocumentSummaries,
  createDocument,
  duplicateDocument,
  patchDocument,
  togglePinned,
  trashDocument,
} from '@/db/repositories/documents';
import { NoteOptionsSheet } from '@/features/editor/NoteOptionsSheet';
import type { DocumentSummary, NotebookWithCount } from '@/types/models';
import type { AccentName } from '@/design/tokens';
import { radii, spacing } from '@/design/tokens';
import { useColors } from '@/store/useSettingsStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { pluralize } from '@/utils/text';
import { toast } from '@/store/useToastStore';

export default function NotebookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useColors();
  const refreshLibrary = useLibraryStore((state) => state.refresh);
  const notebooks = useLibraryStore((state) => state.notebooks);
  const [notebook, setNotebook] = useState<NotebookWithCount | null>(null);
  const [notes, setNotes] = useState<DocumentSummary[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [missing, setMissing] = useState(false);
  const [optionsNote, setOptionsNote] = useState<DocumentSummary | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);

  const openNoteOptions = useCallback((note: DocumentSummary) => {
    setOptionsNote(note);
    setOptionsVisible(true);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    const [found, noteList] = await Promise.all([
      getNotebookWithCount(id),
      listDocumentSummaries({ notebookId: id }),
    ]);
    setNotebook(found);
    setMissing(!found);
    setNotes(noteList);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const addNote = useCallback(async () => {
    if (!id) return;
    try {
      const doc = await createDocument({ notebookId: id });
      await load();
      router.push({ pathname: '/note/[id]', params: { id: doc.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create note');
    }
  }, [id, load, router]);

  if (missing || !notebook) {
    return (
      <Screen scroll={false}>
        <View style={styles.centered}>
          <AppText variant="title3">Notebook not found</AppText>
          <Button label="Go back" variant="secondary" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
        </View>
      </Screen>
    );
  }

  const fallback = notebooks.find((entry) => entry.id !== notebook.id);

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
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.headerRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Notebook options"
              onPress={() => setMenuOpen(true)}
              hitSlop={10}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.titleRow}>
            <IconTile name={notebookIconName(notebook.icon)} accent={notebook.color} size="xl" />
            <View style={{ flex: 1 }}>
              <AppText variant="title1">{notebook.name}</AppText>
              <AppText variant="caption" tone="muted">
                {pluralize(notes.length, 'note')}
              </AppText>
            </View>
          </View>

          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            {notes.length === 0 ? (
              <EmptyState
                title="No notes in this notebook"
                message="Create your first note here — it will autosave as you type."
                icon="document-text-outline"
                accent={notebook.color}
                actionLabel="New note"
                onAction={addNote}
              />
            ) : (
              notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  variant="row"
                  onPress={() => router.push({ pathname: '/note/[id]', params: { id: note.id } })}
                  onLongPress={() => openNoteOptions(note)}
                />
              ))
            )}
          </View>
        </ScrollView>
      </Screen>

      <View style={styles.fabWrapper} pointerEvents="box-none">
        <Fab onPress={addNote} accessibilityLabel="New note in this notebook" />
      </View>

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Notebook options">
        <AppText variant="overline" tone="muted">
          Color
        </AppText>
        <ColorSwatchRow
          value={notebook.color}
          onChange={async (color: AccentName) => {
            await updateNotebook(notebook.id, { color });
            await load();
            await refreshLibrary();
          }}
        />
        <AppText variant="overline" tone="muted" style={{ marginTop: spacing.md }}>
          Icon
        </AppText>
        <View style={styles.iconGrid}>
          {NOTEBOOK_ICONS.map((entry) => (
            <Pressable
              key={entry.key}
              accessibilityRole="button"
              accessibilityState={{ selected: notebook.icon === entry.key }}
              accessibilityLabel={entry.label}
              onPress={async () => {
                await updateNotebook(notebook.id, { icon: entry.key });
                await load();
              }}
              style={[
                styles.iconOption,
                {
                  borderColor: notebook.icon === entry.key ? colors.primary : colors.border,
                  backgroundColor: notebook.icon === entry.key ? colors.primarySoft : colors.surface,
                },
              ]}
            >
              <Ionicons name={notebookIconName(entry.key)} size={19} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <SheetRow
            label="Rename notebook"
            icon="create-outline"
            onPress={() => {
              setMenuOpen(false);
              setRenameOpen(true);
            }}
          />
          <SheetRow
            label="Delete notebook"
            icon="trash-outline"
            accent="red"
            danger
            onPress={() => {
              setMenuOpen(false);
              setDeleteOpen(true);
            }}
          />
        </View>
      </BottomSheet>

      <PromptDialog
        visible={renameOpen}
        title="Rename notebook"
        initialValue={notebook.name}
        submitLabel="Rename"
        onSubmit={async (name) => {
          await updateNotebook(notebook.id, { name });
          await load();
          await refreshLibrary();
          toast.success('Notebook renamed');
        }}
        onClose={() => setRenameOpen(false)}
      />

      <ConfirmDialog
        visible={deleteOpen}
        title={`Delete ${notebook.name}?`}
        message={
          fallback
            ? `The notebook is removed and its ${pluralize(notes.length, 'note')} move to ${fallback.name}. Nothing is deleted.`
            : 'This is your only notebook. Create another notebook first so your notes have a home.'
        }
        confirmLabel="Delete notebook"
        onConfirm={async () => {
          if (!fallback) {
            toast.error('Create another notebook first');
            return;
          }
          await deleteNotebook(notebook.id, fallback.id);
          await refreshLibrary();
          toast.success('Notebook removed');
          router.back();
        }}
        onClose={() => setDeleteOpen(false)}
      />

      {optionsNote && (
        <NoteOptionsSheet
          visible={optionsVisible}
          variant="noteList"
          onClose={() => setOptionsVisible(false)}
          note={optionsNote}
          onColorChange={async (color) => {
            await patchDocument(optionsNote!.id, { cardColor: color });
            await load();
            await refreshLibrary();
            toast.show('Note colour updated');
          }}
          onPinToggle={async () => {
            await togglePinned(optionsNote!.id);
            await load();
            await refreshLibrary();
            toast.show(optionsNote!.isPinned ? 'Unpinned from top' : 'Pinned to top');
          }}
          onDuplicate={async () => {
            const copy = await duplicateDocument(optionsNote!.id);
            await load();
            await refreshLibrary();
            toast.show('Copy created');
            router.push({ pathname: '/note/[id]', params: { id: copy.id } });
          }}
          onOpenEditor={() => {
            router.push({ pathname: '/note/[id]', params: { id: optionsNote!.id } });
          }}
          onDelete={async () => {
            await trashDocument(optionsNote!.id);
            await load();
            await refreshLibrary();
            toast.show('Moved to Trash');
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.huge * 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fabWrapper: { position: 'absolute', right: spacing.xl, bottom: spacing.xxl },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconOption: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
