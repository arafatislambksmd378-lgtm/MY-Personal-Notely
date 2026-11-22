/**
 * Insert sheet — reference layout: "Image / From gallery or camera" row followed
 * by a three-column grid of insert tools.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { AppText } from '@/components/AppText';
import { IconTile, type IoniconName } from '@/components/IconTile';
import { useColors } from '@/store/useSettingsStore';
import type { AccentName } from '@/design/tokens';
import { radii, spacing } from '@/design/tokens';

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

interface InsertSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (tool: InsertTool) => void;
  onInsertImage: (source: 'camera' | 'library') => void;
}

export function InsertSheet({ visible, onClose, onSelect, onInsertImage }: InsertSheetProps) {
  const colors = useColors();
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

      <View style={styles.grid}>
        {TOOLS.map((tool) => (
          <Pressable
            key={tool.key}
            accessibilityRole="button"
            accessibilityLabel={`${tool.label}. ${tool.subtitle}`}
            onPress={() => onSelect(tool.key)}
            style={({ pressed }) => [
              styles.tile,
              {
                backgroundColor: pressed ? colors.surfaceMuted : colors.canvas,
                borderColor: colors.border,
              },
            ]}
          >
            <IconTile name={tool.icon} accent={tool.accent} size="md" />
            <AppText variant="subtitle" numberOfLines={1} style={{ marginTop: spacing.sm }}>
              {tool.label}
            </AppText>
            <AppText variant="label" tone="muted" numberOfLines={2} center>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  tile: {
    width: '31.2%',
    minHeight: 104,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
});
