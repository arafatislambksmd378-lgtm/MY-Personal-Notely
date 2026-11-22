/**
 * Browser preview: there is no keystore, so the PIN hash is kept in
 * localStorage. This is development/preview-only — the Android build uses the
 * platform keystore (see secureStorage.native.ts).
 */
const PREFIX = 'notely.secret.';

export async function setSecret(key: string, value: string): Promise<void> {
  window.localStorage.setItem(`${PREFIX}${key}`, value);
}

export async function getSecret(key: string): Promise<string | null> {
  return window.localStorage.getItem(`${PREFIX}${key}`);
}

export async function deleteSecret(key: string): Promise<void> {
  window.localStorage.removeItem(`${PREFIX}${key}`);
}
