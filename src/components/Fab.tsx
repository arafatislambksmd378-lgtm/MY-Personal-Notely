/**
 * Floating action button.
 *
 * Two shapes share one component so the visual identity stays consistent:
 *  - `circle`  (default) — the purple pencil used on notebook detail screens.
 *  - `rounded` — the purple rounded-square "+" used as the Home creation action.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/store/useSettingsStore';
import { shadows } from '@/design/tokens';

interface FabProps {
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
  /** `circle` keeps the classic pencil FAB; `rounded` is the square "+" action. */
  shape?: 'circle' | 'rounded';
  /** Fixed corner radius in dp (only used by the `rounded` shape). */
  radius?: number;
  accessibilityLabel?: string;
  testID?: string;
}

export function Fab({
  onPress,
  icon = 'pencil',
  size = 52,
  shape = 'circle',
  radius,
  accessibilityLabel = 'Create note',
  testID,
}: FabProps) {
  const colors = useColors();
  const borderRadius = shape === 'circle' ? size / 2 : (radius ?? Math.round(size * 0.32));
  const iconSize = shape === 'circle' ? size * 0.44 : size * 0.46;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        shadows.floating,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: colors.primary,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={colors.scheme === 'dark' ? '#151223' : '#FFFFFF'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
