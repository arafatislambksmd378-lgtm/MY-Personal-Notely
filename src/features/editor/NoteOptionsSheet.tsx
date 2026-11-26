/**
 * Note options bottom sheet — shared, reusable component.
 *
 * Two variants:
 *  - 'editor' (default): the full review/tools sheet used from within the open
 *    note editor (page setup, find & replace, versions, tags, favourite, …).
 *  - 'noteList': the functional sheet opened from note lists on tap / long-press.
 *    It exposes exactly five actions: Card Colour, Pin Note, Make a Copy,
 *    Open Editor and Delete Note (with confirmation → Trash, restorable).
 *
 * The sheet slides up/down smoothly and honours Android back via the
 * BottomSheet primitive's onRequestClose.
 */
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheet } from '@/components/BottomSheet';
import { AppText } from '@/components/AppText';
import { SheetRow } from '@/components/SheetRow';
import { ColorSwatchRow } from '@/components/ColorSwatchRow';
import { useColors } from '@/store/useSettingsStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { spacing } from '@/design/tokens';
import type { AccentName } from '@/design/tokens';
import {
  duplicateDocument,
  patchDocument,
  togglePinned,
  trashDocument,
} from '@/db/repositories/documents';
import { toast } from '@/store/useToastStore';

export type NoteOption =
  | 'page-setup'
  | 'find-replace'
  | 'word-count'
  | 'spelling'
  | 'versions'
  | 'comments'
  | 'bookmarks'
  | 'move'
  | 'tags'
  | 'favorite'
  | 'archive'
  | 'share'
  | 'duplicate'
  | 'pin'
  | 'delete';

export type NoteSheetVariant = 'editor' | 'noteList';

interface NoteContext {
  id: string;
  title: string;
  cardColor: AccentName;
  isPinned: boolean;
}

interface NoteOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
  variant?: NoteSheetVariant;
  /* Editor variant */
  cardColor?: AccentName;
  onCardColorChange?: (color: AccentName) => void;
  onSelect?: (option: NoteOption) => void;
  isPinned?: boolean;
  isFavorite?: boolean;
  /* Note-list variant */
  note?: NoteContext;
  onColorChange?: (color: AccentName) => void;
  onPinToggle?: () => void;
  onDuplicate?: () => void;
  onOpenEditor?: () => void;
  onDelete?: () => void;
}

export function NoteOptionsSheet({
  visible,
  onClose,
  variant = 'editor',
  cardColor,
  onCardColorChange,
  onSelect,
  isPinned = false,
  isFavorite = false,
  note,
  onColorChange,
  onPinToggle,
  onDuplicate,
  onOpenEditor,
  onDelete,
}: NoteOptionsSheetProps) {
  const colors = useColors();
  const router = useRouter();
  const refresh = useLibraryStore((state) => state.refresh);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleColorChange = useCallback(
    (color: AccentName) => {
      onCardColorChange?.(color);
      onColorChange?.(color);
      if (note) {
        void patchDocument(note.id, { cardColor: color }).then(() => {
          void refresh();
          toast.show(`Note colour updated`);
        });
      }
    },
    [note, onCardColorChange, onColorChange, refresh],
  );

  const handlePin = useCallback(() => {
    onPinToggle?.();
    onSelect?.('pin');
    if (note) {
      void togglePinned(note.id).then(() => {
        void refresh();
        toast.show(note.isPinned ? 'Unpinned from top' : 'Pinned to top');
      });
    }
  }, [note, onPinToggle, onSelect, refresh]);

  const handleDuplicate = useCallback(() => {
    onDuplicate?.();
    onSelect?.('duplicate');
    if (note) {
      void duplicateDocument(note.id).then((copy) => {
        void refresh();
        toast.show('Copy created');
        router.push({ pathname: '/note/[id]', params: { id: copy.id } });
      });
    }
  }, [note, onDuplicate, onSelect, router, refresh]);

  const handleOpenEditor = useCallback(() => {
    onOpenEditor?.();
    if (note) {
      router.push({ pathname: '/note/[id]', params: { id: note.id } });
    }
  }, [note, onOpenEditor, router]);

  const handleDelete = useCallback(() => {
    onDelete?.();
    onSelect?.('delete');
    if (note) {
      setConfirmDelete(true);
    }
  }, [note, onDelete, onSelect]);

  const handleConfirmDelete = useCallback(() => {
    if (!note) return;
    void trashDocument(note.id).then(() => {
      void refresh();
      toast.show('Moved to Trash');
      setConfirmDelete(false);
      onClose();
    });
  }, [note, refresh, onClose]);

  const isNoteList = variant === 'noteList';

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={isNoteList ? 'Note options' : 'Note options'}
      testID="note-options-sheet"
    >
      {isNoteList ? (
        <NoteListSheet
          note={note!}
          cardColor={note!.cardColor}
          onColorChange={handleColorChange}
          isPinned={note!.isPinned}
          onPinToggle={handlePin}
          onDuplicate={handleDuplicate}
          onOpenEditor={handleOpenEditor}
          onDelete={handleDelete}
          confirmDelete={confirmDelete}
          setConfirmDelete={setConfirmDelete}
          onConfirmDelete={handleConfirmDelete}
          onClose={onClose}
          colors={colors}
        />
      ) : (
        <EditorSheet
          cardColor={cardColor ?? 'purple'}
          onCardColorChange={onCardColorChange}
          onSelect={onSelect}
          isPinned={isPinned}
          isFavorite={isFavorite}
        />
      )}
    </BottomSheet>
  );
}

interface NoteListSheetProps {
  note: NoteContext;
  cardColor: AccentName;
  onColorChange: (color: AccentName) => void;
  isPinned: boolean;
  onPinToggle: () => void;
  onDuplicate: () => void;
  onOpenEditor: () => void;
  onDelete: () => void;
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  onConfirmDelete: () => void;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}

function NoteListSheet({
  note,
  cardColor,
  onColorChange,
  isPinned,
  onPinToggle,
  onDuplicate,
  onOpenEditor,
  onDelete,
  confirmDelete,
  setConfirmDelete,
  onConfirmDelete,
  onClose,
  colors,
}: NoteListSheetProps) {
  return (
    <View style={styles.inner}>
      <AppText variant="overline" tone="muted">
        Card colour
      </AppText>
      <ColorSwatchRow value={cardColor} onChange={onColorChange} />

      <View style={styles.group}>
        <SheetRow
          label="Open in editor"
          icon="create-outline"
          accent="blue"
          onPress={onOpenEditor}
        />
        <SheetRow
          label={isPinned ? 'Unpin from top' : 'Pin to top'}
          icon="pin-outline"
          accent="pink"
          onPress={onPinToggle}
        />
        <SheetRow
          label="Make a copy"
          icon="copy-outline"
          accent="amber"
          onPress={onDuplicate}
        />
        <SheetRow
          label="Change card colour"
          icon="color-palette-outline"
          accent="purple"
          onPress={() => {}}
        />
        <SheetRow
          label="Delete note"
          icon="trash-outline"
          danger
          onPress={onDelete}
        />
      </View>

      {confirmDelete ? (
        <View style={styles.confirmCard}>
          <AppText variant="bodyStrong" style={styles.confirmTitle}>
            Delete “{note.title}”?
          </AppText>
          <AppText variant="caption" tone="muted" style={styles.confirmBody}>
            The note will be moved to Trash and can be restored.
          </AppText>
          <View style={styles.confirmActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={setConfirmDelete.bind(null, false)}
              style={[styles.confirmButton, { backgroundColor: colors.surfaceMuted }]}
            >
              <AppText variant="bodyStrong" tone="muted" style={{ textAlign: 'center' }}>
                Cancel
              </AppText>
            </Pressable>
            <View style={styles.confirmSep} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete"
              onPress={onConfirmDelete}
              style={[styles.confirmButton, { backgroundColor: colors.dangerSoft }]}
            >
              <AppText variant="bodyStrong" style={{ color: colors.danger, textAlign: 'center' }}>
                Delete
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

interface EditorSheetProps {
  cardColor: AccentName;
  onCardColorChange?: (color: AccentName) => void;
  onSelect?: (option: NoteOption) => void;
  isPinned: boolean;
  isFavorite: boolean;
}

function EditorSheet({
  cardColor,
  onCardColorChange,
  onSelect,
  isPinned,
  isFavorite,
}: EditorSheetProps) {
  return (
    <View style={styles.inner}>
      <AppText variant="overline" tone="muted">
        Card color
      </AppText>
      <ColorSwatchRow
        value={cardColor}
        onChange={onCardColorChange ?? (() => {})}
      />

      <View style={styles.group}>
        <SheetRow
          label="Page setup"
          icon="document-outline"
          accent="blue"
          onPress={() => onSelect?.('page-setup')}
        />
        <SheetRow
          label="Find and replace"
          icon="search-outline"
          accent="purple"
          onPress={() => onSelect?.('find-replace')}
        />
        <SheetRow
          label="Word count"
          icon="text-outline"
          accent="green"
          onPress={() => onSelect?.('word-count')}
        />
        <SheetRow
          label="Spelling and grammar"
          icon="checkmark-done-outline"
          accent="amber"
          onPress={() => onSelect?.('spelling')}
        />
        <SheetRow
          label="Version history"
          icon="time-outline"
          accent="pink"
          onPress={() => onSelect?.('versions')}
        />
      </View>

      <View style={[styles.separator]} />

      <View style={styles.group}>
        <SheetRow
          label="Comments"
          icon="chatbubble-outline"
          accent="blue"
          onPress={() => onSelect?.('comments')}
        />
        <SheetRow
          label="Bookmarks"
          icon="bookmark-outline"
          accent="purple"
          onPress={() => onSelect?.('bookmarks')}
        />
        <SheetRow
          label="Move to notebook"
          icon="folder-open-outline"
          accent="green"
          onPress={() => onSelect?.('move')}
        />
        <SheetRow label="Tags" icon="pricetags-outline" accent="amber" onPress={() => onSelect?.('tags')} />
        <SheetRow
          label={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          icon="star-outline"
          accent="amber"
          onPress={() => onSelect?.('favorite')}
        />
        <SheetRow label="Archive note" icon="archive-outline" accent="teal" onPress={() => onSelect?.('archive')} />
        <SheetRow label="Share & export" icon="share-social-outline" accent="purple" onPress={() => onSelect?.('share')} />
        <SheetRow label="Make a copy" icon="copy-outline" accent="amber" onPress={() => onSelect?.('duplicate')} />
        <SheetRow
          label={isPinned ? 'Unpin from top' : 'Pin to top'}
          icon="pin-outline"
          accent="pink"
          onPress={() => onSelect?.('pin')}
        />
        <SheetRow label="Delete note" icon="trash-outline" danger onPress={() => onSelect?.('delete')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: { gap: spacing.md },
  group: { gap: spacing.sm, marginTop: spacing.sm },
  separator: { height: 1, backgroundColor: 'rgba(150,140,180,0.16)', marginVertical: spacing.xs },
  confirmCard: {
    marginTop: spacing.lg,
    backgroundColor: 'rgba(240,107,120,0.10)',
    borderColor: '#F06B78',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 16,
    padding: spacing.md,
  },
  confirmTitle: { marginBottom: 2 },
  confirmBody: { marginBottom: spacing.md },
  confirmActions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth * 2 },
  confirmSep: { width: 1, backgroundColor: 'rgba(240,107,120,0.35)' },
  confirmButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
