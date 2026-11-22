import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { spacing } from '@/design/tokens';

export default function NotFound() {
  return (
    <Screen scroll={false}>
      <View style={styles.wrapper}>
        <AppText variant="title1">Page not found</AppText>
        <AppText variant="body" tone="secondary" center style={{ marginTop: spacing.sm }}>
          The screen you were looking for does not exist in Notely.
        </AppText>
        <Link href="/" asChild>
          <Button label="Back to Home" style={{ marginTop: spacing.xl }} />
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});
