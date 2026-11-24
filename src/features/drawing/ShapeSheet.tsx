/**
 * Shape selection sheet for the drawing editor.
 *
 * Four categories, four tiles per row. Selecting a shape arms it and closes the
 * sheet; the user then drags on the canvas to place it. Every entry maps to a
 * real shape kind handled by the canvas engine.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { AppText } from '@/components/AppText';
import { IconTile } from '@/components/IconTile';
import { useColors } from '@/store/useSettingsStore';
import { radii, spacing } from '@/design/tokens';
import { SHAPES, SHAPE_CATEGORIES, type ShapeDefinition } from './shapeCatalog';
import { chunkIntoRows } from '@/utils/grid';
import type { ShapeKind } from './types';

const COLUMNS = 4;

function ShapeRow({ shapes, onSelect }: { shapes: ShapeDefinition[]; onSelect: (kind: ShapeKind) => void }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      {shapes.map((shape) => (
        <Pressable
          key={shape.kind}
          accessibilityRole="button"
          accessibilityLabel={shape.label}
          onPress={() => onSelect(shape.kind)}
          testID={`shape-${shape.kind}`}
          style={({ pressed }) => [
            styles.tile,
            {
              backgroundColor: pressed ? colors.primarySoft : colors.surface,
              borderColor: pressed ? colors.primary : colors.border,
            },
          ]}
        >
          <IconTile name={shape.icon} accent="purple" size="sm" />
          <AppText variant="label" tone="secondary" numberOfLines={1} style={styles.label}>
            {shape.label}
          </AppText>
        </Pressable>
      ))}
      {shapes.length < COLUMNS
        ? Array.from({ length: COLUMNS - shapes.length }, (_, index) => (
            <View key={`spacer-${index}`} style={styles.spacer} />
          ))
        : null}
    </View>
  );
}

interface ShapeSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (shape: ShapeKind) => void;
}

export function ShapeSheet({ visible, onClose, onSelect }: ShapeSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Shapes"
      subtitle="Pick a shape, then drag on the canvas to draw it"
      testID="shape-sheet"
    >
      {SHAPE_CATEGORIES.map((category) => {
        const shapes = SHAPES.filter((shape) => shape.category === category.id);
        const rows = chunkIntoRows(shapes, COLUMNS);
        return (
          <View key={category.id} style={{ marginBottom: spacing.sm }}>
            <AppText variant="overline" tone="muted" style={{ marginBottom: spacing.sm }}>
              {category.title}
            </AppText>
            <View style={{ gap: spacing.sm }}>
              {rows.map((row, rowIndex) => (
                <ShapeRow
                  key={`${category.id}-${rowIndex}`}
                  shapes={row}
                  onSelect={(kind) => {
                    onSelect(kind);
                    onClose();
                  }}
                />
              ))}
            </View>
          </View>
        );
      })}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 66,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  label: { width: '100%', textAlign: 'center' },
  spacer: { flex: 1 },
});
