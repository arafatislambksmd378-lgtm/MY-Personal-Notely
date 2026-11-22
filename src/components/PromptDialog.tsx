/**
 * Centered text-input dialog (new notebook, rename, tag, link, footnote…).
 * Replaces the platform Alert prompt which does not exist on web.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { useColors } from '@/store/useSettingsStore';
import { fontFamily } from '@/design/typography';
import { radii, shadows, spacing } from '@/design/tokens';

interface PromptDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
  secureTextEntry?: boolean;
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void | Promise<void>;
  onClose: () => void;
  testID?: string;
}

export function PromptDialog({
  visible,
  title,
  message,
  placeholder,
  initialValue = '',
  submitLabel = 'Save',
  multiline,
  keyboardType = 'default',
  secureTextEntry,
  validate,
  onSubmit,
  onClose,
  testID,
}: PromptDialogProps) {
  const colors = useColors();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setError(null);
      setBusy(false);
    }
  }, [initialValue, visible]);

  const submit = async () => {
    const validationError = validate ? validate(value) : value.trim() ? null : 'This field is required';
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(value.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} />
        <View style={[styles.card, shadows.sheet, { backgroundColor: colors.surface }]} testID={testID}>
          <AppText variant="title3">{title}</AppText>
          {message ? (
            <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
              {message}
            </AppText>
          ) : null}
          <TextInput
            value={value}
            onChangeText={(next) => {
              setValue(next);
              if (error) setError(null);
            }}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            autoFocus
            multiline={multiline}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            onSubmitEditing={submit}
            accessibilityLabel={title}
            style={[
              styles.input,
              {
                color: colors.text,
                fontFamily: fontFamily.medium,
                backgroundColor: colors.surfaceMuted,
                borderColor: error ? colors.danger : colors.border,
                minHeight: multiline ? 96 : 48,
                textAlignVertical: multiline ? 'top' : 'center',
              },
            ]}
          />
          {error ? (
            <AppText variant="caption" tone="danger" style={{ marginTop: spacing.xs }}>
              {error}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" size="sm" onPress={onClose} style={{ flex: 1 }} />
            <Button label={submitLabel} size="sm" onPress={submit} loading={busy} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 420, borderRadius: radii.xl, padding: spacing.xl, gap: spacing.sm },
  input: { borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 15 },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
});
