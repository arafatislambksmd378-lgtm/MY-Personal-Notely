/**
 * PIN lock screen with an optional biometric shortcut.
 * Shown above every route whenever `useLockStore.locked` is true.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconTile } from '@/components/IconTile';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useColors, useSettingsStore } from '@/store/useSettingsStore';
import { useLockStore } from '@/store/useLockStore';
import { authenticateWithBiometrics, clearPin, getBiometricSupport, verifyPin } from '@/services/security';
import { APP_CONFIG } from '@/config/app';
import { fontFamily } from '@/design/typography';
import { radii, spacing } from '@/design/tokens';

export function LockScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const unlock = useLockStore((state) => state.unlock);
  const failedAttempts = useLockStore((state) => state.failedAttempts);
  const registerFailure = useLockStore((state) => state.registerFailure);
  const patchSettings = useSettingsStore((state) => state.patch);
  const biometricEnabled = useSettingsStore((state) => state.settings.biometricEnabled);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [biometricLabel, setBiometricLabel] = useState('Biometrics');
  const [showReset, setShowReset] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getBiometricSupport().then((support) => {
      if (mounted) setBiometricLabel(support.label);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const submit = useCallback(
    async (candidate: string) => {
      setChecking(true);
      try {
        const ok = await verifyPin(candidate);
        if (ok) {
          unlock();
        } else {
          registerFailure();
          setError('Incorrect PIN. Try again.');
          setPin('');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not verify PIN');
      } finally {
        setChecking(false);
      }
    },
    [registerFailure, unlock],
  );

  const tryBiometrics = useCallback(async () => {
    const ok = await authenticateWithBiometrics();
    if (ok) unlock();
  }, [unlock]);

  useEffect(() => {
    if (biometricEnabled) void tryBiometrics();
    // Only on mount: re-prompting after a failure would be annoying.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDigit = (digit: string) => {
    if (pin.length >= APP_CONFIG.pinLength.max) return;
    const next = `${pin}${digit}`;
    setPin(next);
    setError(null);
    if (next.length >= APP_CONFIG.pinLength.min && next.length === APP_CONFIG.pinLength.min) {
      void submit(next);
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas, paddingTop: insets.top + spacing.xxxl }]}>
      <IconTile name="lock-closed" accent="purple" size="xl" />
      <AppText variant="title2" style={{ marginTop: spacing.lg }}>
        Notely is locked
      </AppText>
      <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
        Enter your PIN to open your notebook
      </AppText>

      <View style={styles.dots}>
        {Array.from({ length: APP_CONFIG.pinLength.min }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: index < pin.length ? colors.primary : colors.surfaceSunken,
                borderColor: colors.borderStrong,
              },
            ]}
          />
        ))}
      </View>
      {error ? (
        <AppText variant="caption" tone="danger" style={{ marginBottom: spacing.sm }}>
          {error}
        </AppText>
      ) : (
        <View style={{ height: 24 }} />
      )}

      <View style={styles.pad}>
        {keys.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`Digit ${key}`}
            onPress={() => onDigit(key)}
            style={({ pressed }) => [
              styles.key,
              { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.keyLabel, { color: colors.text }]}>{key}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={biometricLabel}
          onPress={biometricEnabled ? tryBiometrics : undefined}
          style={[styles.key, { backgroundColor: 'transparent', borderColor: 'transparent' }]}
          disabled={!biometricEnabled}
        >
          {biometricEnabled ? (
            <Ionicons name="finger-print" size={24} color={colors.primary} />
          ) : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Digit 0"
          onPress={() => onDigit('0')}
          style={({ pressed }) => [
            styles.key,
            { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.keyLabel, { color: colors.text }]}>0</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete digit"
          onPress={() => setPin((current) => current.slice(0, -1))}
          style={[styles.key, { backgroundColor: 'transparent', borderColor: 'transparent' }]}
        >
          <Ionicons name="backspace-outline" size={23} color={colors.textSecondary} />
        </Pressable>
      </View>

      {failedAttempts >= 3 ? (
        <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.sm }}>
          {failedAttempts} failed attempts
        </AppText>
      ) : null}

      <Pressable onPress={() => setShowReset(true)} style={{ marginTop: spacing.lg }} accessibilityRole="button">
        <AppText variant="caption" tone="primary">
          Forgot PIN?
        </AppText>
      </Pressable>

      <ConfirmDialog
        visible={showReset}
        title="Disable app lock?"
        message="Your notes stay on this device. Disabling the lock removes the PIN so you can get back in; you can set a new PIN in Settings → Security."
        confirmLabel="Disable lock"
        onConfirm={async () => {
          await clearPin();
          await patchSettings({ appLockEnabled: false, biometricEnabled: false });
          unlock();
        }}
        onClose={() => setShowReset(false)}
      />

      {checking ? <Button label="Checking…" loading variant="ghost" size="sm" style={{ marginTop: spacing.md }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: spacing.xl, zIndex: 1000 },
  dots: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl, marginBottom: spacing.md },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 280, justifyContent: 'center', gap: spacing.md },
  key: {
    width: 76,
    height: 68,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyLabel: { fontFamily: fontFamily.semibold, fontSize: 24 },
});
