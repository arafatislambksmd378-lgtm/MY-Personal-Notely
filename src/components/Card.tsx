/** Rounded white surface used across every screen of the reference design. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { useColors } from '@/store/useSettingsStore';
import { radii, shadows } from '@/design/tokens';

interface CardProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  padded?: boolean;
  elevation?: 'none' | 'card' | 'floating';
  accessibilityLabel?: string;
}

export function Card({ children, style, onPress, padded = true, elevation = 'card', accessibilityLabel }: CardProps) {
  const colors = useColors();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.border,
    padding: padded ? 16 : 0,
    ...(elevation === 'none' ? {} : shadows[elevation]),
  };
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [base, style, pressed && { opacity: 0.9, transform: [{ scale: 0.997 }] }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}
