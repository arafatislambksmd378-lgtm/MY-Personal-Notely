/**
 * Bottom-tab route table.
 *
 * Kept free of React Native imports so the focus logic can be unit-tested in
 * Node. The tab bar derives the active tab from the current pathname instead of
 * from the props expo-router injects into a custom `tabBar` renderer: on
 * Android, tapping a tab used to throw `Cannot read property 'emit' of
 * undefined` because those props no longer carry a `navigation` object, which
 * crashed the app. See docs/evidence/cloud-sync-live.md for the device run that
 * caught it.
 */
export type TabIconName =
  | 'home'
  | 'home-outline'
  | 'albums'
  | 'albums-outline'
  | 'settings'
  | 'settings-outline';

export interface TabRoute {
  name: string;
  /** expo-router href used by `router.navigate`. */
  href: string;
  label: string;
  icon: TabIconName;
  iconOutline: TabIconName;
}

export const TAB_ROUTES: TabRoute[] = [
  { name: 'index', href: '/', label: 'Home', icon: 'home', iconOutline: 'home-outline' },
  { name: 'notebooks', href: '/notebooks', label: 'Notebook', icon: 'albums', iconOutline: 'albums-outline' },
  { name: 'settings', href: '/settings', label: 'Setting', icon: 'settings', iconOutline: 'settings-outline' },
];

/**
 * Maps a pathname to the index of the tab that should look active.
 * Nested routes (`/settings/backup`, `/notebook/abc`) keep their parent lit.
 */
export function activeTabIndex(pathname: string | null | undefined): number {
  if (!pathname || pathname === '/') return 0;
  const clean = pathname.split('?')[0];
  const match = TAB_ROUTES.findIndex(
    (route) => route.href !== '/' && (clean === route.href || clean.startsWith(`${route.href}/`)),
  );
  return match === -1 ? 0 : match;
}

/** True when tapping this tab should actually navigate. */
export function shouldNavigateToTab(index: number, pathname: string | null | undefined): boolean {
  return index !== activeTabIndex(pathname);
}
