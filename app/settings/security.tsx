/**
 * Security: app lock (PIN + biometrics), auto-lock behaviour and a manual
 * "lock now" action. The PIN itself lives in secure storage, never in SQLite.
 */
import { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { SectionHeader } from '@/components/SectionHeader';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { Button } from '@/components/Button';
import { PromptDialog } from '@/components/PromptDialog';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useLockStore } from '@/store/useLockStore';
import { clearPin, getBiometricSupport, hasPin, isValidPin, setPin, type BiometricSupport } from '@/services/security';
import { toast } from '@/store/useToastStore';
import { APP_CONFIG } from '@/config/app';
import { spacing } from '@/design/tokens';

export default function SecuritySettings() {
  const settings = useSettingsStore((state) => state.settings);
  const patch = useSettingsStore((state) => state.patch);
  const lock = useLockStore((state) => state.lock);
  const [pinConfigured, setPinConfigured] = useState(false);
  const [biometrics, setBiometrics] = useState<BiometricSupport | null>(null);
  const [pinDialog, setPinDialog] = useState(false);
  const [removePinDialog, setRemovePinDialog] = useState(false);

  const refresh = useCallback(async () => {
    setPinConfigured(await hasPin());
    setBiometrics(await getBiometricSupport());
  }, []);

  useEffect(() => {
    // Deferred so the state updates land in a task, not during the render commit.
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const enableLock = async () => {
    if (!pinConfigured) {
      setPinDialog(true);
      return;
    }
    await patch({ appLockEnabled: true });
    toast.success('App lock enabled');
  };

  return (
    <Screen>
      <ScreenHeader title="Security" subtitle="Protect your notes on this device" />

      <Card style={{ gap: spacing.sm }}>
        <ListRow
          icon="lock-closed-outline"
          accent="purple"
          title="App lock"
          subtitle={pinConfigured ? 'PIN is set' : 'Set a PIN to turn this on'}
          showChevron={false}
          right={
            <ToggleSwitch
              value={settings.appLockEnabled}
              onChange={(value) => {
                if (value) void enableLock();
                else void patch({ appLockEnabled: false, biometricEnabled: false }).then(() => toast.success('App lock disabled'));
              }}
              accessibilityLabel="App lock"
            />
          }
        />
        <ListRow
          icon="keypad-outline"
          accent="blue"
          title={pinConfigured ? 'Change PIN' : 'Create PIN'}
          subtitle={`${APP_CONFIG.pinLength.min}–${APP_CONFIG.pinLength.max} digits, stored in the device keychain`}
          onPress={() => setPinDialog(true)}
        />
        {pinConfigured ? (
          <ListRow
            icon="trash-outline"
            accent="red"
            title="Remove PIN"
            subtitle="Turns off the app lock"
            onPress={() => setRemovePinDialog(true)}
          />
        ) : null}
      </Card>

      <SectionHeader title="Biometrics" overline style={{ marginTop: spacing.lg }} />
      <Card>
        <ListRow
          icon="finger-print-outline"
          accent="teal"
          title="Unlock with biometrics"
          subtitle={
            biometrics?.available
              ? biometrics.label
              : biometrics?.reason ?? 'Checking device support…'
          }
          showChevron={false}
          right={
            <ToggleSwitch
              value={settings.biometricEnabled}
              disabled={!biometrics?.available || !settings.appLockEnabled}
              onChange={(value) => {
                if (value && !settings.appLockEnabled) {
                  toast.show('Turn on the app lock first.');
                  return;
                }
                void patch({ biometricEnabled: value });
              }}
              accessibilityLabel="Biometric unlock"
            />
          }
        />
        {!biometrics?.available && biometrics?.reason ? (
          <AppText variant="label" tone="muted">
            {biometrics.reason}
          </AppText>
        ) : null}
      </Card>

      <SectionHeader title="Behaviour" overline style={{ marginTop: spacing.lg }} />
      <Card style={{ gap: spacing.sm }}>
        <ListRow
          icon="phone-portrait-outline"
          accent="amber"
          title="Lock when leaving the app"
          subtitle="Notely re-locks as soon as it goes to the background"
          showChevron={false}
          right={
            <AppText variant="label" tone="muted">
              Always on
            </AppText>
          }
        />
        <Button
          label="Lock now"
          variant="secondary"
          icon="lock-closed-outline"
          onPress={() => {
            lock();
            toast.show('Notely is locked');
          }}
        />
      </Card>

      {Platform.OS === 'web' ? (
        <Card style={{ marginTop: spacing.lg }}>
          <AppText variant="label" tone="muted">
            Browser build: there is no system keychain in a web page, so the PIN hash is kept in this browser&apos;s
            local storage. It protects against casual access on a shared screen, not against someone with access to
            the browser profile. The Android and iOS builds use the platform keystore.
          </AppText>
        </Card>
      ) : null}

      <View style={styles.note}>
        <AppText variant="label" tone="muted">
          The PIN is hashed with a random salt and kept in Expo SecureStore — the database and backups never contain
          it. Forgetting the PIN means losing app-lock access, not your notes: they stay on disk and can be read by
          reinstalling Notely.
        </AppText>
      </View>

      <PromptDialog
        visible={pinDialog}
        title={pinConfigured ? 'Change PIN' : 'Create a PIN'}
        message={`Choose ${APP_CONFIG.pinLength.min}–${APP_CONFIG.pinLength.max} digits. You will need it every time Notely opens.`}
        placeholder="PIN"
        keyboardType="number-pad"
        secureTextEntry
        submitLabel="Save PIN"
        validate={(value) => (isValidPin(value) ? null : `Use ${APP_CONFIG.pinLength.min}–${APP_CONFIG.pinLength.max} digits.`)}
        onSubmit={async (value) => {
          await setPin(value);
          await refresh();
          await patch({ appLockEnabled: true });
          toast.success('PIN saved — app lock is on');
        }}
        onClose={() => setPinDialog(false)}
      />

      <PromptDialog
        visible={removePinDialog}
        title="Remove the PIN?"
        message="The app lock will be turned off. Type your current PIN to confirm."
        placeholder="Current PIN"
        keyboardType="number-pad"
        secureTextEntry
        submitLabel="Remove PIN"
        onSubmit={async (value) => {
          const { verifyPin } = await import('@/services/security');
          if (!(await verifyPin(value))) throw new Error('That PIN is not correct.');
          await clearPin();
          await patch({ appLockEnabled: false, biometricEnabled: false });
          await refresh();
          toast.success('PIN removed');
        }}
        onClose={() => setRemovePinDialog(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { paddingTop: spacing.lg },
});
