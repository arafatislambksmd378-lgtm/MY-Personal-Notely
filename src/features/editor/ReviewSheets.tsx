/**
 * Review tools: find & replace, word count and spelling/grammar review.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/BottomSheet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ToggleSwitch } from '@/components/ToggleSwitch';
import { useColors } from '@/store/useSettingsStore';
import { fontFamily } from '@/design/typography';
import { radii, spacing } from '@/design/tokens';
import { countCharsNoSpaces, countOccurrences, countParagraphs, countSentences } from '@/utils/text';
import { reviewText, dictionarySize, type ReviewIssue } from '@/services/spellcheck';

/* ------------------------------- find & replace ------------------------------- */

interface FindReplaceSheetProps {
  visible: boolean;
  onClose: () => void;
  plainText: string;
  onHighlight: (search: string, matchCase: boolean, index: number) => void;
  onReplace: (search: string, replacement: string, matchCase: boolean, limit: number) => Promise<number>;
  onClear: () => void;
}

export function FindReplaceSheet({
  visible,
  onClose,
  plainText,
  onHighlight,
  onReplace,
  onClear,
}: FindReplaceSheetProps) {
  const colors = useColors();
  const [search, setSearch] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const total = useMemo(() => countOccurrences(plainText, search, matchCase), [matchCase, plainText, search]);

  useEffect(() => {
    if (!visible) {
      setMessage(null);
      onClear();
    }
  }, [onClear, visible]);

  useEffect(() => {
    if (visible && search) onHighlight(search, matchCase, cursor);
  }, [cursor, matchCase, onHighlight, search, visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Find and replace" subtitle={`${total} match${total === 1 ? '' : 'es'}`}>
      <TextInput
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          setCursor(0);
          setMessage(null);
        }}
        placeholder="Find in note"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Find text"
        autoFocus
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      <TextInput
        value={replacement}
        onChangeText={setReplacement}
        placeholder="Replace with"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Replacement text"
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      <View style={styles.inlineRow}>
        <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
          Match case
        </AppText>
        <ToggleSwitch value={matchCase} onChange={setMatchCase} accessibilityLabel="Match case" />
      </View>
      <View style={styles.buttonRow}>
        <Button
          label="Previous"
          variant="secondary"
          size="sm"
          icon="chevron-up"
          disabled={total === 0}
          onPress={() => setCursor((current) => (total === 0 ? 0 : (current - 1 + total) % total))}
          style={{ flex: 1 }}
        />
        <Button
          label="Next"
          variant="secondary"
          size="sm"
          icon="chevron-down"
          disabled={total === 0}
          onPress={() => setCursor((current) => (total === 0 ? 0 : (current + 1) % total))}
          style={{ flex: 1 }}
        />
      </View>
      <View style={styles.buttonRow}>
        <Button
          label="Replace"
          variant="soft"
          size="sm"
          disabled={total === 0}
          onPress={async () => {
            const replaced = await onReplace(search, replacement, matchCase, 1);
            setMessage(replaced ? 'Replaced 1 occurrence' : 'Nothing replaced');
            setCursor(0);
          }}
          style={{ flex: 1 }}
        />
        <Button
          label="Replace all"
          size="sm"
          disabled={total === 0}
          onPress={async () => {
            const replaced = await onReplace(search, replacement, matchCase, 0);
            setMessage(`Replaced ${replaced} occurrence${replaced === 1 ? '' : 's'}`);
            setCursor(0);
          }}
          style={{ flex: 1 }}
        />
      </View>
      {message ? (
        <AppText variant="caption" tone="success">
          {message}
        </AppText>
      ) : null}
      <AppText variant="label" tone="muted">
        Replacements keep formatting: only matching text inside paragraphs is changed.
      </AppText>
    </BottomSheet>
  );
}

/* --------------------------------- word count --------------------------------- */

interface WordCountSheetProps {
  visible: boolean;
  onClose: () => void;
  plainText: string;
  wordCount: number;
  charCount: number;
  readingMinutes: number;
}

export function WordCountSheet({ visible, onClose, plainText, wordCount, charCount, readingMinutes }: WordCountSheetProps) {
  const colors = useColors();
  const rows = [
    { label: 'Words', value: wordCount.toLocaleString() },
    { label: 'Characters', value: charCount.toLocaleString() },
    { label: 'Characters (no spaces)', value: countCharsNoSpaces(plainText).toLocaleString() },
    { label: 'Sentences', value: countSentences(plainText).toLocaleString() },
    { label: 'Paragraphs', value: countParagraphs(plainText).toLocaleString() },
    { label: 'Reading time', value: readingMinutes > 0 ? `${readingMinutes} min` : '—' },
  ];
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Word count" subtitle="This note">
      <View style={[styles.statCard, { borderColor: colors.border }]}>
        {rows.map((row) => (
          <View key={row.label} style={styles.statRow}>
            <AppText variant="caption" tone="secondary">
              {row.label}
            </AppText>
            <AppText variant="bodyStrong">{row.value}</AppText>
          </View>
        ))}
      </View>
      <AppText variant="label" tone="muted">
        Counts update as you type. Reading time is estimated at 200 words per minute.
      </AppText>
    </BottomSheet>
  );
}

/* -------------------------------- spell check -------------------------------- */

interface SpellingSheetProps {
  visible: boolean;
  onClose: () => void;
  plainText: string;
  enabled: boolean;
  onReplace: (issue: ReviewIssue, replacement: string) => Promise<number>;
}

export function SpellingSheet({ visible, onClose, plainText, enabled, onReplace }: SpellingSheetProps) {
  const colors = useColors();
  const [ignored, setIgnored] = useState<string[]>([]);
  const [version, setVersion] = useState(0);
  const result = useMemo(
    () => reviewText(plainText, { spelling: enabled, grammar: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, plainText, version],
  );
  const issues = result.issues.filter((issue) => !ignored.includes(`${issue.kind}:${issue.text}`));

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Spelling and grammar"
      subtitle={`${issues.length} suggestion${issues.length === 1 ? '' : 's'} · ${result.checkedWords} words checked`}
    >
      {!enabled ? (
        <AppText variant="caption" tone="muted">
          Spelling checks are turned off in Settings → Editor. Grammar rules still run.
        </AppText>
      ) : null}
      {issues.length === 0 ? (
        <View style={styles.allGood}>
          <Ionicons name="checkmark-circle" size={26} color={colors.success} />
          <AppText variant="bodyStrong" style={{ marginTop: spacing.sm }}>
            No issues found
          </AppText>
          <AppText variant="caption" tone="muted" center>
            Notely reviewed {result.checkedWords} words against an on-device dictionary of {dictionarySize()} words and its grammar rules.
          </AppText>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {issues.slice(0, 40).map((issue) => (
            <View
              key={`${issue.kind}-${issue.text}-${issue.index}`}
              style={[styles.issueCard, { borderColor: colors.border }]}
            >
              <View style={styles.issueHeader}>
                <Ionicons
                  name={issue.kind === 'spelling' ? 'text-outline' : 'alert-circle-outline'}
                  size={15}
                  color={issue.kind === 'spelling' ? colors.danger : colors.warning}
                />
                <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {issue.text.trim()}
                </AppText>
                <AppText variant="label" tone="muted">
                  {issue.message}
                </AppText>
              </View>
              <View style={styles.suggestionRow}>
                {issue.suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    accessibilityRole="button"
                    accessibilityLabel={`Replace with ${suggestion}`}
                    onPress={async () => {
                      await onReplace(issue, suggestion);
                      setVersion((value) => value + 1);
                    }}
                    style={({ pressed }) => [
                      styles.suggestion,
                      { backgroundColor: pressed ? colors.primary : colors.primarySoft },
                    ]}
                  >
                    <AppText variant="caption" tone="primary">
                      {suggestion}
                    </AppText>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ignore this issue"
                  onPress={() => setIgnored((current) => [...current, `${issue.kind}:${issue.text}`])}
                  style={[styles.suggestion, { backgroundColor: colors.surfaceMuted }]}
                >
                  <AppText variant="caption" tone="secondary">
                    Ignore
                  </AppText>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
      <AppText variant="label" tone="muted">
        Checks run offline on this device. Proper nouns and acronyms are skipped.
      </AppText>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 46,
    fontFamily: fontFamily.medium,
    fontSize: 14.5,
    marginBottom: spacing.sm,
  },
  inlineRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xs },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  statCard: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  allGood: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  issueCard: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  issueHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  suggestion: { borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
});
