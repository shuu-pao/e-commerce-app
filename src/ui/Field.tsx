import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { colors, fonts, radius, touch } from './theme';
import { Txt } from './Txt';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  error?: string | null;
  /** Money and counts: shows the number pad. */
  numeric?: boolean;
  style?: StyleProp<ViewStyle>;
  hideLabel?: boolean;
}

export function Field({ label, hint, error, numeric, style, hideLabel, multiline, ...input }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      {!hideLabel && <Txt weight="semibold" style={styles.label}>{label}</Txt>}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        keyboardType={numeric ? 'decimal-pad' : input.keyboardType}
        inputMode={numeric ? 'decimal' : input.inputMode}
        multiline={multiline}
        {...input}
        style={[styles.input, multiline && styles.multiline, !!error && styles.inputError]}
      />
      {error ? <Txt variant="small" color={colors.accent} weight="semibold">{error}</Txt> : hint ? <Txt variant="small">{hint}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14 },
  input: {
    minHeight: touch + 2,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    fontFamily: fonts.regular,
    fontSize: 16, // 16+ stops iOS Safari zooming in on focus
    color: colors.ink,
  },
  multiline: { minHeight: 80, paddingTop: 10, textAlignVertical: 'top' },
  inputError: { borderColor: colors.accent },
});
