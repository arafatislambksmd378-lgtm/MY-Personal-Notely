/**
 * Settings screen.
 *
 * Reference structure: purple workspace card, then APPEARANCE / SECURITY /
 * EDITOR / ABOUT sections built from icon-tile rows.
 */
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { ListRow } from '@/components/ListRow';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { SectionHeader } from '@/components/SectionHeader';
import { PromptDialog } from '@/components/PromptDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useColors, useSettingsStore } from '@/store/useSettingsStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { APP_CONFIG } from '@/config/app';
import { accents, accentGradient, cardColorOrder, radii, shadows, spacing } from '@/design/tokens';
import type { AccentName } from '@/design/tokens';
import { hasPin, setPin, clearPin } from '@/services/security';
import { toast } from '@/store/useToastStore';
import { pluralize } from '@/utils/text';

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const settings = useSettingsStore((state) => state.settings);
  const patch = useSettingsStore((state) => state.patch);
  const stats = useLibraryStore((state) => state.stats);
  const refresh = useLibraryStore((state) => state.refresh);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinConfirmOpen, setPinConfirmOpen] = useState(false);
  const [disableLockOpen, setDisableLockOpen] = useState(false);
  const [pinConfigured, setPinConfigured] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void hasPin().then(setPinConfigured);
    }, [refresh]),
  );

  const isDark = settings.themeMode === 'dark';

  return (
    <>
      <Screen scroll={false}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <AppText variant="title1">Settings</AppText>

          <LinearGradient
            colors={accentGradient[settings.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.hero, shadows.card]}
          >
            <View style={styles.avatar}>
              <AppText variant="title2" style={{ color: '#FFFFFF' }}>
                {(settings.userName || 'W').trim().charAt(0).toUpperCase()}
              </AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="title3" style={{ color: '#FFFFFF' }}>
                {settings.userName || 'Writer'}
              </AppText>
              <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.82)' }}>
                {settings.workspaceName} · stored on this device
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              onPress={() => setProfileOpen(true)}
              hitSlop={10}
              style={styles.heroAction}
            >
              <Ionicons name="create-outline" size={18} color="#FFFFFF" />
            </Pressable>
          </LinearGradient>

          <SectionHeader title="Appearance" overline style={{ marginTop: spacing.xxl }} />
          <View style={{ gap: spacing.sm }}>
            <ListRow
              icon="moon"
              accent="purple"
              title="Dark mode"
              subtitle="Easier on the eyes at night"
              right={
                <ToggleSwitch
                  value={isDark}
                  accessibilityLabel="Dark mode"
                  onChange={(value) => void patch({ themeMode: value ? 'dark' : 'light' })}
                />
              }
            />
            <ListRow
              icon="color-palette"
              accent="pink"
              title="Accent system"
              subtitle="Purple · green · blue · yellow"
              onPress={() => router.push('/settings/appearance')}
              right={
                <View style={styles.dots}>
                  {cardColorOrder.slice(0, 4).map((name) => (
                    <Pressable
                      key={name}
                      accessibilityRole="button"
                      accessibilityLabel={`${name} accent`}
                      onPress={() => void patch({ accent: name as AccentName })}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: accents[name],
                          borderColor: settings.accent === name ? colors.text : 'transparent',
                        },
                      ]}
                    />
                  ))}
                </View>
              }
            />
          </View>

          <SectionHeader title="Security" overline style={{ marginTop: spacing.xxl }} />
          <View style={{ gap: spacing.sm }}>
            <ListRow
              icon="lock-closed"
              accent="blue"
              title="App lock"
              subtitle={
                settings.appLockEnabled
                  ? pinConfigured
                    ? 'PIN required to open Notely'
                    : 'Set a PIN to finish enabling the lock'
                  : 'Require a PIN to open Notely'
              }
              right={
                <ToggleSwitch
                  value={settings.appLockEnabled}
                  accessibilityLabel="App lock"
                  onChange={async (value) => {
                    if (value) {
                      if (await hasPin()) {
                        await patch({ appLockEnabled: true });
                        toast.success('App lock enabled');
                      } else {
                        setPinOpen(true);
                      }
                    } else {
                      setDisableLockOpen(true);
                    }
                  }}
                />
              }
            />
            <ListRow
              icon="shield-checkmark"
              accent="green"
              title="Security options"
              subtitle="Change PIN, biometrics, auto-lock"
              onPress={() => router.push('/settings/security')}
              showChevron
            />
          </View>

          <SectionHeader title="Editor" overline style={{ marginTop: spacing.xxl }} />
          <View style={{ gap: spacing.sm }}>
            <ListRow
              icon="checkmark-circle"
              accent="green"
              title="Spelling & grammar"
              subtitle="Underline likely mistakes while you write"
              right={
                <ToggleSwitch
                  value={settings.spellcheckEnabled}
                  accessibilityLabel="Spelling and grammar"
                  onChange={(value) => void patch({ spellcheckEnabled: value })}
                />
              }
            />
            <ListRow
              icon="cloud-done"
              accent="blue"
              title="Auto-save"
              subtitle={`Always on · saves ${Math.round(settings.autosaveIntervalMs / 100) / 10}s after you stop typing`}
              right={<Ionicons name="checkmark-circle" size={20} color={colors.success} />}
            />
            <ListRow
              icon="time"
              accent="pink"
              title="Version history"
              subtitle="Snapshots kept for every note"
              onPress={() => router.push('/settings/backup')}
              right={<Ionicons name="checkmark-circle" size={20} color={colors.success} />}
            />
          </View>

          <SectionHeader title="Tools" overline style={{ marginTop: spacing.xxl }} />
          <View style={{ gap: spacing.sm }}>
            <ListRow icon="grid" accent="purple" title="Templates" subtitle="Start a note from a template" onPress={() => router.push('/templates')} showChevron />
            <ListRow icon="pricetags" accent="amber" title="Tags" subtitle="Organise notes across notebooks" onPress={() => router.push('/settings/tags')} showChevron />
            <ListRow icon="archive" accent="teal" title="Backup & restore" subtitle="Export a full local backup" onPress={() => router.push('/settings/backup')} showChevron />
            <ListRow icon="cloud-offline" accent="blue" title="Cloud sync" subtitle="Optional Supabase sync" onPress={() => router.push('/settings/cloud')} showChevron />
            <ListRow icon="pulse" accent="red" title="Diagnostics" subtitle="Recent events and storage health" onPress={() => router.push('/settings/diagnostics')} showChevron />
          </View>

          <SectionHeader title="About" overline style={{ marginTop: spacing.xxl }} />
          <View style={{ gap: spacing.sm }}>
            <ListRow
              icon="document-text"
              accent="purple"
              title="Notely"
              subtitle={`${APP_CONFIG.buildLabel} · local-first storage`}
              onPress={() => router.push('/settings/about')}
              right={<AppText variant="caption" tone="muted">{pluralize(stats.notes, 'note')}</AppText>}
            />
            <ListRow
              icon="albums"
              accent="pink"
              title="Library"
              subtitle={`${pluralize(stats.notebooks, 'notebook')} · ${stats.words.toLocaleString()} words`}
              onPress={() => router.push({ pathname: '/collection/[kind]', params: { kind: 'all' } })}
              right={<AppText variant="caption" tone="muted">{pluralize(stats.archived, 'archived')}</AppText>}
            />
          </View>

          <AppText variant="label" tone="muted" center style={{ marginTop: spacing.xxl }}>
            {APP_CONFIG.name} {APP_CONFIG.version}
          </AppText>
        </ScrollView>
      </Screen>

      <PromptDialog
        visible={profileOpen}
        title="Your profile"
        message="This name appears on the home screen and in backups."
        initialValue={settings.userName}
        placeholder="Your name"
        submitLabel="Save"
        onSubmit={async (value) => {
          await patch({ userName: value });
          toast.success('Profile updated');
        }}
        onClose={() => setProfileOpen(false)}
      />

      <PromptDialog
        visible={pinOpen}
        title="Set an app PIN"
        message={`Choose ${APP_CONFIG.pinLength.min}-${APP_CONFIG.pinLength.max} digits. The PIN is salted and hashed — the raw PIN is never stored.`}
        placeholder="PIN"
        keyboardType="number-pad"
        secureTextEntry
        submitLabel="Set PIN"
        validate={(value) =>
          /^\d{4,8}$/.test(value) ? null : `PIN must be ${APP_CONFIG.pinLength.min}-${APP_CONFIG.pinLength.max} digits`
        }
        onSubmit={async (value) => {
          await setPin(value);
          await patch({ appLockEnabled: true });
          setPinConfigured(true);
          setPinConfirmOpen(true);
          toast.success('App lock enabled');
        }}
        onClose={() => setPinOpen(false)}
      />

      <PromptDialog
        visible={pinConfirmOpen}
        title="Enable biometrics?"
        message="Use your device fingerprint or face to unlock Notely alongside the PIN."
        placeholder="Type YES to enable"
        submitLabel="Enable"
        validate={(value) => (value.trim().toUpperCase() === 'YES' ? null : 'Type YES to enable, or cancel')}
        onSubmit={async () => {
          await patch({ biometricEnabled: true });
          toast.success('Biometrics enabled');
        }}
        onClose={() => setPinConfirmOpen(false)}
      />

      <ConfirmDialog
        visible={disableLockOpen}
        title="Turn off app lock?"
        message="Notely will open without a PIN. Your notes are unchanged and your PIN is removed from secure storage."
        confirmLabel="Turn off"
        onConfirm={async () => {
          await clearPin();
          await patch({ appLockEnabled: false, biometricEnabled: false });
          setPinConfigured(false);
          toast.success('App lock disabled');
        }}
        onClose={() => setDisableLockOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.huge },
  hero: {
    marginTop: spacing.lg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5 },
});
