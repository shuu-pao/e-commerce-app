import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, radius, touch } from './theme';
import { Txt } from './Txt';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  columns?: number;
  style?: StyleProp<ViewStyle>;
}

/** A row or grid of toggle buttons where one is picked (discount type, payment method, …). */
export function Choice<T extends string>({ options, value, onChange, label, columns, style }: Props<T>) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.row, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={({ hovered }) => [
              styles.option,
              columns ? { flexBasis: `${100 / columns - 2}%`, flexGrow: 1 } : null,
              on ? styles.on : hovered && styles.hover,
            ]}
          >
            <Txt style={[styles.text, on && styles.textOn]}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minHeight: touch,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hover: { borderColor: colors.accent },
  on: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  text: { fontFamily: fonts.semibold, fontSize: 15 },
  textOn: { color: colors.accent },
});
