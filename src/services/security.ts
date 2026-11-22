/**
 * App lock: PIN hashing (salted SHA-256, never the raw PIN) plus optional
 * biometric unlock through expo-local-authentication.
 */
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { deleteSecret, getSecret, setSecret } from './secureStorage';
import { APP_CONFIG } from '@/config/app';

const PIN_HASH_KEY = 'notely.pin.hash';
const PIN_SALT_KEY = 'notely.pin.salt';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${APP_CONFIG.pinLength.min},${APP_CONFIG.pinLength.max}}$`).test(pin);
}

async function digest(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}:notely`);
}

export async function setPin(pin: string): Promise<void> {
  if (!isValidPin(pin)) {
    throw new Error(`PIN must be ${APP_CONFIG.pinLength.min}-${APP_CONFIG.pinLength.max} digits.`);
  }
  const salt = toHex(await Crypto.getRandomBytesAsync(16));
  const hash = await digest(pin, salt);
  await setSecret(PIN_SALT_KEY, salt);
  await setSecret(PIN_HASH_KEY, hash);
}

export async function hasPin(): Promise<boolean> {
  const hash = await getSecret(PIN_HASH_KEY).catch(() => null);
  return Boolean(hash);
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (!isValidPin(pin)) return false;
  const [salt, stored] = await Promise.all([
    getSecret(PIN_SALT_KEY).catch(() => null),
    getSecret(PIN_HASH_KEY).catch(() => null),
  ]);
  if (!salt || !stored) return false;
  const candidate = await digest(pin, salt);
  // Constant-time-ish comparison: never short-circuit on the first mismatch.
  if (candidate.length !== stored.length) return false;
  let mismatch = 0;
  for (let i = 0; i < candidate.length; i += 1) {
    mismatch |= candidate.charCodeAt(i) ^ stored.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function changePin(currentPin: string, nextPin: string): Promise<void> {
  if (!(await verifyPin(currentPin))) throw new Error('Current PIN is incorrect.');
  await setPin(nextPin);
}

export async function clearPin(): Promise<void> {
  await Promise.all([
    deleteSecret(PIN_HASH_KEY).catch(() => undefined),
    deleteSecret(PIN_SALT_KEY).catch(() => undefined),
  ]);
}

export interface BiometricSupport {
  available: boolean;
  enrolled: boolean;
  label: string;
  reason?: string;
}

/** Biometrics are unavailable on web; the native module is loaded lazily. */
export async function getBiometricSupport(): Promise<BiometricSupport> {
  if (Platform.OS === 'web') {
    return { available: false, enrolled: false, label: 'Biometrics', reason: 'Not available in the browser preview' };
  }
  try {
    const LocalAuthentication = await import('expo-local-authentication');
    const [hasHardware, isEnrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const label = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
      ? 'Face unlock'
      : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ? 'Fingerprint'
        : 'Biometrics';
    return {
      available: hasHardware,
      enrolled: isEnrolled,
      label,
      reason: hasHardware && !isEnrolled ? 'No biometrics enrolled on this device' : undefined,
    };
  } catch (error) {
    return {
      available: false,
      enrolled: false,
      label: 'Biometrics',
      reason: error instanceof Error ? error.message : 'Biometric module unavailable',
    };
  }
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const LocalAuthentication = await import('expo-local-authentication');
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Notely',
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
    });
    return result.success;
  } catch {
    return false;
  }
}
