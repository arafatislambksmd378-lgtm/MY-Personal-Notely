/** Static application configuration. */
export const APP_CONFIG = {
  name: 'Notely',
  version: '1.0.0',
  buildLabel: 'Premium notes · v1.0.0',
  autosaveDefaultDelayMs: 1200,
  versionSnapshotIntervalMs: 60_000,
  maxVersionsPerDocument: 100,
  maxImageBytes: 4 * 1024 * 1024,
  pinLength: { min: 4, max: 8 },
  supportEmail: 'support@notely.app',
  /** Cloud sync is dormant until Supabase credentials are supplied. */
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
} as const;

export const isCloudConfigured = Boolean(APP_CONFIG.supabaseUrl && APP_CONFIG.supabaseAnonKey);
