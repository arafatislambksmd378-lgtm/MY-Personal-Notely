/**
 * Editor bottom action bar (reference: purple "+" tile, Aa, image, mic, search,
 * collapse chevron).
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useColors } from '@/store/useSettingsStore';
import { radii, shadows, spacing } from '@/design/tokens';

interface EditorBottomBarProps {
  onOpenInsert: () => void;
  onOpenTextStyle: () => void;
  onInsertImage: () => void;
  onDictate: () => void;
  onFind: () => void;
  onToggleCollapse: () => void;
  collapsed: boolean;
  /** Extra padding so the bar clears the Android gesture pill / iOS home bar. */
  bottomInset?: number;
}

interface BarButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  primary?: boolean;
  badge?: string;
}

function BarButton({ icon, label, onPress, primary, badge }: BarButtonProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: colors.primary, ...shadows.card }
          : { backgroundColor: pressed ? colors.surfaceSunken : colors.surface, borderColor: colors.border, borderWidth: 1 },
        pressed && { opacity: 0.88 },
      ]}
    >
      <Ionicons name={icon} size={primary ? 22 : 19} color={primary ? colors.onPrimary : colors.textSecondary} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name={badge as React.ComponentProps<typeof Ionicons>['name']} size={9} color={colors.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}

export function EditorBottomBar({
  onOpenInsert,
  onOpenTextStyle,
  onInsertImage,
  onDictate,
  onFind,
  onToggleCollapse,
  collapsed,
  bottomInset = 0,
}: EditorBottomBarProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: colors.canvas,
          borderTopColor: colors.border,
          paddingBottom: spacing.sm + bottomInset,
        },
      ]}
    >
      <BarButton icon="add" label="Insert content" onPress={onOpenInsert} primary />
      <BarButton icon="text" label="Text style" onPress={onOpenTextStyle} />
      <BarButton icon="image-outline" label="Insert image" onPress={onInsertImage} />
      <BarButton icon="mic-outline" label="Voice typing" onPress={onDictate} />
      <BarButton icon="search-outline" label="Find and replace" onPress={onFind} />
      <View style={{ flex: 1 }} />
      <BarButton
        icon={collapsed ? 'chevron-up' : 'chevron-down'}
        label={collapsed ? 'Show tools' : 'Hide tools'}
        onPress={onToggleCollapse}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  button: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
