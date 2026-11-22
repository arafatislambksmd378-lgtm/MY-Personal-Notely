/** Destructive-action confirmation with an explicit, honest consequence message. */
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { IconTile } from './IconTile';
import { useColors } from '@/store/useSettingsStore';
import { radii, shadows, spacing } from '@/design/tokens';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = true,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} />
        <View style={[styles.card, shadows.sheet, { backgroundColor: colors.surface }]}>
          <IconTile name={destructive ? 'trash-outline' : 'help-circle-outline'} accent={destructive ? 'red' : 'purple'} size="lg" />
          <AppText variant="title3" style={{ marginTop: spacing.md }}>
            {title}
          </AppText>
          <AppText variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>
            {message}
          </AppText>
          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" size="sm" onPress={onClose} style={{ flex: 1 }} />
            <Button
              label={confirmLabel}
              size="sm"
              variant={destructive ? 'danger' : 'primary'}
              onPress={async () => {
                await onConfirm();
                onClose();
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 400, borderRadius: radii.xl, padding: spacing.xl },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
});
