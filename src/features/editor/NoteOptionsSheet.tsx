/**
 * Note options sheet — card colours, page setup, review tools and note actions
 * in the order of the reference screenshots.
 */
import { StyleSheet, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { AppText } from '@/components/AppText';
import { SheetRow } from '@/components/SheetRow';
import { ColorSwatchRow } from '@/components/ColorSwatchRow';
import type { AccentName } from '@/design/tokens';
import { spacing } from '@/design/tokens';

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

interface NoteOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
  cardColor: AccentName;
  onCardColorChange: (color: AccentName) => void;
  onSelect: (option: NoteOption) => void;
  isPinned: boolean;
  isFavorite?: boolean;
}

export function NoteOptionsSheet({
  visible,
  onClose,
  cardColor,
  onCardColorChange,
  onSelect,
  isPinned,
  isFavorite = false,
}: NoteOptionsSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Note options" testID="note-options-sheet">
      <AppText variant="overline" tone="muted">
        Card color
      </AppText>
      <ColorSwatchRow value={cardColor} onChange={onCardColorChange} />

      <View style={styles.group}>
        <SheetRow label="Page setup" icon="document-outline" accent="blue" onPress={() => onSelect('page-setup')} />
        <SheetRow label="Find and replace" icon="search-outline" accent="purple" onPress={() => onSelect('find-replace')} />
        <SheetRow label="Word count" icon="text-outline" accent="green" onPress={() => onSelect('word-count')} />
        <SheetRow label="Spelling and grammar" icon="checkmark-done-outline" accent="amber" onPress={() => onSelect('spelling')} />
        <SheetRow label="Version history" icon="time-outline" accent="pink" onPress={() => onSelect('versions')} />
      </View>

      <View style={[styles.separator]} />

      <View style={styles.group}>
        <SheetRow label="Comments" icon="chatbubble-outline" accent="blue" onPress={() => onSelect('comments')} />
        <SheetRow label="Bookmarks" icon="bookmark-outline" accent="purple" onPress={() => onSelect('bookmarks')} />
        <SheetRow label="Move to notebook" icon="folder-open-outline" accent="green" onPress={() => onSelect('move')} />
        <SheetRow label="Tags" icon="pricetags-outline" accent="amber" onPress={() => onSelect('tags')} />
        <SheetRow
          label={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          icon="star-outline"
          accent="amber"
          onPress={() => onSelect('favorite')}
        />
        <SheetRow label="Archive note" icon="archive-outline" accent="teal" onPress={() => onSelect('archive')} />
        <SheetRow label="Share & export" icon="share-social-outline" accent="purple" onPress={() => onSelect('share')} />
        <SheetRow label="Make a copy" icon="copy-outline" accent="amber" onPress={() => onSelect('duplicate')} />
        <SheetRow
          label={isPinned ? 'Unpin from top' : 'Pin to top'}
          icon="pin-outline"
          accent="pink"
          onPress={() => onSelect('pin')}
        />
        <SheetRow label="Delete note" icon="trash-outline" danger onPress={() => onSelect('delete')} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm, marginTop: spacing.sm },
  separator: { height: 1, backgroundColor: 'rgba(150,140,180,0.16)', marginVertical: spacing.xs },
});
