/** Renders the global snackbar above the tab bar. */
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { useColors } from '@/store/useSettingsStore';
import { useToastStore } from '@/store/useToastStore';
import { radii, shadows, spacing } from '@/design/tokens';

export function ToastHost() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { message, tone } = useToastStore();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: message ? 1 : 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: message ? 0 : 20, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [message, opacity, translateY]);

  if (!message) return null;

  const accent =
    tone === 'success' ? colors.success : tone === 'error' ? colors.danger : colors.primary;
  const icon = tone === 'success' ? 'checkmark-circle' : tone === 'error' ? 'alert-circle' : 'information-circle';

  return (
    <View pointerEvents="none" style={[styles.host, { bottom: insets.bottom + 84 }]}>
      <Animated.View
        style={[
          styles.toast,
          shadows.floating,
          { backgroundColor: colors.text, opacity, transform: [{ translateY }] },
        ]}
      >
        <Ionicons name={icon} size={17} color={accent} />
        <AppText variant="caption" style={{ color: colors.canvas, flexShrink: 1 }}>
          {message}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 999 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    maxWidth: '90%',
  },
});
