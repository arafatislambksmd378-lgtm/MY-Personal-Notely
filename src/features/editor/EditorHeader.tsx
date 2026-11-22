/** Editor top bar: back, editable title, save status and note actions. */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useColors } from '@/store/useSettingsStore';
import { fontFamily } from '@/design/typography';
import { radii, spacing } from '@/design/tokens';
import { formatClock } from '@/utils/dates';
import type { SaveStatus } from '@/hooks/useAutosave';

interface EditorHeaderProps {
  title: string;
  onTitleChange: (value: string) => void;
  onBack: () => void;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  onOpenComments: () => void;
  onTogglePin: () => void;
  isPinned: boolean;
  onOpenOptions: () => void;
  commentCount: number;
  readOnly?: boolean;
}

export function EditorHeader({
  title,
  onTitleChange,
  onBack,
  saveStatus,
  lastSavedAt,
  onOpenComments,
  onTogglePin,
  isPinned,
  onOpenOptions,
  commentCount,
  readOnly,
}: EditorHeaderProps) {
  const colors = useColors();
  const statusLabel =
    saveStatus === 'saving'
      ? 'Saving…'
      : saveStatus === 'pending'
        ? 'Unsaved changes'
        : saveStatus === 'error'
          ? 'Save failed — retrying'
          : lastSavedAt
            ? `Saved · ${formatClock(lastSavedAt)}`
            : 'Saved';

  return (
    <View style={[styles.wrapper, { borderBottomColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to notes"
        onPress={onBack}
        hitSlop={10}
        style={styles.backButton}
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>

      <View style={styles.titleBlock}>
        <TextInput
          value={title}
          onChangeText={onTitleChange}
          placeholder="Untitled"
          placeholderTextColor={colors.textMuted}
          style={[styles.titleInput, { color: colors.text }]}
          accessibilityLabel="Note title"
          editable={!readOnly}
          returnKeyType="done"
          selectTextOnFocus={false}
        />
        <AppText variant="label" tone={saveStatus === 'error' ? 'danger' : 'muted'} numberOfLines={1}>
          {statusLabel}
        </AppText>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isPinned ? 'Unpin note' : 'Pin note to top'}
          onPress={onTogglePin}
          hitSlop={6}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: isPinned ? colors.primarySoft : pressed ? colors.surfaceMuted : 'transparent' },
          ]}
        >
          <Ionicons name={isPinned ? 'bookmark' : 'bookmark-outline'} size={19} color={isPinned ? colors.primary : colors.textSecondary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Comments${commentCount ? `, ${commentCount} open` : ''}`}
          onPress={onOpenComments}
          hitSlop={6}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: pressed ? colors.surfaceMuted : 'transparent' },
          ]}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.textSecondary} />
          {commentCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <AppText variant="label" style={{ color: '#FFFFFF', fontSize: 9 }}>
                {commentCount > 9 ? '9+' : commentCount}
              </AppText>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Note options"
          onPress={onOpenOptions}
          hitSlop={6}
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: pressed ? colors.surfaceMuted : 'transparent' },
          ]}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  backButton: { width: 30, height: 36, alignItems: 'flex-start', justifyContent: 'center' },
  titleBlock: { flex: 1, marginLeft: 2 },
  titleInput: {
    fontFamily: fontFamily.bold,
    fontSize: 16.5,
    paddingVertical: 0,
    letterSpacing: -0.2,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: radii.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
});
