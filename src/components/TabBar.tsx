/** Custom bottom navigation matching the reference: white bar, purple active item. */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';

import { useColors } from '@/store/useSettingsStore';
import { fontFamily } from '@/design/typography';
import { spacing } from '@/design/tokens';
import { TAB_ROUTES, activeTabIndex, shouldNavigateToTab } from '@/utils/tabRoutes';

/**
 * Renders itself from the current route rather than from the props expo-router
 * passes to a custom `tabBar`.
 *
 * The previous version called `navigation.emit(...)` on injected props. In this
 * expo-router build those props do not include `navigation`, so every tab tap
 * threw `TypeError: Cannot read property 'emit' of undefined` and took the
 * process down with it (reproduced on the emulator, logcat shows
 * `onPress@1:…` → `_performTransitionSideEffects`). Reading the pathname and
 * navigating with the router keeps the bar independent of that internal shape.
 */
export function TabBar() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const activeIndex = activeTabIndex(pathname);

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
      {TAB_ROUTES.map((route, index) => {
        const focused = activeIndex === index;
        const tint = focused ? colors.primary : colors.textMuted;
        return (
          <Pressable
            key={route.name}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={route.label}
            onPress={() => {
              if (shouldNavigateToTab(index, pathname)) router.navigate(route.href);
            }}
            style={styles.item}
            testID={`tab-${route.name}`}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name={focused ? route.icon : route.iconOutline} size={22} color={tint} />
            </View>
            <Text style={[styles.label, { color: tint }]}>{route.label}</Text>
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
