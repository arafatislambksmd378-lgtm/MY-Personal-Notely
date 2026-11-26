/**
 * Formatting toolbar (reference: "Style ⌄ | B I U S A ✎" plus list/align/undo).
 * Every control dispatches a real editor command.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useColors } from '@/store/useSettingsStore';
import { radii, spacing } from '@/design/tokens';
import type { BlockStyle, EditorCommand, EditorSelectionInfo } from '@/types/editor';

const BLOCK_LABELS: Record<BlockStyle, string> = {
  paragraph: 'Paragraph',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  quote: 'Quote',
  code: 'Code',
};

interface FormatToolbarProps {
  selection: EditorSelectionInfo;
  onCommand: (command: EditorCommand) => void;
  onAlign: (align: 'left' | 'center' | 'right' | 'justify') => void;
  onOpenStyleSheet: () => void;
  onOpenColorSheet: () => void;
  onOpenLinkSheet: () => void;
  onSmallText: () => void;
}

interface ToolButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  active?: boolean;
  label: string;
  onPress: () => void;
  textLabel?: string;
  underline?: boolean;
}

function ToolButton({ icon, active, label, onPress, textLabel, underline }: ToolButtonProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(active) }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tool,
        {
          backgroundColor: active ? colors.primarySoft : pressed ? colors.surfaceMuted : 'transparent',
        },
      ]}
    >
      {textLabel ? (
        <AppText
          variant="subtitle"
          style={{
            color: active ? colors.primary : colors.text,
            textDecorationLine: underline ? 'underline' : 'none',
          }}
        >
          {textLabel}
        </AppText>
      ) : (
        <Ionicons name={icon} size={18} color={active ? colors.primary : colors.text} />
      )}
    </Pressable>
  );
}

export function FormatToolbar({
  selection,
  onCommand,
  onAlign,
  onOpenStyleSheet,
  onOpenColorSheet,
  onOpenLinkSheet,
  onSmallText,
}: FormatToolbarProps) {
  const colors = useColors();
  const nextAlign: Record<string, 'left' | 'center' | 'right' | 'justify'> = {
    left: 'center',
    center: 'right',
    right: 'justify',
    justify: 'left',
  };
  const alignIcon: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
    left: 'reorder-three-outline',
    center: 'menu-outline',
    right: 'reorder-two-outline',
    justify: 'reorder-four-outline',
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.canvas, borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Text style: ${BLOCK_LABELS[selection.block]}`}
          onPress={onOpenStyleSheet}
          style={({ pressed }) => [
            styles.styleChip,
            { backgroundColor: pressed ? colors.surfaceSunken : colors.surface, borderColor: colors.border },
          ]}
        >
          <AppText variant="caption" style={{ color: colors.textSecondary }}>
            Style
          </AppText>
          <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
        </Pressable>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <ToolButton icon="remove" textLabel="B" label="Bold" active={selection.bold} onPress={() => onCommand('bold')} />
        <ToolButton icon="remove" textLabel="I" label="Italic" active={selection.italic} onPress={() => onCommand('italic')} />
        <ToolButton
          icon="remove"
          textLabel="U"
          label="Underline"
          active={selection.underline}
          underline
          onPress={() => onCommand('underline')}
        />
        <ToolButton
          icon="remove"
          textLabel="S"
          label="Strike through"
          active={selection.strikeThrough}
          underline
          onPress={() => onCommand('strikeThrough')}
        />
        <ToolButton icon="color-fill-outline" label="Text color and highlight" onPress={onOpenColorSheet} />
        <ToolButton icon="text-outline" label="Font size" onPress={onSmallText} />

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <ToolButton icon="link-outline" label="Insert link" onPress={onOpenLinkSheet} />
        <ToolButton icon="list-outline" label="Bulleted list" onPress={() => onCommand('insertUnorderedList')} />
        <ToolButton icon="list-outline" label="Numbered list" onPress={() => onCommand('insertOrderedList')} />
        <ToolButton icon="return-down-forward-outline" label="Indent" onPress={() => onCommand('indent')} />
        <ToolButton icon="return-down-back-outline" label="Outdent" onPress={() => onCommand('outdent')} />
        <ToolButton
          icon={alignIcon[selection.align]}
          label={`Alignment: ${selection.align}`}
          onPress={() => onAlign(nextAlign[selection.align] ?? 'left')}
        />

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <ToolButton icon="arrow-undo-outline" label="Undo" onPress={() => onCommand('undo')} />
        <ToolButton icon="arrow-redo-outline" label="Redo" onPress={() => onCommand('redo')} />
        <ToolButton icon="remove-circle-outline" label="Clear formatting" onPress={() => onCommand('removeFormat')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  content: { alignItems: 'center', gap: 2, paddingHorizontal: spacing.md, paddingVertical: 6 },
  tool: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 6,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  divider: { width: 1, height: 20, marginHorizontal: 4 },
});
