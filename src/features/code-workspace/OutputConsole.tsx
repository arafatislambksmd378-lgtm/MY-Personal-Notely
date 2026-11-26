/**
 * Output console for the Code Workspace.
 *
 * Displays messages produced while previewing / running code. Messages are
 * appended externally (via `onMessage` from the host) and can be cleared. The
 * console itself never executes code — it only displays text.
 */
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { useColors } from '@/store/useSettingsStore';
import { spacing } from '@/design/tokens';

interface OutputConsoleProps {
  visible: boolean;
  onClose: () => void;
  messages: string[];
  onMessage: (message: string) => void;
  onClear: () => void;
}

export function OutputConsole({ visible, onClose, messages, onMessage, onClear }: OutputConsoleProps) {
  const colors = useColors();

  if (!visible) return null;

  const addTestMessage = () => onMessage('Console ready — output from your code appears here.');

  return (
    <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <AppText variant="caption" style={{ color: colors.textSecondary, fontWeight: '700' }}>
          Output console
        </AppText>
        <View style={styles.spacer} />
        <PressableLite label="Clear" onPress={onClear} color={colors.danger} />
        <PressableLite label="Close" onPress={onClose} color={colors.primary} />
      </View>
      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <AppText variant="caption" style={[styles.line, { color: colors.textSecondary }]}>
            {item}
          </AppText>
        )}
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={styles.list}
      />
      {messages.length === 0 ? (
        <AppText variant="caption" tone="muted" style={styles.empty}>
          No output yet. Run your code to see results here.
        </AppText>
      ) : null}
      <PressableLite label="Test log" onPress={addTestMessage} color={colors.info} style={styles.testBar} />
    </View>
  );
}

function PressableLite({ label, onPress, color, style }: { label: string; onPress: () => void; color: string; style?: any }) {
  return (
    <Pressable onPress={onPress} style={[style, { marginRight: 10 }]}>
      <Text style={[{ fontSize: 12, fontWeight: '700', color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: '#00000000',
    padding: spacing.md,
    maxHeight: 220,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  spacer: { flex: 1 },
  list: { paddingBottom: spacing.sm },
  line: { paddingVertical: 2 },
  empty: { textAlign: 'center', paddingVertical: spacing.md },
  testBar: { marginTop: spacing.sm, alignSelf: 'flex-start' },
});
