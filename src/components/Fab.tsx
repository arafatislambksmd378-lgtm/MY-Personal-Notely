/** Floating action button (purple circle with a pencil), as on the Home screen. */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/store/useSettingsStore';
import { shadows } from '@/design/tokens';

interface FabProps {
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
  accessibilityLabel?: string;
  testID?: string;
}

export function Fab({ onPress, icon = 'pencil', size = 52, accessibilityLabel = 'Create note', testID }: FabProps) {
  const colors = useColors();
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
          borderRadius: size / 2,
          backgroundColor: colors.primary,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        },
      ]}
    >
      <Ionicons name={icon} size={size * 0.44} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
