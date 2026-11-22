/**
 * Insert tools: table, link, footnote, symbols, equation, chart and voice input.
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
import { buildChartSvg, parseChartValues, type ChartType } from '@/utils/chart';
import { startDictation, voiceInputStatus, type DictationSession } from '@/services/voice';

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="label" tone="muted">
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        autoFocus={autoFocus}
        accessibilityLabel={label}
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            minHeight: multiline ? 84 : 46,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
    </View>
  );
}

/* ----------------------------------- table ---------------------------------- */

export function TableSheet({
  visible,
  onClose,
  onInsert,
}: {
  visible: boolean;
  onClose: () => void;
  onInsert: (rows: number, columns: number, withHeader: boolean) => void;
}) {
  const colors = useColors();
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(3);
  const [header, setHeader] = useState(true);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Insert table">
      <View style={[styles.card, { borderColor: colors.border }]}>
        <View style={styles.stepperRow}>
          <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
            Rows
          </AppText>
          <Pressable accessibilityLabel="Remove row" onPress={() => setRows((value) => Math.max(1, value - 1))} style={[styles.stepBtn, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="remove" size={15} color={colors.textSecondary} />
          </Pressable>
          <AppText variant="bodyStrong" style={{ width: 32, textAlign: 'center' }}>
            {rows}
          </AppText>
          <Pressable accessibilityLabel="Add row" onPress={() => setRows((value) => Math.min(20, value + 1))} style={[styles.stepBtn, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="add" size={15} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.stepperRow}>
          <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
            Columns
          </AppText>
          <Pressable accessibilityLabel="Remove column" onPress={() => setColumns((value) => Math.max(1, value - 1))} style={[styles.stepBtn, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="remove" size={15} color={colors.textSecondary} />
          </Pressable>
          <AppText variant="bodyStrong" style={{ width: 32, textAlign: 'center' }}>
            {columns}
          </AppText>
          <Pressable accessibilityLabel="Add column" onPress={() => setColumns((value) => Math.min(8, value + 1))} style={[styles.stepBtn, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="add" size={15} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.stepperRow}>
          <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
            Header row
          </AppText>
          <ToggleSwitch value={header} onChange={setHeader} accessibilityLabel="Header row" />
        </View>
      </View>
      <Button
        label="Insert table"
        onPress={() => {
          onInsert(rows, columns, header);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

/* ------------------------------------ link ---------------------------------- */

export function LinkSheet({
  visible,
  onClose,
  onInsert,
}: {
  visible: boolean;
  onClose: () => void;
  onInsert: (href: string, label: string) => void;
}) {
  const [href, setHref] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setHref('');
      setLabel('');
      setError(null);
    }
  }, [visible]);

  const valid = /^(https?:\/\/|mailto:|tel:)/i.test(href.trim());

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Insert link">
      <Field label="Link address" value={href} onChange={setHref} placeholder="https://example.com" autoFocus />
      <Field label="Text to display" value={label} onChange={setLabel} placeholder="Optional — uses the address" />
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
      <Button
        label="Insert link"
        onPress={() => {
          if (!valid) {
            setError('Use a full URL starting with http://, https://, mailto: or tel:');
            return;
          }
          onInsert(href.trim(), label.trim() || href.trim());
          onClose();
        }}
      />
    </BottomSheet>
  );
}

/* ---------------------------------- footnote -------------------------------- */

export function FootnoteSheet({
  visible,
  onClose,
  nextMarker,
  onInsert,
}: {
  visible: boolean;
  onClose: () => void;
  nextMarker: number;
  onInsert: (marker: string, text: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Insert footnote" subtitle={`Reference ${nextMarker}`}>
      <Field label="Footnote text" value={text} onChange={setText} placeholder="Source, clarification or reference" multiline autoFocus />
      <Button
        label="Insert footnote"
        disabled={!text.trim()}
        onPress={() => {
          onInsert(String(nextMarker), text.trim());
          setText('');
          onClose();
        }}
      />
    </BottomSheet>
  );
}

/* ---------------------------------- symbols --------------------------------- */

const SYMBOL_GROUPS: { title: string; symbols: string[] }[] = [
  { title: 'Math', symbols: ['±', '×', '÷', '≠', '≈', '≤', '≥', '√', '∞', '∑', '∏', '∫', '∂', '∆', 'π', 'µ'] },
  { title: 'Arrows', symbols: ['←', '→', '↑', '↓', '↔', '⇒', '⇔', '↗', '↘', '⟶', '⇢', '↺'] },
  { title: 'Punctuation', symbols: ['—', '–', '…', '•', '·', '†', '‡', '§', '¶', '©', '®', '™'] },
  { title: 'Marks', symbols: ['✓', '✗', '★', '☆', '◆', '●', '○', '■', '□', '⚑', '⚡', '♥'] },
  { title: 'Currency', symbols: ['$', '€', '£', '¥', '৳', '₹', '₿', '¢'] },
  { title: 'Greek', symbols: ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'σ', 'τ', 'φ', 'ω', 'Ω'] },
];

export function SymbolsSheet({
  visible,
  onClose,
  onInsert,
}: {
  visible: boolean;
  onClose: () => void;
  onInsert: (symbol: string) => void;
}) {
  const colors = useColors();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Symbols">
      {SYMBOL_GROUPS.map((group) => (
        <View key={group.title} style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
          <AppText variant="overline" tone="muted">
            {group.title}
          </AppText>
          <View style={styles.symbolGrid}>
            {group.symbols.map((symbol) => (
              <Pressable
                key={`${group.title}-${symbol}`}
                accessibilityRole="button"
                accessibilityLabel={`Insert ${symbol}`}
                onPress={() => onInsert(symbol)}
                style={({ pressed }) => [
                  styles.symbolButton,
                  { borderColor: colors.border, backgroundColor: pressed ? colors.primarySoft : colors.surface },
                ]}
              >
                <AppText variant="subtitle">{symbol}</AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </BottomSheet>
  );
}

/* --------------------------------- equation --------------------------------- */

const EQUATION_SNIPPETS = [
  { label: 'x²', value: 'x²' },
  { label: '√x', value: '√x' },
  { label: 'aᵢ', value: 'aᵢ' },
  { label: '∑', value: '∑' },
  { label: '∫', value: '∫' },
  { label: '≤', value: '≤' },
  { label: '≠', value: '≠' },
  { label: '±', value: '±' },
  { label: 'Δ', value: 'Δ' },
  { label: 'π', value: 'π' },
];

export function EquationSheet({
  visible,
  onClose,
  onInsert,
}: {
  visible: boolean;
  onClose: () => void;
  onInsert: (html: string) => void;
}) {
  const colors = useColors();
  const [expression, setExpression] = useState('');
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Insert equation" subtitle="Formatted text with math symbols">
      <View style={styles.symbolGrid}>
        {EQUATION_SNIPPETS.map((snippet) => (
          <Pressable
            key={snippet.label}
            accessibilityRole="button"
            accessibilityLabel={`Add ${snippet.label}`}
            onPress={() => setExpression((current) => `${current}${snippet.value}`)}
            style={({ pressed }) => [
              styles.symbolButton,
              { borderColor: colors.border, backgroundColor: pressed ? colors.primarySoft : colors.surface },
            ]}
          >
            <AppText variant="subtitle">{snippet.label}</AppText>
          </Pressable>
        ))}
      </View>
      <Field label="Equation" value={expression} onChange={setExpression} placeholder="e.g. E = mc²" />
      <AppText variant="label" tone="muted">
        Equations are inserted as formatted text. A full LaTeX renderer is listed as a known limitation.
      </AppText>
      <Button
        label="Insert equation"
        disabled={!expression.trim()}
        onPress={() => {
          onInsert(
            `<p style="text-align:center;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:1.15em;">${expression
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}</p><p><br></p>`,
          );
          setExpression('');
          onClose();
        }}
      />
    </BottomSheet>
  );
}

/* ----------------------------------- chart ---------------------------------- */

export function ChartSheet({
  visible,
  onClose,
  onInsert,
}: {
  visible: boolean;
  onClose: () => void;
  onInsert: (svg: string, caption: string) => void;
}) {
  const colors = useColors();
  const [type, setType] = useState<ChartType>('bar');
  const [title, setTitle] = useState('');
  const [labels, setLabels] = useState('Mon, Tue, Wed, Thu');
  const [values, setValues] = useState('4, 7, 5, 9');
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseChartValues(values), [values]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Insert chart" subtitle="Rendered as vector graphics">
      <View style={styles.segmentRow}>
        {(['bar', 'line', 'pie'] as ChartType[]).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: type === option }}
            onPress={() => setType(option)}
            style={[
              styles.segment,
              {
                borderColor: type === option ? colors.primary : colors.border,
                backgroundColor: type === option ? colors.primarySoft : colors.surface,
              },
            ]}
          >
            <AppText variant="caption" style={{ textTransform: 'capitalize' }}>
              {option}
            </AppText>
          </Pressable>
        ))}
      </View>
      <Field label="Title" value={title} onChange={setTitle} placeholder="Weekly focus hours" />
      <Field label="Labels (comma separated)" value={labels} onChange={setLabels} placeholder="Mon, Tue, Wed" />
      <Field label="Values (comma separated)" value={values} onChange={setValues} placeholder="4, 7, 5" />
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
      <AppText variant="label" tone="muted">
        {parsed.length} value{parsed.length === 1 ? '' : 's'} detected
      </AppText>
      <Button
        label="Insert chart"
        onPress={() => {
          if (!parsed.length) {
            setError('Add at least one numeric value.');
            return;
          }
          const svg = buildChartSvg({
            type,
            title: title.trim(),
            labels: labels.split(',').map((label) => label.trim()),
            values: parsed,
          });
          onInsert(svg, title.trim());
          onClose();
        }}
      />
    </BottomSheet>
  );
}

/* ----------------------------------- voice ---------------------------------- */

export function VoiceSheet({
  visible,
  onClose,
  onInsert,
}: {
  visible: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
}) {
  const colors = useColors();
  const status = useMemo(() => voiceInputStatus(), []);
  const [session, setSession] = useState<DictationSession | null>(null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      session?.stop();
      setSession(null);
      setTranscript('');
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Voice typing">
      {status.available ? (
        <>
          <AppText variant="caption" tone="secondary">
            Speak and your words are transcribed into this note. Nothing is uploaded by Notely.
          </AppText>
          <View style={styles.segmentRow}>
            <Button
              label={session ? 'Stop dictation' : 'Start dictation'}
              variant={session ? 'danger' : 'primary'}
              icon={session ? 'stop' : 'mic'}
              onPress={() => {
                if (session) {
                  session.stop();
                  setSession(null);
                  return;
                }
                const next = startDictation((text) => setTranscript(text), (message) => setError(message));
                if (next) setSession(next);
                else setError('Dictation could not start on this device.');
              }}
              style={{ flex: 1 }}
            />
          </View>
        </>
      ) : (
        <View style={[styles.notice, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
          <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
            {status.reason}
          </AppText>
        </View>
      )}
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
      <Field label="Transcript" value={transcript} onChange={setTranscript} multiline placeholder="Your dictation appears here — edit before inserting" />
      <Button
        label="Insert text"
        disabled={!transcript.trim()}
        onPress={() => {
          onInsert(transcript.trim());
          session?.stop();
          setSession(null);
          onClose();
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.medium,
    fontSize: 14.5,
  },
  card: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, gap: spacing.md },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segmentRow: { flexDirection: 'row', gap: spacing.sm },
  segment: { flex: 1, height: 42, borderRadius: radii.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  symbolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  symbolButton: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, borderWidth: 1 },
});
