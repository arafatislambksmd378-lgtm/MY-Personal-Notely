/**
 * Key/value storage for secrets (PIN hash + salt).
 * Metro resolves the .native/.web implementation at build time.
 */
export async function setSecret(key: string, value: string): Promise<void> {
  throw new Error(`Secure storage unavailable for ${key}`);
}

export async function getSecret(key: string): Promise<string | null> {
  throw new Error(`Secure storage unavailable for ${key}`);
}

export async function deleteSecret(key: string): Promise<void> {
  throw new Error(`Secure storage unavailable for ${key}`);
}
