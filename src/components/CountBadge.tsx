/** Small count pill used on notebook rows and note cards. */
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { useColors } from '@/store/useSettingsStore';
import { accentSoft, radii, type AccentName } from '@/design/tokens';
import { accentColor } from './IconTile';

interface CountBadgeProps {
  count: number;
  accent?: AccentName;
}

export function CountBadge({ count, accent = 'purple' }: CountBadgeProps) {
  const colors = useColors();
  return (
    <View style={[styles.badge, { backgroundColor: colors.scheme === 'dark' ? colors.surfaceMuted : accentSoft[accent] }]}>
      <AppText variant="label" style={{ color: accentColor(accent) }}>
        {count}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { minWidth: 26, height: 24, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
});
