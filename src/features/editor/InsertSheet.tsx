/**
 * Insert sheet — reference layout: "Image / From gallery or camera" row followed
 * by a compact three-column grid of insert tools.
 *
 * The tile width is measured from the grid container rather than expressed as a
 * percentage. A percentage width cannot account for the flex `gap`, so the
 * previous `31.2%` tiles (3 × 31.2% + 2 × 12pt = 93.6% + 24pt) never fitted three
 * across on a phone and wrapped to two columns. Computing
 * `(containerWidth - 2 × gap) / 3` guarantees exactly three columns at every
 * width that can hold them, with no horizontal overflow.
 */
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { AppText } from '@/components/AppText';
import { IconTile, type IoniconName } from '@/components/IconTile';
import { useColors } from '@/store/useSettingsStore';
import type { AccentName } from '@/design/tokens';
import { radii, spacing } from '@/design/tokens';
import { tileWidth } from '@/utils/grid';

export type InsertTool =
  | 'table'
  | 'drawing'
  | 'chart'
  | 'link'
  | 'comment'
  | 'divider'
  | 'footnote'
  | 'symbols'
  | 'equation'
  | 'contents'
  | 'bookmark'
  | 'scan';

const TOOLS: { key: InsertTool; label: string; subtitle: string; icon: IoniconName; accent: AccentName }[] = [
  { key: 'scan', label: 'Scan', subtitle: 'Camera + OCR', icon: 'scan-outline', accent: 'teal' },
  { key: 'table', label: 'Table', subtitle: 'Rows & columns', icon: 'grid-outline', accent: 'purple' },
  { key: 'drawing', label: 'Drawing', subtitle: 'Sketch & ink', icon: 'brush-outline', accent: 'blue' },
  { key: 'chart', label: 'Chart', subtitle: 'Graphs from data', icon: 'bar-chart-outline', accent: 'green' },
  { key: 'link', label: 'Link', subtitle: 'Hyperlink text', icon: 'link-outline', accent: 'amber' },
  { key: 'comment', label: 'Comment', subtitle: 'Side note on text', icon: 'chatbubble-outline', accent: 'pink' },
  { key: 'divider', label: 'Divider', subtitle: 'Horizontal line', icon: 'remove-outline', accent: 'teal' },
  { key: 'footnote', label: 'Footnote', subtitle: 'Bottom reference', icon: 'information-circle-outline', accent: 'purple' },
  { key: 'symbols', label: 'Symbols', subtitle: 'π ∞ ÷ ∑', icon: 'shapes-outline', accent: 'blue' },
  { key: 'equation', label: 'Equation', subtitle: 'Math & science', icon: 'calculator-outline', accent: 'green' },
  { key: 'contents', label: 'Contents', subtitle: 'Auto from headings', icon: 'list-outline', accent: 'amber' },
  { key: 'bookmark', label: 'Bookmark', subtitle: 'Save position', icon: 'bookmark-outline', accent: 'pink' },
];

/** Horizontal gap between tiles. Kept in one place so the width math cannot drift. */
const GRID_GAP = spacing.md;
/** Number of feature tiles per row on every width that can hold them. */
const GRID_COLUMNS = 3;

interface InsertSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (tool: InsertTool) => void;
  onInsertImage: (source: 'camera' | 'library') => void;
}

export function InsertSheet({ visible, onClose, onSelect, onInsertImage }: InsertSheetProps) {
  const colors = useColors();
  const { width: windowWidth } = useWindowDimensions();
  const [gridWidth, setGridWidth] = useState(0);

  // The sheet content is inset by `spacing.xl` on both sides; use that as the
  // measurement fallback so the very first frame already lays out correctly.
  const measured = gridWidth > 0 ? gridWidth : Math.max(0, windowWidth - spacing.xl * 2);
  const tile = tileWidth(measured, GRID_COLUMNS, GRID_GAP);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Insert" testID="insert-sheet">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Insert image from gallery or camera"
        onPress={() => onInsertImage('library')}
        style={({ pressed }) => [
          styles.imageRow,
          { backgroundColor: pressed ? colors.surfaceMuted : colors.canvas, borderColor: colors.border },
        ]}
      >
        <IconTile name="image" accent="pink" size="lg" />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">Image</AppText>
          <AppText variant="caption" tone="muted">
            From gallery or camera
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
          onPress={() => onInsertImage('camera')}
          hitSlop={8}
          style={[styles.cameraButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="camera-outline" size={17} color={colors.textSecondary} />
        </Pressable>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      <View
        style={styles.grid}
        onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
        testID="insert-grid"
      >        {TOOLS.map((tool) => (
          <Pressable
            key={tool.key}
            accessibilityRole="button"
            accessibilityLabel={`${tool.label}. ${tool.subtitle}`}
            onPress={() => onSelect(tool.key)}
            testID={`insert-tool-${tool.key}`}
            style={({ pressed }) => [
              styles.tile,
              {
                width: tile,
                backgroundColor: pressed ? colors.surfaceMuted : colors.canvas,
                borderColor: colors.border,
              },
            ]}
          >
            <IconTile name={tool.icon} accent={tool.accent} size="compact" />
            <AppText variant="subtitle" numberOfLines={1} style={styles.tileLabel}>
              {tool.label}
            </AppText>
            <AppText variant="label" tone="muted" numberOfLines={1} style={styles.tileHint}>
              {tool.subtitle}
            </AppText>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  imageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.md,
  },
  cameraButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // The gap is part of the width calculation above, so the two must match.
    gap: GRID_GAP,
    marginTop: spacing.xs,
    // Keep three sensible tiles on tablets/desktop instead of stretching them
    // across the full sheet width.
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  tile: {
    minHeight: 96,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.sm + 2,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  tileLabel: { marginTop: spacing.sm, width: '100%' },
  tileHint: { marginTop: 1, width: '100%' },
});
