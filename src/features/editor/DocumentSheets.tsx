/**
 * Document-level sheets: comments, bookmarks, version history (with comparison)
 * and move-to-notebook.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/BottomSheet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconTile } from '@/components/IconTile';
import { useColors } from '@/store/useSettingsStore';
import { fontFamily } from '@/design/typography';
import { radii, spacing } from '@/design/tokens';
import type { Bookmark, DocComment, DocumentVersion, NotebookWithCount } from '@/types/models';
import { listComments, addComment, deleteComment, toggleCommentResolved } from '@/db/repositories/comments';
import { listBookmarks, deleteBookmark } from '@/db/repositories/bookmarks';
import { listVersions, restoreVersion, createVersion } from '@/db/repositories/versions';
import { formatFullDate, relativeTime } from '@/utils/dates';
import { diffLines } from '@/utils/diff';
import { notebookIconName } from '@/features/notebooks/icons';
import { htmlToPlainText } from '@/utils/text';
import { toast } from '@/store/useToastStore';

/* --------------------------------- comments --------------------------------- */

interface CommentsSheetProps {
  visible: boolean;
  onClose: () => void;
  documentId: string;
  quote: string | null;
  onChanged: () => void;
}

export function CommentsSheet({ visible, onClose, documentId, quote, onChanged }: CommentsSheetProps) {
  const colors = useColors();
  const [comments, setComments] = useState<DocComment[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setComments(await listComments(documentId));
  }, [documentId]);

  useEffect(() => {
    if (visible) void load();
  }, [load, visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Comments" subtitle={`${comments.length} total`}>
      {quote ? (
        <View style={[styles.quoteBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <AppText variant="label" tone="muted">
            Commenting on
          </AppText>
          <AppText variant="caption" numberOfLines={2}>
            “{quote}”
          </AppText>
        </View>
      ) : null}
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Write a comment…"
        placeholderTextColor={colors.textMuted}
        multiline
        accessibilityLabel="Comment text"
        style={[
          styles.textarea,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      />
      <Button
        label="Add comment"
        icon="add"
        size="sm"
        loading={busy}
        disabled={!draft.trim()}
        onPress={async () => {
          setBusy(true);
          try {
            await addComment({ documentId, body: draft, quote });
            setDraft('');
            await load();
            onChanged();
            toast.success('Comment added');
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not add comment');
          } finally {
            setBusy(false);
          }
        }}
      />

      {comments.length === 0 ? (
        <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
          No comments yet. Comments stay on this device with the note.
        </AppText>
      ) : (
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {comments.map((comment) => (
            <View key={comment.id} style={[styles.commentCard, { borderColor: colors.border }]}>
              <View style={styles.commentHeader}>
                <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                  <AppText variant="label" tone="primary">
                    {comment.author.charAt(0).toUpperCase()}
                  </AppText>
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong">{comment.author}</AppText>
                  <AppText variant="label" tone="muted">
                    {relativeTime(comment.createdAt)}
                  </AppText>
                </View>
                {comment.isResolved ? (
                  <View style={[styles.resolvedPill, { backgroundColor: colors.surfaceMuted }]}>
                    <AppText variant="label" tone="muted">
                      Resolved
                    </AppText>
                  </View>
                ) : null}
              </View>
              {comment.quote ? (
                <AppText variant="label" tone="muted" numberOfLines={2}>
                  “{comment.quote}”
                </AppText>
              ) : null}
              <AppText variant="caption">{comment.body}</AppText>
              <View style={styles.commentActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={comment.isResolved ? 'Reopen comment' : 'Resolve comment'}
                  onPress={async () => {
                    await toggleCommentResolved(comment.id);
                    await load();
                    onChanged();
                  }}
                  style={styles.smallAction}
                >
                  <Ionicons name={comment.isResolved ? 'arrow-undo-outline' : 'checkmark-circle-outline'} size={15} color={colors.textSecondary} />
                  <AppText variant="label" tone="secondary">
                    {comment.isResolved ? 'Reopen' : 'Resolve'}
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete comment"
                  onPress={async () => {
                    await deleteComment(comment.id);
                    await load();
                    onChanged();
                  }}
                  style={styles.smallAction}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  <AppText variant="label" tone="danger">
                    Delete
                  </AppText>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

/* --------------------------------- bookmarks -------------------------------- */

interface BookmarksSheetProps {
  visible: boolean;
  onClose: () => void;
  documentId: string;
  onAdd: (label: string) => Promise<void>;
  onJump: (anchor: string) => void;
}

export function BookmarksSheet({ visible, onClose, documentId, onAdd, onJump }: BookmarksSheetProps) {
  const colors = useColors();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [label, setLabel] = useState('');

  const load = useCallback(async () => {
    setBookmarks(await listBookmarks(documentId));
  }, [documentId]);

  useEffect(() => {
    if (visible) void load();
  }, [load, visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Bookmarks" subtitle="Jump back to a spot in this note">
      <View style={styles.inlineForm}>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder="Bookmark name"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Bookmark name"
          style={[
            styles.textarea,
            styles.inlineInput,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
          ]}
        />
        <Button
          label="Add"
          size="sm"
          disabled={!label.trim()}
          onPress={async () => {
            await onAdd(label.trim());
            setLabel('');
            await load();
          }}
        />
      </View>
      {bookmarks.length === 0 ? (
        <AppText variant="caption" tone="muted">
          No bookmarks yet. Add one to save your position, then tap it to jump straight back.
        </AppText>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {bookmarks.map((bookmark) => (
            <Pressable
              key={bookmark.id}
              accessibilityRole="button"
              accessibilityLabel={`Jump to ${bookmark.label}`}
              onPress={() => {
                onJump(bookmark.anchor);
                onClose();
              }}
              style={({ pressed }) => [
                styles.bookmarkRow,
                { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceMuted : colors.surface },
              ]}
            >
              <IconTile name="bookmark" accent="purple" size="sm" />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{bookmark.label}</AppText>
                <AppText variant="label" tone="muted">
                  {relativeTime(bookmark.createdAt)}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete bookmark ${bookmark.label}`}
                onPress={async () => {
                  await deleteBookmark(bookmark.id);
                  await load();
                }}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}
    </BottomSheet>
  );
}

/* ------------------------------ version history ------------------------------ */

interface VersionHistorySheetProps {
  visible: boolean;
  onClose: () => void;
  documentId: string;
  currentHtml: string;
  onRestored: () => void;
}

export function VersionHistorySheet({ visible, onClose, documentId, currentHtml, onRestored }: VersionHistorySheetProps) {
  const colors = useColors();
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setVersions(await listVersions(documentId));
  }, [documentId]);

  useEffect(() => {
    if (visible) void load();
  }, [load, visible]);

  const currentText = useMemo(() => htmlToPlainText(currentHtml), [currentHtml]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Version history"
      subtitle={`${versions.length} snapshot${versions.length === 1 ? '' : 's'}`}
    >
      <Button
        label="Save a snapshot now"
        variant="soft"
        size="sm"
        icon="camera-outline"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            const created = await createVersion(documentId, { force: true, label: 'Manual snapshot' });
            await load();
            toast.success(created ? 'Snapshot saved' : 'No changes since the last snapshot');
          } finally {
            setBusy(false);
          }
        }}
      />
      {versions.length === 0 ? (
        <AppText variant="caption" tone="muted">
          Snapshots are created automatically while you edit (at most one per minute). Save one now to keep this exact draft.
        </AppText>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {versions.map((version) => {
            const isOpen = expanded === version.id;
            const summary = isOpen
              ? diffLines(htmlToPlainText(version.contentHtml), currentText)
              : null;
            return (
              <View key={version.id} style={[styles.versionCard, { borderColor: colors.border }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Version from ${formatFullDate(version.createdAt)}`}
                  onPress={() => setExpanded(isOpen ? null : version.id)}
                  style={styles.versionHeader}
                >
                  <IconTile name="time-outline" accent="pink" size="sm" />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{formatFullDate(version.createdAt)}</AppText>
                    <AppText variant="label" tone="muted">
                      {version.wordCount} words{version.label ? ` · ${version.label}` : ''}
                    </AppText>
                  </View>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                </Pressable>
                {summary ? (
                  <View style={{ gap: spacing.sm }}>
                    <AppText variant="label" tone="muted">
                      Compared with the current note: +{summary.added} lines, −{summary.removed} lines
                    </AppText>
                    <View style={[styles.diffBox, { backgroundColor: colors.surfaceMuted }]}>
                      {summary.segments.slice(0, 12).map((segment, index) => (
                        <AppText
                          key={`${version.id}-${index}`}
                          variant="label"
                          numberOfLines={2}
                          style={{
                            color:
                              segment.kind === 'added'
                                ? colors.success
                                : segment.kind === 'removed'
                                  ? colors.danger
                                  : colors.textMuted,
                          }}
                        >
                          {segment.kind === 'added' ? '+ ' : segment.kind === 'removed' ? '− ' : '  '}
                          {segment.lines.join(' / ').slice(0, 160) || '(blank)'}
                        </AppText>
                      ))}
                    </View>
                    <Button
                      label="Restore this version"
                      size="sm"
                      variant="secondary"
                      icon="arrow-undo"
                      onPress={async () => {
                        await restoreVersion(version.id);
                        await load();
                        onRestored();
                        toast.success('Version restored');
                        onClose();
                      }}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </BottomSheet>
  );
}

/* ------------------------------ move to notebook ----------------------------- */

interface MoveToNotebookSheetProps {
  visible: boolean;
  onClose: () => void;
  notebooks: NotebookWithCount[];
  currentNotebookId: string;
  onSelect: (notebookId: string) => Promise<void>;
}

export function MoveToNotebookSheet({
  visible,
  onClose,
  notebooks,
  currentNotebookId,
  onSelect,
}: MoveToNotebookSheetProps) {
  const colors = useColors();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Move to notebook">
      <View style={{ gap: spacing.sm }}>
        {notebooks.map((notebook) => {
          const selected = notebook.id === currentNotebookId;
          return (
            <Pressable
              key={notebook.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={async () => {
                if (!selected) await onSelect(notebook.id);
                onClose();
              }}
              style={({ pressed }) => [
                styles.bookmarkRow,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                },
              ]}
            >
              <IconTile name={notebookIconName(notebook.icon)} accent={notebook.color} size="sm" />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{notebook.name}</AppText>
                <AppText variant="label" tone="muted">
                  {notebook.noteCount} notes
                </AppText>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={19} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  quoteBox: { borderRadius: radii.md, borderWidth: 1, padding: spacing.md, gap: 2 },
  textarea: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 84,
    fontFamily: fontFamily.medium,
    fontSize: 14.5,
    textAlignVertical: 'top',
  },
  inlineForm: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  inlineInput: { flex: 1, minHeight: 46, paddingVertical: spacing.sm },
  commentCard: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  resolvedPill: { borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  commentActions: { flexDirection: 'row', gap: spacing.lg },
  smallAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bookmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  versionCard: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  versionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  diffBox: { borderRadius: radii.sm, padding: spacing.sm, gap: 2, maxHeight: 180 },
});
