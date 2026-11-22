/** Fatal-but-recoverable startup failure (database engine could not start). */
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconTile } from '@/components/IconTile';
import { useColors } from '@/store/useSettingsStore';
import { spacing } from '@/design/tokens';

export function StartupError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const colors = useColors();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.canvas }]}>
      <View style={styles.content}>
        <IconTile name="warning-outline" accent="red" size="xl" />
        <AppText variant="title2" center style={{ marginTop: spacing.lg }}>
          Notely could not open your notebook
        </AppText>
        <AppText variant="caption" tone="secondary" center style={{ marginTop: spacing.sm }}>
          {message}
        </AppText>
        <AppText variant="caption" tone="muted" center style={{ marginTop: spacing.sm }}>
          Your existing notes are not deleted. Retry to reopen the local database.
        </AppText>
        <Button label="Retry" onPress={onRetry} style={{ marginTop: spacing.xl }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
});
