/** Screen scaffold: safe area, background, optional scroll container. */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/store/useSettingsStore';
import { layout, spacing } from '@/design/tokens';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: ViewStyle;
  footer?: ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  testID?: string;
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  contentStyle,
  footer,
  edges = ['top', 'left', 'right'],
  testID,
}: ScreenProps) {
  const colors = useColors();
  const padding = padded ? { paddingHorizontal: layout.screenPadding } : undefined;
  return (
    <SafeAreaView
      testID={testID}
      edges={edges}
      style={[styles.flex, { backgroundColor: colors.canvas }]}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, padding, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, padding, contentStyle]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingTop: spacing.sm, paddingBottom: spacing.xxxl + spacing.xxl },
});
