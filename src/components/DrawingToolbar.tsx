/**
 * Vertical drawing tool toolbar.
 *
 * Selection / Brush / Highlighter / Eraser / Shape / Undo / Redo / Clear.
 * Tapping a tool sets the active tool in the drawing store.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useColors } from '@/store/useSettingsStore';
import { useDrawingStore } from '@/store/useDrawingStore';
import { radii, spacing } from '@/design/tokens';

type DrawingToolIcon = {
  key: 'select' | 'brush' | 'highlighter' | 'eraser' | 'shape' | 'undo' | 'redo' | 'clear';
  label: string;
  icon: string;
  activeColor: string;
};

const TOOLS: DrawingToolIcon[] = [
  { key: 'select', label: 'Select', icon: 'arrow-down', activeColor: '#438CEB' },
  { key: 'brush', label: 'Brush', icon: 'brush-outline', activeColor: '#8950F5' },
  { key: 'highlighter', label: 'Highlighter', icon: 'brush', activeColor: '#39B980' },
  { key: 'eraser', label: 'Eraser', icon: 'trash-outline', activeColor: '#EF4444' },
  { key: 'shape', label: 'Shape', icon: 'square-outline', activeColor: '#F2C94C' },
  { key: 'undo', label: 'Undo', icon: 'undo-outline', activeColor: '#8950F5' },
  { key: 'redo', label: 'Redo', icon: 'redo-outline', activeColor: '#8950F5' },
  { key: 'clear', label: 'Clear', icon: 'trash-outline', activeColor: '#EF4444' },
];

interface DrawingToolbarProps {
  onShapeSelect: () => void;
  onInsert: () => void;
}

export function DrawingToolbar({ onShapeSelect, onInsert }: DrawingToolbarProps) {
  const colors = useColors();
  const { tool, setTool } = useDrawingStore();

  return (
    <View style={styles.toolbar}>
      {TOOLS.map((t) => {
        const active = tool === t.key;
        const isShape = t.key === 'shape';
        return (
          <Pressable
            key={t.key}
            accessibilityRole="button"
            accessibilityLabel={t.label}
            onPress={() => {
              if (isShape) {
                onShapeSelect();
              } else if (t.key === 'undo') {
                // Undo handled via store
              } else if (t.key === 'redo') {
                // Redo handled via store
              } else if (t.key === 'clear') {
                // Clear handled via store
              } else {
                setTool(t.key);
              }
            }}
            style={({ pressed }) => [
              styles.toolBtn,
              {
                backgroundColor: active
                  ? colors.primarySoft
                  : pressed
                    ? colors.surfaceMuted
                    : 'transparent',
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons
              name={t.icon as React.ComponentProps<typeof Ionicons>['name']}
              size={20}
              color={active ? colors.primary : colors.textSecondary}
            />
            <AppText variant="caption" tone={active ? 'primary' : 'muted'}>
              {t.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  toolBtn: {
    width: 52,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
