import { Tabs } from 'expo-router';
import { TabBar, type NotelyTabBarProps } from '@/components/TabBar';

/**
 * expo-router 58 vendors its own bottom-tab implementation, so its `tabBar`
 * callback is typed against internal props. We render our own bar and narrow the
 * props to the structural subset the bar actually uses.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...(props as unknown as NotelyTabBarProps)} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="notebooks" options={{ title: 'Notebooks' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
