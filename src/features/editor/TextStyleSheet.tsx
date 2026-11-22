/**
 * "Style" and "Aa" sheet: block style, font size, text colour and highlight.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { AppText } from '@/components/AppText';
import { useColors } from '@/store/useSettingsStore';
import { radii, spacing } from '@/design/tokens';
import type { BlockStyle } from '@/types/editor';

const BLOCKS: { key: BlockStyle; label: string; size: number; weight: '500' | '600' | '700' }[] = [
  { key: 'paragraph', label: 'Paragraph', size: 15, weight: '500' },
  { key: 'h1', label: 'Heading 1', size: 24, weight: '700' },
  { key: 'h2', label: 'Heading 2', size: 20, weight: '700' },
  { key: 'h3', label: 'Heading 3', size: 17, weight: '600' },
  { key: 'quote', label: 'Quote', size: 15, weight: '500' },
  { key: 'code', label: 'Code block', size: 14, weight: '500' },
];

const SIZES: { label: string; value: string }[] = [
  { label: 'Small', value: '13px' },
  { label: 'Normal', value: '16px' },
  { label: 'Large', value: '19px' },
  { label: 'X-Large', value: '23px' },
];

const TEXT_COLORS = ['#151223', '#7C3AED', '#2563EB', '#059669', '#D97706', '#DC2626', '#DB2777', '#0D9488'];
const HIGHLIGHTS = ['#FEF08A', '#D9F99D', '#BFDBFE', '#FBCFE8', '#FDE68A', '#E9D5FF'];

interface TextStyleSheetProps {
  visible: boolean;
  onClose: () => void;
  currentBlock: BlockStyle;
  onBlock: (block: BlockStyle) => void;
  onFontSize: (value: string) => void;
  onTextColor: (hex: string) => void;
  onHighlight: (hex: string) => void;
}

export function TextStyleSheet({
  visible,
  onClose,
  currentBlock,
  onBlock,
  onFontSize,
  onTextColor,
  onHighlight,
}: TextStyleSheetProps) {
  const colors = useColors();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Text style" subtitle="Applies to the selected text">
      <View style={styles.blockList}>
        {BLOCKS.map((block) => (
          <Pressable
            key={block.key}
            accessibilityRole="button"
            accessibilityState={{ selected: currentBlock === block.key }}
            accessibilityLabel={block.label}
            onPress={() => onBlock(block.key)}
            style={({ pressed }) => [
              styles.blockRow,
              {
                backgroundColor:
                  currentBlock === block.key ? colors.primarySoft : pressed ? colors.surfaceMuted : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <AppText
              style={{
                fontSize: block.size,
                fontFamily: block.weight === '700' ? 'PlusJakartaSans_700Bold' : block.weight === '600' ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_500Medium',
                color: currentBlock === block.key ? colors.primary : colors.text,
              }}
            >
              {block.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      <AppText variant="overline" tone="muted" style={{ marginTop: spacing.md }}>
        Font size
      </AppText>
      <View style={styles.sizeRow}>
        {SIZES.map((size) => (
          <Pressable
            key={size.value}
            accessibilityRole="button"
            accessibilityLabel={`${size.label} text`}
            onPress={() => onFontSize(size.value)}
            style={({ pressed }) => [
              styles.sizeChip,
              { backgroundColor: pressed ? colors.surfaceSunken : colors.surfaceMuted, borderColor: colors.border },
            ]}
          >
            <AppText variant="caption">{size.label}</AppText>
          </Pressable>
        ))}
      </View>

      <AppText variant="overline" tone="muted" style={{ marginTop: spacing.md }}>
        Text color
      </AppText>
      <View style={styles.swatchRow}>
        {TEXT_COLORS.map((hex) => (
          <Pressable
            key={hex}
            accessibilityRole="button"
            accessibilityLabel={`Text color ${hex}`}
            onPress={() => onTextColor(hex)}
            style={[styles.swatch, { backgroundColor: hex }]}
          />
        ))}
      </View>

      <AppText variant="overline" tone="muted" style={{ marginTop: spacing.md }}>
        Highlight
      </AppText>
      <View style={styles.swatchRow}>
        {HIGHLIGHTS.map((hex) => (
          <Pressable
            key={hex}
            accessibilityRole="button"
            accessibilityLabel={`Highlight ${hex}`}
            onPress={() => onHighlight(hex)}
            style={[styles.swatch, { backgroundColor: hex }]}
          />
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  blockList: { gap: spacing.xs },
  blockRow: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sizeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  sizeChip: {
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  swatchRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
});
