/**
 * Code editor with lightweight, dependency-free syntax highlighting.
 *
 * Each source line is tokenized (`codeTokenizer`) and rendered as coloured
 * `AppText` spans inside a `FlatList`, with a line-number gutter. A transparent
 * `TextInput` sits on top to capture editing; both share the same font and line
 * metrics so the colours stay aligned with the typed text. No heavy editor
 * library is pulled in, keeping memory flat on 3 GB RAM devices.
 *
 * Controlled via `value`/`onChange`; the caller persists (see
 * `useCodeWorkspaceStore.saveFile`).
 */
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useColors } from '@/store/useSettingsStore';
import { spacing } from '@/design/tokens';
import { tokenizeLine, type Token } from './codeTokenizer';

interface CodeEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  minHeight?: number;
}

/* Map token kinds to AppText tones (valid tones only) and to colour tokens. */
const TOKEN_TONE: Record<string, 'default' | 'secondary' | 'muted' | 'primary' | 'success'> = {
  keyword: 'primary',
  tag: 'primary',
  attribute: 'primary',
  string: 'success',
  comment: 'muted',
  number: 'default',
  operator: 'default',
  selector: 'primary',
  property: 'primary',
  value: 'secondary',
  builtin: 'primary',
  plain: 'default',
};

const TOKEN_COLOR: Record<string, string> = {
  keyword: 'primary',
  tag: 'primary',
  attribute: 'info',
  string: 'success',
  comment: 'muted',
  number: 'warning',
  operator: 'text',
  selector: 'primary',
  property: 'primary',
  value: 'textSecondary',
  builtin: 'info',
  plain: 'text',
};

export function CodeEditor({ value, language, onChange, readOnly = false, minHeight }: CodeEditorProps) {
  const colors = useColors();
  const [innerValue, setInnerValue] = useState(value);

  const lines = useMemo(() => innerValue.split('\n'), [innerValue]);

  const rows = useMemo(
    () => lines.map((line, index) => ({ index, line, tokens: tokenizeLine(language, line) })),
    [lines, language],
  );

  const handleChange = (text: string) => {
    setInnerValue(text);
    onChange(text);
  };

  const renderLine = ({ item }: { item: { index: number; line: string; tokens: Token[] } }) => {
    return (
      <View style={styles.line} key={String(item.index)}>
        <AppText variant="caption" tone="muted" style={styles.lineNumber}>
          {String(item.index + 1).padStart(3, ' ')}
        </AppText>
        <View style={styles.lineContent}>
          {item.tokens.map((token, ti) => (
            <AppText
              key={ti}
              variant="caption"
              tone={TOKEN_TONE[token.kind] ?? 'default'}
              style={{ color: tokenColor(token.kind, colors) }}
            >
              {token.value}
            </AppText>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Transparent editing surface over the coloured token layer. */}
      <TextInput
        style={[styles.input, minHeight ? { minHeight } : null]}
        value={innerValue}
        onChangeText={handleChange}
        editable={!readOnly}
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={Math.max(4, lines.length)}
        underlineColorAndroid="transparent"
        selectionColor={colors.primary}
        textAlignVertical="top"
        testID="code-editor"
      />
      <FlatList
        data={rows}
        renderItem={renderLine}
        keyExtractor={(_, index) => String(index)}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={styles.tokenLayer}
        style={styles.tokenList}
      />
    </View>
  );
}

function tokenColor(kind: string, colors: ReturnType<typeof useColors>): string {
  const key = TOKEN_COLOR[kind];
  const toneMap: Record<string, string> = {
    text: colors.text,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    primary: colors.primary,
    info: colors.info,
    success: colors.success,
    warning: colors.warning,
    muted: colors.textMuted,
  };
  return toneMap[key ?? 'text'] ?? colors.text;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    minHeight: 240,
  },
  input: {
    position: 'absolute',
    inset: 0,
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
    color: 'transparent',
    backgroundColor: 'transparent',
    paddingHorizontal: 40,
    paddingVertical: 10,
    minHeight: 240,
  },
  tokenLayer: {
    paddingHorizontal: 40,
    paddingVertical: 10,
  },
  tokenList: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  lineNumber: {
    width: 30,
    color: 'rgba(255,255,255,0.25)',
  },
  lineContent: { flex: 1 },
});
