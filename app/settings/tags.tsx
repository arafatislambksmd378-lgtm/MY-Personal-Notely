/** Tag manager: create, inspect and delete tags. Tagging happens inside notes. */
import { useCallback, useState } from 'react';
import { StyleSheet, View , Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { PromptDialog } from '@/components/PromptDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ColorSwatchRow } from '@/components/ColorSwatchRow';
import { useColors } from '@/store/useSettingsStore';
import { createTag, deleteTag, listTags , getTagUsage } from '@/db/repositories/tags';
import { toast } from '@/store/useToastStore';
import type { AccentName } from '@/design/tokens';
import type { Tag } from '@/types/models';
import { accentSoft, radii, spacing } from '@/design/tokens';

export default function TagsSettings() {
  const colors = useColors();
  const [tags, setTags] = useState<Tag[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);
  const [color, setColor] = useState<AccentName>('purple');
  const [deleting, setDeleting] = useState<Tag | null>(null);

  const load = useCallback(async () => {
    const rows = await listTags();
    setTags(rows);
    setUsage(await getTagUsage());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <ScreenHeader title="Tags" subtitle="One note can carry several tags" />

      <Card style={{ gap: spacing.sm }}>
        <AppText variant="bodyStrong">Why tags?</AppText>
        <AppText variant="caption" tone="muted">
          Notebooks hold a note; tags describe it. A recipe can be both <AppText variant="label">#vegetarian</AppText>{' '}
          and <AppText variant="label">#quick</AppText> without duplicating it.
        </AppText>
        <Button label="New tag" icon="add" variant="soft" onPress={() => setCreating(true)} />
      </Card>

      <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
        <AppText variant="overline" tone="muted">
          NEW TAG COLOUR
        </AppText>
        <ColorSwatchRow value={color} onChange={setColor} />
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {tags.length === 0 ? (
          <EmptyState
            icon="pricetags-outline"
            accent="amber"
            title="No tags yet"
            message="Tags you create appear here and in the editor's insert sheet."
            actionLabel="Create your first tag"
            onAction={() => setCreating(true)}
          />
        ) : (
          tags.map((tag) => (
            <Card key={tag.id} padded={false} style={styles.tagRow}>
              <View style={[styles.dot, { backgroundColor: accentSoft[tag.color] }]}>
                <AppText variant="label" style={{ color: colors.text }}>
                  #
                </AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{tag.name}</AppText>
                <AppText variant="label" tone="muted">
                  {(usage[tag.id] ?? 0) === 1 ? '1 note' : `${usage[tag.id] ?? 0} notes`}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete tag ${tag.name}`}
                onPress={() => setDeleting(tag)}
                hitSlop={10}
                style={styles.deleteButton}
              >
                <AppText variant="caption" style={{ color: colors.danger }}>
                  Delete
                </AppText>
              </Pressable>
            </Card>
          ))
        )}
      </View>

      <PromptDialog
        visible={creating}
        title="New tag"
        message="Short, lowercase and memorable works best."
        placeholder="e.g. research"
        submitLabel="Create tag"
        validate={(value) => {
          const clean = value.trim().replace(/^#/, '');
          if (!clean) return 'Give the tag a name';
          if (!/^[a-z0-9-]{2,24}$/i.test(clean)) return 'Use 2–24 letters, numbers or dashes';
          if (tags.some((tag) => tag.name.toLowerCase() === clean.toLowerCase())) return 'That tag already exists';
          return null;
        }}
        onSubmit={async (value) => {
          await createTag(value.trim().replace(/^#/, ''), color);
          await load();
          toast.success('Tag created');
        }}
        onClose={() => setCreating(false)}
      />

      <ConfirmDialog
        visible={Boolean(deleting)}
        title={deleting ? `Delete “${deleting.name}”?` : 'Delete tag?'}
        message="The tag is removed from every note. The notes themselves stay exactly as they are."
        confirmLabel="Delete tag"
        onConfirm={async () => {
          if (!deleting) return;
          await deleteTag(deleting.id);
          await load();
          toast.success('Tag deleted');
        }}
        onClose={() => setDeleting(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  dot: { width: 32, height: 32, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
});
