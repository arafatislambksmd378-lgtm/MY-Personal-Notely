/** Buttons in the reference language: 52pt tall, 16pt radius, bold labels. */
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { useColors } from '@/store/useSettingsStore';
import { radii, shadows, spacing } from '@/design/tokens';
import type { IoniconName } from './IconTile';

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IoniconName;
  trailingIcon?: IoniconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export const Button = React.memo(function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  trailingIcon,
  disabled,
  loading,
  fullWidth,
  style,
  testID,
}: ButtonProps) {
  const colors = useColors();
  const heights: Record<Size, number> = { sm: 40, md: 48, lg: 54 };
  const palette: Record<Variant, { bg: string; border: string; text: string }> = {
    primary: { bg: colors.primary, border: colors.primary, text: colors.onPrimary },
    secondary: { bg: colors.surface, border: colors.borderStrong, text: colors.text },
    soft: { bg: colors.primarySoft, border: 'transparent', text: colors.primary },
    ghost: { bg: 'transparent', border: 'transparent', text: colors.textSecondary },
    danger: { bg: colors.dangerSoft, border: 'transparent', text: colors.danger },
  };
  const theme = palette[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          backgroundColor: theme.bg,
          borderColor: theme.border,
          opacity: isDisabled ? 0.55 : pressed ? 0.9 : 1,
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.xl,
        },
        variant === 'primary' && shadows.card,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.text} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={theme.text} /> : null}
          <AppText
            variant={size === 'sm' ? 'caption' : 'button'}
            style={{ color: theme.text, fontFamily: 'PlusJakartaSans_700Bold' }}
          >
            {label}
          </AppText>
          {trailingIcon ? <Ionicons name={trailingIcon} size={17} color={theme.text} /> : null}
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fullWidth: { alignSelf: 'stretch' },
});
