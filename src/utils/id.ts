/**
 * Identifier generation. Uses `crypto.getRandomValues` when available (web,
 * Hermes with the polyfill) and falls back to a time + Math.random composite so
 * that offline devices can still create stable unique ids.
 */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoRef = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (cryptoRef?.getRandomValues) {
    cryptoRef.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/** Time-sortable, URL-safe identifier (ULID-like, 26 chars). */
export function createId(prefix?: string): string {
  const time = Date.now();
  let timePart = '';
  let remaining = time;
  for (let i = 0; i < 10; i += 1) {
    timePart = ALPHABET[remaining % 36] + timePart;
    remaining = Math.floor(remaining / 36);
  }
  const bytes = randomBytes(16);
  let randomPart = '';
  for (let i = 0; i < 16; i += 1) {
    randomPart += ALPHABET[bytes[i] % 36];
  }
  const id = `${timePart}${randomPart}`;
  return prefix ? `${prefix}_${id}` : id;
}

export function shortId(): string {
  return createId().slice(-8);
}
