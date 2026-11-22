/**
 * Templates screen. Creates a note from a starter document, or imports an
 * existing DOCX / ODT / Markdown / HTML / TXT file into a new note.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { IconTile } from '@/components/IconTile';
import { Button } from '@/components/Button';
import { useColors } from '@/store/useSettingsStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { NOTE_TEMPLATES, type NoteTemplate } from '@/features/templates/catalog';
import { pickAndImport } from '@/services/import';
import { createDocument } from '@/db/repositories/documents';
import { toast } from '@/store/useToastStore';
import { logEvent } from '@/db/repositories/events';
import { radii, spacing } from '@/design/tokens';

export default function TemplatesScreen() {
  const router = useRouter();
  const colors = useColors();
  const refresh = useLibraryStore((state) => state.refresh);
  const createNote = useLibraryStore((state) => state.createNote);
  const [importing, setImporting] = useState(false);

  const use = useCallback(
    async (template: NoteTemplate) => {
      try {
        const doc = template.id === 'blank'
          ? await createNote({ title: '', html: template.html })
          : await createDocument({ title: template.title, contentHtml: template.html });
        await refresh();
        router.push({ pathname: '/note/[id]', params: { id: doc.id } });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not create the note');
      }
    },
    [createNote, refresh, router],
  );

  const importFile = useCallback(async () => {
    setImporting(true);
    try {
      const result = await pickAndImport();
      if (!result) return;
      const doc = await createDocument({ title: result.title, contentHtml: result.html });
      await refresh();
      toast.success(`Imported “${result.title}”`);
      router.push({ pathname: '/note/[id]', params: { id: doc.id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Import failed';
      toast.error(message);
      void logEvent('error', 'import', 'Import failed', { message });
    } finally {
      setImporting(false);
    }
  }, [refresh, router]);

  return (
    <Screen scroll={false}>
      <ScreenHeader title="Templates" subtitle="Start faster or bring a file in" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.md }}>
        <Card style={{ gap: spacing.sm }}>
          <View style={styles.row}>
            <IconTile name="cloud-upload-outline" accent="blue" />
            <View style={styles.texts}>
              <AppText variant="bodyStrong">Import a document</AppText>
              <AppText variant="caption" tone="muted">
                DOCX, ODT, Markdown, HTML or TXT — converted locally.
              </AppText>
            </View>
          </View>
          <Button
            label={importing ? 'Importing…' : 'Choose a file'}
            icon="folder-open-outline"
            variant="soft"
            onPress={() => void importFile()}
            loading={importing}
            fullWidth
          />
          <AppText variant="label" tone="muted">
            Files are read on this device. Nothing is uploaded, and the original file stays where it is.
          </AppText>
        </Card>

        <AppText variant="overline" tone="muted">
          STARTER NOTES
        </AppText>

        <View style={styles.grid}>
          {NOTE_TEMPLATES.map((template) => (
            <Pressable
              key={template.id}
              accessibilityRole="button"
              accessibilityLabel={`Use ${template.name} template`}
              onPress={() => void use(template)}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <IconTile name={template.icon as keyof typeof Ionicons.glyphMap} accent={template.accent} size="lg" />
              <AppText variant="bodyStrong" style={{ marginTop: spacing.sm }}>
                {template.name}
              </AppText>
              <AppText variant="label" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
                {template.description}
              </AppText>
            </Pressable>
          ))}
        </View>

        {importing ? (
          <View style={styles.importing}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="caption" tone="muted">
              Converting…
            </AppText>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  texts: { flex: 1, gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '48%',
    flexGrow: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  importing: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center' },
});
