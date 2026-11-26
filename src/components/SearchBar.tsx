/** Rounded search field from the Home screen. */
import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useColors } from '@/store/useSettingsStore';
import { fontFamily } from '@/design/typography';
import { radii, spacing } from '@/design/tokens';

interface SearchBarProps {
  value?: string;
  placeholder?: string;
  onChangeText?: (value: string) => void;
  onSubmit?: () => void;
  onPress?: () => void;
  autoFocus?: boolean;
  editable?: boolean;
  testID?: string;
}

export const SearchBar = React.memo(function SearchBar({
  value,
  placeholder = 'Search notes, tables, ideas…',
  onChangeText,
  onSubmit,
  onPress,
  autoFocus,
  editable = true,
  testID,
}: SearchBarProps) {
  const colors = useColors();
  const body = (
    <View style={[styles.wrapper, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        testID={testID}
        style={[styles.input, { color: colors.text, fontFamily: fontFamily.medium }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        autoFocus={autoFocus}
        editable={editable}
        returnKeyType="search"
        accessibilityLabel="Search notes"
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChangeText?.('')}>
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable accessibilityRole="search" onPress={onPress}>
        {body}
      </Pressable>
    );
  }
  return body;
});

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md + 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: spacing.lg,
    height: 50,
  },
  input: { flex: 1, fontSize: 14.5, paddingVertical: 0 },
});
