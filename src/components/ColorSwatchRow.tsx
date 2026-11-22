/** "Card color" palette row with a check mark on the selected swatch. */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { accents, cardColorOrder, type AccentName } from '@/design/tokens';
import { spacing } from '@/design/tokens';
import { useColors } from '@/store/useSettingsStore';

interface ColorSwatchRowProps {
  value: AccentName;
  onChange: (value: AccentName) => void;
  colors?: AccentName[];
  testID?: string;
}

export function ColorSwatchRow({
  value,
  onChange,
  colors: palette = cardColorOrder,
  testID,
}: ColorSwatchRowProps) {
  const theme = useColors();
  return (
    <View style={styles.row} testID={testID}>
      {palette.map((name) => {
        const selected = name === value;
        return (
          <Pressable
            key={name}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${name} color`}
            onPress={() => onChange(name)}
            style={({ pressed }) => [
              styles.swatch,
              {
                backgroundColor: accents[name],
                borderColor: selected ? theme.text : 'transparent',
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}
            hitSlop={6}
          >
            {selected ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'center' },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
