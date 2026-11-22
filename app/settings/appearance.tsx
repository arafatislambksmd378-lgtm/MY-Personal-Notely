/** Appearance: theme mode, accent colour, editor text size and a live preview. */
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { SectionHeader } from '@/components/SectionHeader';
import { useColors, useSettingsStore } from '@/store/useSettingsStore';
import { accents, accentSoft, radii, spacing } from '@/design/tokens';
import type { AccentName } from '@/design/tokens';
import { toast } from '@/store/useToastStore';

const THEME_OPTIONS: { value: 'light' | 'dark' | 'system'; label: string; icon: 'sunny-outline' | 'moon-outline' | 'phone-portrait-outline' }[] = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

const FONT_STEPS = [0.9, 1, 1.1, 1.2, 1.35];

export default function AppearanceSettings() {
  const colors = useColors();
  const settings = useSettingsStore((state) => state.settings);
  const patch = useSettingsStore((state) => state.patch);

  const fontIndex = Math.max(0, FONT_STEPS.indexOf(settings.editorFontScale));

  return (
    <Screen>
      <ScreenHeader title="Appearance" subtitle="Theme, accent and reading comfort" />

      <SectionHeader title="Theme" overline />
      <View style={styles.row}>
        {THEME_OPTIONS.map((option) => {
          const selected = settings.themeMode === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => void patch({ themeMode: option.value })}
              style={[
                styles.themeTile,
                {
                  backgroundColor: selected ? accentSoft[settings.accent] : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Ionicons name={option.icon} size={20} color={selected ? colors.primary : colors.textMuted} />
              <AppText variant="label" style={{ color: selected ? colors.primary : colors.textSecondary }}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title="Accent colour" overline style={{ marginTop: spacing.lg }} />
      <View style={styles.swatches}>
        {(Object.keys(accents) as AccentName[]).map((name) => {
          const selected = settings.accent === name;
          return (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={`${name} accent`}
              accessibilityState={{ selected }}
              onPress={() => void patch({ accent: name })}
              style={[styles.swatch, { backgroundColor: accents[name], borderColor: colors.surface }]}
            >
              {selected ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title="Editor text size" overline style={{ marginTop: spacing.lg }} />
      <Card style={{ gap: spacing.sm }}>
        <View style={styles.row}>
          <AppText variant="caption" tone="muted">
            A
          </AppText>
          {FONT_STEPS.map((step, index) => (
            <Pressable
              key={step}
              accessibilityRole="button"
              accessibilityLabel={`Text size ${Math.round(step * 100)} percent`}
              onPress={() => void patch({ editorFontScale: step })}
              style={[
                styles.fontStep,
                {
                  backgroundColor: index === fontIndex ? colors.primary : colors.surfaceMuted,
                },
              ]}
            >
              <AppText variant="label" style={{ color: index === fontIndex ? colors.onPrimary : colors.textSecondary }}>
                {Math.round(step * 100)}%
              </AppText>
            </Pressable>
          ))}
          <AppText variant="title3" tone="muted">
            A
          </AppText>
        </View>
        <AppText variant="label" tone="muted">
          Applies to the editor only. Exported documents keep their own typography.
        </AppText>
      </Card>

      <SectionHeader title="Preview" overline style={{ marginTop: spacing.lg }} />
      <Card>
        <AppText variant="title3">{settings.userName}&apos;s note</AppText>
        <AppText
          variant="body"
          tone="secondary"
          style={{ marginTop: spacing.xs, fontSize: 15 * settings.editorFontScale, lineHeight: 22 * settings.editorFontScale }}
        >
          This is how your notes read. Line height, colour and size follow the settings above, and the paper you
          choose in the editor is what gets printed.
        </AppText>
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <ListRow
          icon="contrast-outline"
          accent={settings.accent}
          title="High contrast text"
          subtitle="Uses the darker body colour in light mode"
          showChevron={false}
          right={
            <AppText variant="label" tone="muted">
              {colors.scheme === 'dark' ? 'Dark palette' : 'Light palette'}
            </AppText>
          }
        />
        <Pressable
          onPress={() => {
            void patch({ editorFontScale: 1, accent: 'purple' }).then(() => toast.success('Appearance reset to defaults'));
          }}
          style={{ paddingVertical: spacing.md }}
        >
          <AppText variant="caption" style={{ color: colors.primary }}>
            Reset appearance to defaults
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  themeTile: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  fontStep: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radii.sm,
    minWidth: 48,
    alignItems: 'center',
  },
});
