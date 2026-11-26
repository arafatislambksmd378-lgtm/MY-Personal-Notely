/**
 * Collection screen for the library slices: favourites, pinned, archived,
 * trash and everything. Each slice gets its own empty state and actions
 * (restore / delete forever / empty trash) instead of a generic list.
 */
import { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText } from '@/components/AppText';
import { NoteCard } from '@/features/home/NoteCard';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useColors } from '@/store/useSettingsStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import {
  listDocumentSummaries,
  emptyTrash,
  restoreDocument,
  purgeDocument,
  duplicateDocument,
  patchDocument,
  togglePinned,
  trashDocument,
} from '@/db/repositories/documents';
import { toast } from '@/store/useToastStore';
import { NoteOptionsSheet } from '@/features/editor/NoteOptionsSheet';
import type { DocumentSummary } from '@/types/models';
import { spacing } from '@/design/tokens';

type CollectionKind = 'all' | 'favorites' | 'pinned' | 'archived' | 'trash';

const META: Record<CollectionKind, { title: string; subtitle: string; emptyTitle: string; emptyMessage: string; icon: 'star-outline' | 'pin-outline' | 'archive-outline' | 'trash-outline' | 'albums-outline' }> = {
  all: {
    title: 'All notes',
    subtitle: 'Everything in your library',
    emptyTitle: 'No notes yet',
    emptyMessage: 'Create your first note and it will appear here.',
    icon: 'albums-outline',
  },
  favorites: {
    title: 'Favourites',
    subtitle: 'Starred notes',
    emptyTitle: 'No favourites yet',
    emptyMessage: 'Open a note and tap the star to keep it close.',
    icon: 'star-outline',
  },
  pinned: {
    title: 'Pinned',
    subtitle: 'Always at the top of Home',
    emptyTitle: 'Nothing pinned',
    emptyMessage: 'Pin a note from its editor to keep it within reach.',
    icon: 'pin-outline',
  },
  archived: {
    title: 'Archive',
    subtitle: 'Out of the way, not deleted',
    emptyTitle: 'Archive is empty',
    emptyMessage: 'Archived notes stay searchable but leave your main list.',
    icon: 'archive-outline',
  },
  trash: {
    title: 'Trash',
    subtitle: 'Deleted notes you can still restore',
    emptyTitle: 'Trash is empty',
    emptyMessage: 'Deleted notes are kept here until you empty the trash.',
    icon: 'trash-outline',
  },
};

export default function CollectionScreen() {
  const { kind: rawKind } = useLocalSearchParams<{ kind: string }>();
  const kind = (rawKind && rawKind in META ? rawKind : 'all') as CollectionKind;
  const meta = META[kind];
  const router = useRouter();
  const colors = useColors();
  const refreshLibrary = useLibraryStore((state) => state.refresh);
  const [notes, setNotes] = useState<DocumentSummary[]>([]);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [optionsNote, setOptionsNote] = useState<DocumentSummary | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);

  const openNoteOptions = useCallback((note: DocumentSummary) => {
    setOptionsNote(note);
    setOptionsVisible(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filters =
        kind === 'favorites'
          ? { favorite: true }
          : kind === 'pinned'
            ? { pinned: true }
            : kind === 'archived'
              ? { archived: true }
              : kind === 'trash'
                ? { trashed: true }
                : {};
      const rows = await listDocumentSummaries({ ...filters, limit: 500, sort: 'updated_desc' });
      setNotes(rows);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const header = useMemo(
    () => (
      <ScreenHeader
        title={meta.title}
        subtitle={loading ? 'Loading…' : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} · ${meta.subtitle}`}
      />
    ),
    [loading, meta.subtitle, meta.title, notes.length],
  );

  return (
    <Screen scroll={false}>
      {header}
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xxl, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View style={{ gap: spacing.xs }}>
            <NoteCard
              note={item}
              variant="row"
              onPress={() => router.push({ pathname: '/note/[id]', params: { id: item.id } })}
              onLongPress={() => openNoteOptions(item)}
            />
            {kind === 'trash' ? (
              <View style={styles.actions}>
                <Button
                  label="Restore"
                  size="sm"
                  variant="soft"
                  icon="arrow-undo-outline"
                  onPress={async () => {
                    await restoreDocument(item.id);
                    await refreshLibrary();
                    await load();
                    toast.success('Note restored');
                  }}
                />
                <Button
                  label="Delete forever"
                  size="sm"
                  variant="ghost"
                  icon="trash-outline"
                  onPress={async () => {
                    await purgeDocument(item.id);
                    await refreshLibrary();
                    await load();
                    toast.success('Deleted permanently');
                  }}
                />
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <AppText variant="caption" tone="muted">
                Loading notes…
              </AppText>
            </View>
          ) : (
            <EmptyState
              icon={meta.icon}
              accent={kind === 'trash' ? 'red' : kind === 'favorites' ? 'amber' : 'purple'}
              title={meta.emptyTitle}
              message={meta.emptyMessage}
              actionLabel={kind === 'all' ? 'Create a note' : undefined}
              onAction={
                kind === 'all'
                  ? async () => {
                      const doc = await useLibraryStore.getState().createNote();
                      router.push({ pathname: '/note/[id]', params: { id: doc.id } });
                    }
                  : undefined
              }
            />
          )
        }
      />
      {kind === 'trash' && notes.length > 0 ? (
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Button label="Empty trash" variant="danger" icon="trash-outline" onPress={() => setConfirmEmpty(true)} fullWidth />
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmEmpty}
        title="Empty the trash?"
        message={`${notes.length} ${notes.length === 1 ? 'note' : 'notes'} will be deleted permanently. This cannot be undone.`}
        confirmLabel="Delete permanently"
        onConfirm={async () => {
          const removed = await emptyTrash();
          await refreshLibrary();
          await load();
          toast.success(`${removed} ${removed === 1 ? 'note' : 'notes'} deleted`);
        }}
        onClose={() => setConfirmEmpty(false)}
      />

      {optionsNote && (
        <NoteOptionsSheet
          visible={optionsVisible}
          variant="noteList"
          onClose={() => setOptionsVisible(false)}
          note={optionsNote}
          onColorChange={async (color) => {
            await patchDocument(optionsNote!.id, { cardColor: color });
            await refreshLibrary();
            await load();
            toast.show('Note colour updated');
          }}
          onPinToggle={async () => {
            await togglePinned(optionsNote!.id);
            await refreshLibrary();
            await load();
            toast.show(optionsNote!.isPinned ? 'Unpinned from top' : 'Pinned to top');
          }}
          onDuplicate={async () => {
            const copy = await duplicateDocument(optionsNote!.id);
            await refreshLibrary();
            await load();
            toast.show('Copy created');
            router.push({ pathname: '/note/[id]', params: { id: copy.id } });
          }}
          onOpenEditor={() => {
            router.push({ pathname: '/note/[id]', params: { id: optionsNote!.id } });
          }}
          onDelete={async () => {
            await trashDocument(optionsNote!.id);
            await refreshLibrary();
            await load();
            toast.show('Moved to Trash');
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.xs, paddingLeft: spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  footer: { borderTopWidth: 1, paddingVertical: spacing.sm },
});
