/**
 * Soft-squared icon container from the reference screens
 * (10% accent background + accent glyph).
 */
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { accentSoft, radii, type AccentName } from '@/design/tokens';
import { useColors } from '@/store/useSettingsStore';

export type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface IconTileProps {
  name: IoniconName;
  accent?: AccentName;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
  filled?: boolean;
}

const SIZES = {
  sm: { box: 32, icon: 15, radius: radii.sm },
  md: { box: 40, icon: 19, radius: radii.md },
  lg: { box: 48, icon: 23, radius: radii.md + 2 },
  xl: { box: 56, icon: 27, radius: radii.lg },
} as const;

export function IconTile({ name, accent = 'purple', size = 'md', style, filled }: IconTileProps) {
  const colors = useColors();
  const dims = SIZES[size];
  const tint = accentSoft[accent];
  return (
    <View
      style={[
        styles.base,
        {
          width: dims.box,
          height: dims.box,
          borderRadius: dims.radius,
          backgroundColor: filled ? tint : colors.scheme === 'dark' ? colors.surfaceMuted : tint,
        },
        style,
      ]}
    >
      <Ionicons name={name} size={dims.icon} color={accentColor(accent)} />
    </View>
  );
}

/** Solid accent for glyphs; a touch darker than the tint background for contrast. */
export function accentColor(accent: AccentName): string {
  const map: Record<AccentName, string> = {
    purple: '#7C3AED',
    blue: '#2563EB',
    green: '#059669',
    amber: '#D97706',
    pink: '#DB2777',
    teal: '#0D9488',
    orange: '#EA580C',
    red: '#DC2626',
  };
  return map[accent];
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
});
