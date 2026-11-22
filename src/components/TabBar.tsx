/** Custom bottom navigation matching the reference: white bar, purple active item. */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/store/useSettingsStore';
import { fontFamily } from '@/design/typography';
import { spacing } from '@/design/tokens';

const ICONS: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap; label: string }> = {
  index: { active: 'home', inactive: 'home-outline', label: 'Home' },
  notebooks: { active: 'albums', inactive: 'albums-outline', label: 'Notebooks' },
  settings: { active: 'settings', inactive: 'settings-outline', label: 'Settings' },
};

/**
 * Minimal structural subset of expo-router's vendored BottomTabBarProps.
 * Declared locally so the app does not depend on a specific navigation package
 * build while still being fully typed at the call site.
 */
export interface NotelyTabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: Record<string, unknown>) => void;
  };
}

export function TabBar({ state, navigation }: NotelyTabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route: { key: string; name: string }, index: number) => {
        const meta = ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline', label: route.name };
        const focused = state.index === index;
        const tint = focused ? colors.primary : colors.textMuted;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={styles.item}
            testID={`tab-${route.name}`}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name={focused ? meta.active : meta.inactive} size={22} color={tint} />
            </View>
            <Text style={[styles.label, { color: tint }]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingTop: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  iconWrapper: { height: 24, justifyContent: 'center' },
  label: { fontFamily: fontFamily.semibold, fontSize: 11, letterSpacing: 0.1 },
});
