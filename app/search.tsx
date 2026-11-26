/**
 * Search screen: instant full-text search over title, body and tags with
 * notebook/collection filters. Uses the local FTS index, so it works offline.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SearchBar } from '@/components/SearchBar';
import { AppText } from '@/components/AppText';
import { NoteCard } from '@/features/home/NoteCard';
import { EmptyState } from '@/components/EmptyState';
import { useColors } from '@/store/useSettingsStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import {
  searchDocuments,
  duplicateDocument,
  patchDocument,
  togglePinned,
  trashDocument,
} from '@/db/repositories/documents';
import { listTags } from '@/db/repositories/tags';
import { splitHighlight } from '@/utils/search';
import { NoteOptionsSheet } from '@/features/editor/NoteOptionsSheet';
import { toast } from '@/store/useToastStore';
import type { DocumentSummary, Tag } from '@/types/models';
import { radii, spacing } from '@/design/tokens';

export default function SearchScreen() {
  const router = useRouter();
  const colors = useColors();
  const refreshLibrary = useLibraryStore((state) => state.refresh);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DocumentSummary[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [optionsNote, setOptionsNote] = useState<DocumentSummary | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const requestId = useRef(0);

  const openNoteOptions = useCallback((note: DocumentSummary) => {
    setOptionsNote(note);
    setOptionsVisible(true);
  }, []);

  useEffect(() => {
    void listTags().then(setTags).catch(() => undefined);
  }, []);

  const run = useCallback(async (text: string) => {
    const id = ++requestId.current;
    if (!text.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const found = await searchDocuments(text.trim(), 60);
      if (id === requestId.current) setResults(found);
    } finally {
      if (id === requestId.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void run(query), 160);
    return () => clearTimeout(timer);
  }, [query, run]);

  const visible = useMemo(() => {
    if (!activeTag) return results;
    return results.filter((note) => note.title.toLowerCase().includes(`#${activeTag}`));
  }, [activeTag, results]);

  const suggestions = ['meeting notes', 'ideas', 'todo', 'budget'];

  return (
    <Screen scroll={false} contentStyle={{ paddingHorizontal: 0 }}>
      <View style={{ paddingHorizontal: spacing.lg }}>
        <ScreenHeader title="Search" subtitle={`${results.length} ${results.length === 1 ? 'result' : 'results'}`} />
        <SearchBar value={query} onChangeText={setQuery} autoFocus placeholder="Search titles, text and tags…" />
      </View>

      {tags.length ? (
        <View style={styles.tagRow}>
          {tags.slice(0, 8).map((tag) => {
            const selected = tag.name === activeTag;
            return (
              <Pressable
                key={tag.id}
                onPress={() => setActiveTag(selected ? null : tag.name)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <AppText variant="label" style={{ color: selected ? colors.onPrimary : colors.textSecondary }}>
                  #{tag.name}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.sm }}
        renderItem={({ item }) => (
          <View>
            <NoteCard
              note={item}
              variant="row"
              onPress={() => router.push({ pathname: '/note/[id]', params: { id: item.id } })}
              onLongPress={() => openNoteOptions(item)}
            />
            {query.trim() ? (
              <AppText variant="label" tone="muted" numberOfLines={1} style={styles.snippet}>
                {splitHighlight(item.excerpt || item.title, query.trim()).map((part, index) =>
                  part.match ? (
                    <AppText key={index} variant="label" style={{ color: colors.primary }}>
                      {part.text}
                    </AppText>
                  ) : (
                    part.text
                  ),
                )}
              </AppText>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          query.trim() ? (
            <EmptyState
              icon={searching ? 'hourglass-outline' : 'search-outline'}
              title={searching ? 'Searching…' : 'No matches'}
              message={`Nothing matched “${query.trim()}”. Try a shorter word or a different spelling.`}
            />
          ) : (
            <View style={{ paddingTop: spacing.lg, gap: spacing.md }}>
              <AppText variant="label" tone="muted">
                SEARCH SUGGESTIONS
              </AppText>
              <View style={styles.tagRow}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => setQuery(suggestion)}
                    style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Ionicons name="sparkles-outline" size={13} color={colors.textMuted} />
                    <AppText variant="label" tone="secondary">
                      {suggestion}
                    </AppText>
                  </Pressable>
                ))}
              </View>
              <AppText variant="caption" tone="muted">
                Search runs entirely on this device — your notes never leave the phone to be indexed.
              </AppText>
            </View>
          )
        }
      />

      {optionsNote && (
        <NoteOptionsSheet
          visible={optionsVisible}
          variant="noteList"
          onClose={() => setOptionsVisible(false)}
          note={optionsNote}
          onColorChange={async (color) => {
            await patchDocument(optionsNote!.id, { cardColor: color });
            await refreshLibrary();
            toast.show('Note colour updated');
          }}
          onPinToggle={async () => {
            await togglePinned(optionsNote!.id);
            await refreshLibrary();
            toast.show(optionsNote!.isPinned ? 'Unpinned from top' : 'Pinned to top');
          }}
          onDuplicate={async () => {
            const copy = await duplicateDocument(optionsNote!.id);
            await refreshLibrary();
            toast.show('Copy created');
            router.push({ pathname: '/note/[id]', params: { id: copy.id } });
          }}
          onOpenEditor={() => {
            router.push({ pathname: '/note/[id]', params: { id: optionsNote!.id } });
          }}
          onDelete={async () => {
            await trashDocument(optionsNote!.id);
            await refreshLibrary();
            toast.show('Moved to Trash');
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  snippet: { marginTop: 2, paddingHorizontal: spacing.xs },
});
