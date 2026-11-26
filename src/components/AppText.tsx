/** Text component bound to the Notely type scale and colour tokens. */
import React from 'react';
import { Text, type TextProps } from 'react-native';
import { typeScale } from '@/design/typography';
import { useColors } from '@/store/useSettingsStore';

type Variant = keyof typeof typeScale;
type Tone = 'default' | 'secondary' | 'muted' | 'primary' | 'inverse' | 'danger' | 'success';

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  center?: boolean;
}

export const AppText = React.memo(function AppText({ variant = 'body', tone = 'default', center, style, ...rest }: AppTextProps) {
  const colors = useColors();
  const toneColor: Record<Tone, string> = {
    default: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    primary: colors.primary,
    inverse: colors.textInverse,
    danger: colors.danger,
    success: colors.success,
  };
  return (
    <Text
      {...rest}
      style={[typeScale[variant], { color: toneColor[tone] }, center && { textAlign: 'center' }, style]}
    />
  );
});
