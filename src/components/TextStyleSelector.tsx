/**
 * Text Style Selector — compact horizontal card-based style chips.
 *
 * Appears directly below the FormatToolbar in the Rich Text Editor.
 * Each style is a rounded claymorphism card; tapping applies the block
 * style to the current selection / active editor block.
 *
 * Scrolls horizontally so all styles fit on narrow screens without
 * wrapping into multiple rows.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useColors } from '@/store/useSettingsStore';
import { radii, spacing } from '@/design/tokens';
import type { BlockStyle } from '@/types/editor';

type StyleChip = {
  key: BlockStyle | 'h4';
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const STYLES: StyleChip[] = [
  { key: 'paragraph', label: 'Normal Text', icon: 'text-outline' },
  { key: 'h1', label: 'Title', icon: 'document-outline' },
  { key: 'h2', label: 'Heading 2', icon: 'text-outline' },
  { key: 'h3', label: 'Heading 3', icon: 'text-outline' },
  { key: 'h4', label: 'Heading 4', icon: 'text-outline' },
  { key: 'quote', label: 'Quote', icon: 'chatbubble-outline' },
  { key: 'code', label: 'Code Block', icon: 'code-outline' },
];

interface TextStyleSelectorProps {
  currentBlock: BlockStyle;
  onBlock: (block: BlockStyle) => void;
}

export function TextStyleSelector({ currentBlock, onBlock }: TextStyleSelectorProps) {
  const colors = useColors();

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {STYLES.map((chip) => {
          const active = chip.key === currentBlock;
          return (
            <Pressable
              key={chip.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={chip.label}
              onPress={() => onBlock(chip.key as BlockStyle)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active
                    ? colors.primarySoft
                    : pressed
                      ? colors.surfaceMuted
                      : colors.canvas,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Ionicons
                name={chip.icon}
                size={16}
                color={active ? colors.primary : colors.textSecondary}
              />
              <AppText
                variant="caption"
                tone={active ? 'primary' : 'muted'}
                style={{ marginTop: 2 }}
              >
                {chip.label}
              </AppText>
            </Pressable>
          );
        })}
        {/* Spacer so the last card is fully visible and a partial next card hints at more. */}
        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  scrollContent: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    // Right padding so the final card can scroll fully into view with a
    // hint of the next card peeking in.
    paddingRight: spacing.md,
  },
  chip: {
    width: 88,
    height: 80,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  spacer: { width: spacing.md },
});
