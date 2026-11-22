import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';

/**
 * expo-router 58 vendors its own bottom-tab implementation and its `tabBar`
 * props are internal. `TabBar` therefore renders itself from the current route
 * (see `src/components/TabBar.tsx`) and needs no props at all.
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={() => <TabBar />}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="notebooks" options={{ title: 'Notebooks' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
