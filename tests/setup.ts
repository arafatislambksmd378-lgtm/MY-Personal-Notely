/** Globals provided by the Expo/Metro runtime that Node tests must stub. */
(globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
(globalThis as unknown as { ExpoModulesCore?: unknown }).ExpoModulesCore = {};
