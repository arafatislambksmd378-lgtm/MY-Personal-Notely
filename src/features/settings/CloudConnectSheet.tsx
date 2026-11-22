/** Connect form for Supabase sync (URL, anon key, sync token, workspace id). */
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { useColors } from '@/store/useSettingsStore';
import { saveSyncConfig, type SyncConfig } from '@/services/supabase';
import { fontFamily } from '@/design/typography';
import { toast } from '@/store/useToastStore';
import { radii, spacing } from '@/design/tokens';

interface CloudConnectSheetProps {
  visible: boolean;
  onClose: () => void;
  initial: Partial<SyncConfig>;
  onConnected: () => void;
}

export function CloudConnectSheet({ visible, onClose, initial, onConnected }: CloudConnectSheetProps) {
  const colors = useColors();
  const [url, setUrl] = useState(initial.url ?? '');
  const [anonKey, setAnonKey] = useState('');
  const [token, setToken] = useState('');
  const [spaceId, setSpaceId] = useState(initial.spaceId ?? 'default');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setUrl(initial.url ?? '');
    setSpaceId(initial.spaceId ?? 'default');
    setAnonKey('');
    setToken('');
    setError(null);
  }, [initial.spaceId, initial.url, visible]);

  const field = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    options: { placeholder: string; secure?: boolean; autoCapitalize?: 'none' } = { placeholder: '', autoCapitalize: 'none' },
  ) => (
    <View style={{ gap: 4 }}>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={options.placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={options.secure}
        autoCapitalize={options.autoCapitalize ?? 'none'}
        autoCorrect={false}
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
      />
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Connect Supabase" subtitle="One project, one workspace id">
      <View style={{ gap: spacing.sm }}>
        {field('Project URL', url, setUrl, { placeholder: 'https://abcd.supabase.co' })}
        {field('Anon key', anonKey, setAnonKey, { placeholder: 'eyJhbGciOi…', secure: true })}
        {field('Sync token', token, setToken, { placeholder: 'the token in your RLS policy', secure: true })}
        {field('Workspace id', spaceId, setSpaceId, { placeholder: 'default' })}

        <AppText variant="label" tone="muted">
          Run supabase/schema.sql in your project first, and use the same token you put in that policy. Details stay in
          the device keychain — the URL and workspace id are stored in the local database.
        </AppText>

        {error ? (
          <AppText variant="label" style={{ color: colors.danger }}>
            {error}
          </AppText>
        ) : null}

        <Button
          label={busy ? 'Connecting…' : 'Connect'}
          icon="cloud-done-outline"
          loading={busy}
          fullWidth
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await saveSyncConfig({ url, anonKey, token, spaceId });
              toast.success('Cloud sync connected');
              onConnected();
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not connect');
            } finally {
              setBusy(false);
            }
          }}
        />
        <Button label="Cancel" variant="ghost" onPress={onClose} fullWidth />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: fontFamily.regular,
  },
});
