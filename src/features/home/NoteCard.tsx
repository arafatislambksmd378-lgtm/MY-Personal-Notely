/**
 * Recent-note card: coloured header band + title + excerpt, with a pin glyph
 * for pinned notes (matches the "Welcome to Notely" card in the reference).
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { useColors } from '@/store/useSettingsStore';
import { accentGradient, layout, radii, shadows, spacing } from '@/design/tokens';
import type { DocumentSummary } from '@/types/models';
import { relativeTime } from '@/utils/dates';

interface NoteCardProps {
  note: DocumentSummary;
  onPress: () => void;
  variant?: 'card' | 'row';
}

export const NoteCard = React.memo(function NoteCard({ note, onPress, variant = 'card' }: NoteCardProps) {
  const colors = useColors();

  if (variant === 'row') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={note.title}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.rowStripe, { backgroundColor: accentGradient[note.cardColor][0] }]} />
        <View style={styles.rowContent}>
          <View style={styles.rowHeader}>
            <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
              {note.title}
            </AppText>
            {note.isPinned ? <Ionicons name="bookmark" size={13} color={colors.primary} /> : null}
            {note.isFavorite ? <Ionicons name="heart" size={13} color={colors.danger} /> : null}
          </View>
          {note.excerpt ? (
            <AppText variant="caption" tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>
              {note.excerpt}
            </AppText>
          ) : null}
          <View style={styles.rowMeta}>
            <AppText variant="label" tone="muted">
              {relativeTime(note.updatedAt)}
            </AppText>
            <View style={styles.dot} />
            <AppText variant="label" tone="muted">
              {note.wordCount} words
            </AppText>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={note.title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        shadows.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.94 : 1 },
      ]}
    >
      <LinearGradient
        colors={accentGradient[note.cardColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.band}
      >
        {note.isPinned ? (
          <View style={styles.pinBadge}>
            <Ionicons name="pin" size={11} color="#FFFFFF" />
          </View>
        ) : null}
      </LinearGradient>
      <View style={styles.body}>
        <AppText variant="subtitle" numberOfLines={2} style={{ minHeight: 42 }}>
          {note.title}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={3} style={{ marginTop: 2, minHeight: 57 }}>
          {note.excerpt || 'Empty note — tap to start writing.'}
        </AppText>
        <View style={styles.meta}>
          <AppText variant="label" tone="muted">
            {relativeTime(note.updatedAt)}
          </AppText>
          {note.isFavorite ? <Ionicons name="heart" size={12} color={colors.danger} /> : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: layout.recentCardWidth,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  band: { height: 56, width: '100%', justifyContent: 'flex-start', alignItems: 'flex-end', padding: spacing.sm },
  pinBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    minHeight: 78,
  },
  rowStripe: { width: 5 },
  rowContent: { flex: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#C7C3D6' },
});
