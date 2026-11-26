/** Compact stack-screen header: back chevron, title, optional subtitle + action. */
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from '@/components/AppText';
import { useColors } from '@/store/useSettingsStore';
import { spacing } from '@/design/tokens';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}

export const ScreenHeader = React.memo(function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps) {
  const colors = useColors();
  const router = useRouter();
  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={onBack ?? (() => router.back())}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.titles}>
          <AppText variant="title3" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="label" tone="muted" numberOfLines={1} style={{ marginTop: 1 }}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <View style={styles.right}>{right}</View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { paddingBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { width: 34, height: 34, alignItems: 'flex-start', justifyContent: 'center' },
  titles: { flex: 1 },
  right: { minWidth: 34, alignItems: 'flex-end' },
});
