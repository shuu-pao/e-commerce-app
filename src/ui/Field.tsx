import type { ComponentRef, Ref } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { colors, fonts, radius, touch } from './theme';
import { Txt } from './Txt';

/** What a Field's inputRef holds (focus(), blur()). */
export type FieldInput = ComponentRef<typeof TextInput>;

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  error?: string | null;
  /** Money and counts: shows the number pad. */
  numeric?: boolean;
  style?: StyleProp<ViewStyle>;
  hideLabel?: boolean;
  /** A small tag after the label, such as "Needed" or "Low". */
  tag?: { text: string; tone: 'needed' | 'warn' } | null;
  inputRef?: Ref<FieldInput>;
}

export function Field({ label, hint, error, numeric, style, hideLabel, multiline, tag, inputRef, ...input }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      {!hideLabel && (
        <View style={styles.labelRow}>
          <Txt weight="semibold" style={styles.label}>{label}</Txt>
          {tag ? <Txt weight="semibold" style={[styles.tag, tag.tone === 'warn' ? styles.tagWarn : styles.tagNeeded]}>{tag.text}</Txt> : null}
        </View>
      )}
      <TextInput
        ref={inputRef}
        accessibilityLabel={tag ? `${label}, ${tag.text.toLowerCase()}` : label}
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
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 14, flexShrink: 1 },
  tag: { flexShrink: 0, paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.pill, fontSize: 11, lineHeight: 16, overflow: 'hidden' },
  tagNeeded: { backgroundColor: colors.raised, color: colors.body },
  tagWarn: { backgroundColor: colors.warnBg, color: colors.warnInk },
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
