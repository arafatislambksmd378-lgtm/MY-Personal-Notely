/**
 * Horizontal color palette for the drawing editor.
 *
 * Shows black, purple, blue, green, yellow, red, pink, teal plus a custom
 * color option. Tapping sets the active drawing color.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useColors } from '@/store/useSettingsStore';
import { useDrawingStore } from '@/store/useDrawingStore';
import { radii, spacing } from '@/design/tokens';

const COLORS: { name: string; hex: string }[] = [
  { name: 'Black', hex: '#24232B' },
  { name: 'Purple', hex: '#8950F5' },
  { name: 'Blue', hex: '#438CEB' },
  { name: 'Green', hex: '#39B980' },
  { name: 'Yellow', hex: '#F2C94C' },
  { name: 'Red', hex: '#EF4444' },
  { name: 'Pink', hex: '#EC4899' },
  { name: 'Teal', hex: '#14B8A6' },
];

interface DrawingColorPaletteProps {
  onColorChange: (hex: string) => void;
}

export function DrawingColorPalette({ onColorChange }: DrawingColorPaletteProps) {
  const colors = useColors();
  const { color: activeColor, setColor } = useDrawingStore();

  return (
    <View style={styles.palette}>
      {COLORS.map((c) => {
        const active = c.hex === activeColor;
        return (
          <Pressable
            key={c.name}
            accessibilityRole="button"
            accessibilityLabel={c.name}
            onPress={() => {
              setColor(c.hex);
              onColorChange(c.hex);
            }}
            style={[
              styles.swatch,
              {
                backgroundColor: c.hex,
                borderColor: active ? '#FFFFFF' : 'transparent',
                borderWidth: active ? 3 : 0,
              },
            ]}
          >
            {active && (
              <Ionicons name="checkmark" size={14} color="#FFFFFF" />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    justifyContent: 'center',
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
});
