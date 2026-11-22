/**
 * Tags for the open note: shows the tags already attached, lets you attach an
 * existing tag with one tap, and creates a new one inline.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BottomSheet } from '@/components/BottomSheet';
import { AppText } from '@/components/AppText';
import { useColors } from '@/store/useSettingsStore';
import { addTagToDocument, createTag, listDocumentTags, listTags, removeTagFromDocument } from '@/db/repositories/tags';
import { toast } from '@/store/useToastStore';
import { fontFamily } from '@/design/typography';
import type { Tag } from '@/types/models';
import { radii, spacing } from '@/design/tokens';

interface TagsSheetProps {
  visible: boolean;
  onClose: () => void;
  documentId: string;
  onChanged?: (tags: Tag[]) => void;
}

export function TagsSheet({ visible, onClose, documentId, onChanged }: TagsSheetProps) {
  const colors = useColors();
  const [all, setAll] = useState<Tag[]>([]);
  const [attached, setAttached] = useState<Tag[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [every, mine] = await Promise.all([listTags(), listDocumentTags(documentId)]);
    setAll(every);
    setAttached(mine);
    onChanged?.(mine);
  }, [documentId, onChanged]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    void (async () => {
      const [every, mine] = await Promise.all([listTags(), listDocumentTags(documentId)]);
      if (!active) return;
      setAll(every);
      setAttached(mine);
      onChanged?.(mine);
    })();
    return () => {
      active = false;
    };
  }, [documentId, onChanged, visible]);

  const attachedIds = new Set(attached.map((tag) => tag.id));
  const available = all.filter((tag) => !attachedIds.has(tag.id));

  const add = async (name: string, existing?: Tag) => {
    setBusy(true);
    try {
      if (existing) await addTagToDocument(documentId, existing.name);
      else await createTag(name.trim().replace(/^#/, ''));
      if (!existing) await addTagToDocument(documentId, name.trim().replace(/^#/, ''));
      setDraft('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the tag');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (tag: Tag) => {
    await removeTagFromDocument(documentId, tag.id);
    await load();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Tags" subtitle="Describe this note across notebooks">
      {attached.length ? (
        <View style={styles.wrap}>
          {attached.map((tag) => (
            <Pressable
              key={tag.id}
              accessibilityRole="button"
              accessibilityLabel={`Remove tag ${tag.name}`}
              onPress={() => void remove(tag)}
              style={[styles.chip, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}
            >
              <AppText variant="label" style={{ color: colors.primary }}>
                #{tag.name}
              </AppText>
              <Ionicons name="close" size={13} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      ) : (
        <AppText variant="label" tone="muted">
          No tags on this note yet.
        </AppText>
      )}

      <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
        <Ionicons name="pricetag-outline" size={16} color={colors.textMuted} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="New tag, e.g. research"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text, fontFamily: fontFamily.regular }]}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (draft.trim() && !busy) void add(draft);
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add tag"
          disabled={!draft.trim() || busy}
          onPress={() => void add(draft)}
          hitSlop={8}
        >
          <Ionicons name="add-circle" size={24} color={draft.trim() ? colors.primary : colors.textMuted} />
        </Pressable>
      </View>

      {available.length ? (
        <>
          <AppText variant="overline" tone="muted" style={{ marginTop: spacing.md }}>
            Existing tags
          </AppText>
          <View style={styles.wrap}>
            {available.map((tag) => (
              <Pressable
                key={tag.id}
                accessibilityRole="button"
                accessibilityLabel={`Add tag ${tag.name}`}
                onPress={() => void add(tag.name, tag)}
                style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <AppText variant="label" tone="secondary">
                  #{tag.name}
                </AppText>
                <Ionicons name="add" size={13} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.md,
  },
  input: { flex: 1, paddingVertical: 10, fontSize: 15 },
});
