/** About: version, principles, what is included and open-source credits. */
import { Linking, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/Button';
import { useColors, useSettingsStore } from '@/store/useSettingsStore';
import { APP_CONFIG } from '@/config/app';
import { accentGradient, radii, spacing } from '@/design/tokens';
import { toast } from '@/store/useToastStore';

const FEATURES = [
  'Rich-text editor with tables, images, drawings, charts, footnotes and equations',
  'Offline search across titles, body text and tags',
  'Version history with side-by-side comparison',
  'Comments, bookmarks and per-note page setup',
  'Export to PDF, DOCX, ODT, RTF, HTML, Markdown and TXT',
  'Import from DOCX, ODT, Markdown, HTML and TXT',
  'Full local backup and restore, JSON or ZIP',
  'PIN + biometric app lock with secure-storage hashing',
];

const CREDITS = [
  { name: 'Expo / React Native', licence: 'MIT' },
  { name: 'expo-sqlite (SQLite)', licence: 'MIT · public domain' },
  { name: 'JSZip', licence: 'MIT / GPLv3' },
  { name: 'Plus Jakarta Sans', licence: 'SIL Open Font License 1.1' },
  { name: 'Ionicons', licence: 'MIT' },
];

export default function AboutScreen() {
  const colors = useColors();
  const settings = useSettingsStore((state) => state.settings);

  return (
    <Screen>
      <ScreenHeader title="About" subtitle={APP_CONFIG.buildLabel} />

      <LinearGradient
        colors={accentGradient[settings.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.logo}>
          <Ionicons name="create-outline" size={26} color="#FFFFFF" />
        </View>
        <AppText variant="title2" style={{ color: '#FFFFFF' }}>
          {APP_CONFIG.name}
        </AppText>
        <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
          Version {APP_CONFIG.version} · built for writing, not for tracking
        </AppText>
      </LinearGradient>

      <Card style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <AppText variant="bodyStrong">Local-first by design</AppText>
        <AppText variant="caption" tone="muted">
          Your notes are stored in a SQLite database on this device. There is no account, no analytics and no
          background upload. Backups are files you create and decide where to keep.
        </AppText>
      </Card>

      <SectionHeader title="What is included" overline style={{ marginTop: spacing.lg }} />
      <Card padded={false} style={{ overflow: 'hidden' }}>
        {FEATURES.map((feature, index) => (
          <View
            key={feature}
            style={[
              styles.featureRow,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
            ]}
          >
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
              {feature}
            </AppText>
          </View>
        ))}
      </Card>

      <SectionHeader title="Credits" overline style={{ marginTop: spacing.lg }} />
      <Card style={{ gap: spacing.xs }}>
        {CREDITS.map((credit) => (
          <View key={credit.name} style={styles.creditRow}>
            <AppText variant="caption" tone="secondary">
              {credit.name}
            </AppText>
            <AppText variant="label" tone="muted">
              {credit.licence}
            </AppText>
          </View>
        ))}
      </Card>

      <SectionHeader title="Support" overline style={{ marginTop: spacing.lg }} />
      <Card style={{ gap: spacing.sm }}>
        <Button
          label={APP_CONFIG.supportEmail}
          icon="mail-outline"
          variant="soft"
          onPress={() => {
            void Linking.openURL(`mailto:${APP_CONFIG.supportEmail}`).catch(() =>
              toast.error('No mail app is available'),
            );
          }}
        />
        <AppText variant="label" tone="muted">
          Reports go nowhere automatically. If something breaks, open Settings → Diagnostics and share the report
          yourself — it contains counts and errors, never note text.
        </AppText>
      </Card>

      <View style={{ paddingVertical: spacing.xl }}>
        <AppText variant="label" tone="muted" center>
          Made with care. Everything you write stays yours.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radii.xl, padding: spacing.lg, gap: spacing.xs },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  featureRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', padding: spacing.md },
  creditRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
});
