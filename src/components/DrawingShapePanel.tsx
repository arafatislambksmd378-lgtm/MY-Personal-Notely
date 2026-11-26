/**
 * Shape selection panel for the full-screen drawing editor.
 *
 * Opens as a popup inside the drawing editor when the Shape button is tapped.
 * Shows shape categories with selectable shapes.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useColors } from '@/store/useSettingsStore';
import { useDrawingStore, type DrawingShape } from '@/store/useDrawingStore';
import { radii, spacing } from '@/design/tokens';

const SHAPES: { key: DrawingShape; label: string; icon: string }[] = [
  { key: 'rectangle', label: 'Rectangle', icon: 'square-outline' },
  { key: 'rounded-rectangle', label: 'Rounded Rect', icon: 'square-outline' },
  { key: 'square', label: 'Square', icon: 'square-outline' },
  { key: 'circle', label: 'Circle', icon: 'circle-outline' },
  { key: 'oval', label: 'Oval', icon: 'ellipse' },
  { key: 'triangle', label: 'Triangle', icon: 'triangle' },
  { key: 'right-triangle', label: 'Right Triangle', icon: 'triangle' },
  { key: 'diamond', label: 'Diamond', icon: 'diamond' },
  { key: 'pentagon', label: 'Pentagon', icon: 'color-palette-outline' },
  { key: 'hexagon', label: 'Hexagon', icon: 'stopwatch' },
  { key: 'octagon', label: 'Octagon', icon: 'stopwatch' },
  { key: 'line', label: 'Line', icon: 'remove-outline' },
  { key: 'dashed-line', label: 'Dashed Line', icon: 'remove-outline' },
  { key: 'dotted-line', label: 'Dotted Line', icon: 'remove-outline' },
  { key: 'arrow', label: 'Arrow', icon: 'arrow-forward-outline' },
  { key: 'double-arrow', label: 'Double Arrow', icon: 'arrow-forward-outline' },
  { key: 'curved-arrow', label: 'Curved Arrow', icon: 'redo-outline' },
  { key: 'connector-line', label: 'Connector', icon: 'git-compare-outline' },
  { key: 'horizontal-line', label: 'Horizontal Line', icon: 'remove-outline' },
  { key: 'vertical-line', label: 'Vertical Line', icon: 'remove-outline' },
  { key: 'arc', label: 'Arc', icon: 'arrow-curved-outline' },
  { key: 'semicircle', label: 'Semicircle', icon: 'circle-outline' },
  { key: 'trapezoid', label: 'Trapezoid', icon: 'triangle' },
  { key: 'parallelogram', label: 'Parallelogram', icon: 'square-outline' },
  { key: 'star', label: 'Star', icon: 'star-outline' },
  { key: 'cross', label: 'Cross', icon: 'medical-outline' },
  { key: 'plus', label: 'Plus', icon: 'add-outline' },
  { key: 'minus', label: 'Minus', icon: 'remove-outline' },
  { key: 'bracket', label: 'Bracket', icon: 'code-working-outline' },
  { key: 'brace', label: 'Brace', icon: 'code-working-outline' },
  { key: 'process', label: 'Process', icon: 'square-outline' },
  { key: 'decision', label: 'Decision', icon: 'help-circle-outline' },
  { key: 'input-output', label: 'Input/Output', icon: 'paper-outline' },
  { key: 'start-end', label: 'Start/End', icon: 'circle-outline' },
  { key: 'document', label: 'Document', icon: 'document-text-outline' },
  { key: 'database', label: 'Database', icon: 'database' },
  { key: 'flow-connector', label: 'Flow Connector', icon: 'git-compare-outline' },
];

interface DrawingShapePanelProps {
  visible: boolean;
  onClose: () => void;
  onShapeSelect: (shape: DrawingShape) => void;
}

export function DrawingShapePanel({
  visible,
  onClose,
  onShapeSelect,
}: DrawingShapePanelProps) {
  const colors = useColors();
  const { shape: activeShape, setShape } = useDrawingStore();

  return (
    <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close shape panel"
        onPress={onClose}
        style={StyleSheet.absoluteFill}
      />
        <View
          style={[
            styles.panel,
            { borderColor: colors.border },
          ]}
        >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
          <AppText variant="title3">Shape</AppText>
          <View style={{ width: 34 }} />
        </View>
        <View style={styles.grid}>
          {SHAPES.map((s) => {
            const active = s.key === activeShape;
            return (
              <Pressable
                key={s.key}
                accessibilityRole="button"
                accessibilityLabel={s.label}
                onPress={() => {
                  setShape(s.key);
                  onShapeSelect(s.key);
                }}
                style={[
                  styles.shapeBtn,
                  {
                    backgroundColor: active
                      ? colors.primarySoft
                      : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={s.icon as React.ComponentProps<typeof Ionicons>['name']}
                  size={18}
                  color={active ? colors.primary : colors.textSecondary}
                />
                <AppText variant="caption" tone={active ? 'primary' : 'muted'}>
                  {s.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  panel: {
    width: '90%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#ECEAF1',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1EFF8',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    maxHeight: '70%',
  },
  shapeBtn: {
    width: 64,
    height: 74,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
});
