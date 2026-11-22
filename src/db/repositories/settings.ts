/**
 * User settings. Persisted as a single JSON blob so new preference keys can be
 * added without a migration, merged over `defaultSettings` on read so old rows
 * never produce undefined values.
 */
import { getDatabase } from '../index';
import { defaultSettings, type UserSettings } from '@/types/models';
import { safeJsonParse } from '@/utils/validation';

const SETTINGS_KEY = 'app';

export async function getSettings(): Promise<UserSettings> {
  const db = await getDatabase();
  const row = await db.get<{ value: string }>('SELECT value FROM user_settings WHERE key = ?', [
    SETTINGS_KEY,
  ]);
  const stored = safeJsonParse<Partial<UserSettings>>(row?.value ?? null, {});
  return { ...defaultSettings, ...stored };
}

export async function updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const db = await getDatabase();
  const current = await getSettings();
  // PIN material never lands in the settings blob — it lives in secure storage.
  const { pinHash: _pinHash, pinSalt: _pinSalt, ...safePatch } = patch;
  const next: UserSettings = { ...current, ...safePatch, pinHash: null, pinSalt: null };
  await db.run(
    `INSERT INTO user_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [SETTINGS_KEY, JSON.stringify(next), new Date().toISOString()],
  );
  return next;
}

export async function resetSettings(): Promise<UserSettings> {
  const db = await getDatabase();
  await db.run('DELETE FROM user_settings WHERE key = ?', [SETTINGS_KEY]);
  return { ...defaultSettings };
}
