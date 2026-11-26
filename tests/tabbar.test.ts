/**
 * Regression tests for the bottom tab bar.
 *
 * The device run caught a crash on every tab tap: the bar called
 * `navigation.emit(...)` on props that expo-router no longer passes, so
 * `navigation` was undefined. `TabBar` now derives the active tab from the
 * pathname and navigates through the router, which this file pins down.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { TAB_ROUTES, activeTabIndex, shouldNavigateToTab } from '@/utils/tabRoutes';

describe('tab routes', () => {
  it('exposes the four tabs in order', () => {
    expect(TAB_ROUTES.map((route) => route.label)).toEqual([
      'Home',
      'Notebooks',
      'Code Workspace',
      'Settings',
    ]);
    expect(TAB_ROUTES.map((route) => route.href)).toEqual([
      '/',
      '/notebooks',
      '/code-workspace',
      '/settings',
    ]);
  });

  it('has a filled and an outline icon for each tab', () => {
    for (const route of TAB_ROUTES) {
      expect(route.icon).not.toBe(route.iconOutline);
      expect(route.iconOutline.endsWith('-outline')).toBe(true);
    }
  });

  it('lights Home for the root and for unknown nested routes', () => {
    expect(activeTabIndex('/')).toBe(0);
    expect(activeTabIndex('')).toBe(0);
    expect(activeTabIndex(null)).toBe(0);
    expect(activeTabIndex('/note/abc')).toBe(0);
  });

  it('keeps the parent tab lit on nested screens', () => {
    expect(activeTabIndex('/notebooks')).toBe(1);
    expect(activeTabIndex('/notebook/notebook-1')).toBe(0);
    expect(activeTabIndex('/code-workspace')).toBe(2);
    expect(activeTabIndex('/code-workspace/file/xyz')).toBe(2);
    expect(activeTabIndex('/settings')).toBe(3);
    expect(activeTabIndex('/settings/backup')).toBe(3);
    expect(activeTabIndex('/settings/cloud')).toBe(3);
  });

  it('ignores query strings and trailing slashes', () => {
    expect(activeTabIndex('/notebooks?filter=pinned')).toBe(1);
    expect(activeTabIndex('/settings/')).toBe(3);
  });

  it('only navigates when the tapped tab is not already active', () => {
    expect(shouldNavigateToTab(1, '/')).toBe(true);
    expect(shouldNavigateToTab(1, '/notebooks')).toBe(false);
    expect(shouldNavigateToTab(2, '/code-workspace')).toBe(false);
    expect(shouldNavigateToTab(3, '/settings/cloud')).toBe(false);
    expect(shouldNavigateToTab(0, '/settings')).toBe(true);
  });
});

describe('tab bar source', () => {
  const raw = readFileSync(resolve(__dirname, '../src/components/TabBar.tsx'), 'utf8');
  // Comments explain the old bug; only executable code matters here.
  const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('does not call emit on injected navigation props', () => {
    // The exact line that crashed the app on device.
    expect(source).not.toMatch(/navigation\s*\.\s*emit/);
    expect(source).not.toMatch(/NotelyTabBarProps/);
  });

  it('navigates with the expo-router router and reads the pathname', () => {
    expect(source).toMatch(/usePathname/);
    expect(source).toMatch(/useRouter/);
  });

  it('keeps the gesture area clear with a safe-area bottom inset', () => {
    expect(source).toMatch(/insets\.bottom/);
  });
});
