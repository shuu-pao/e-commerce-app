import { createElement, useId } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, fonts, radius, touch } from './theme';
import { Txt } from './Txt';

interface Props {
  label: string;
  value: string;
  onChange: (key: string) => void;
}

/** The browser's own date picker (<input type="date">), which iPad Safari shows as a calendar. */
export function DateField({ label, value, onChange }: Props) {
  const id = useId();
  return (
    <View style={styles.wrap}>
      <label htmlFor={id}>
        <Txt weight="semibold" style={styles.label}>{label}</Txt>
      </label>
      {createElement('input', {
        id,
        type: 'date',
        value,
        onChange: (e: { target: { value: string } }) => e.target.value && onChange(e.target.value),
        style: inputStyle,
      })}
    </View>
  );
}

const inputStyle = {
  minHeight: touch + 2,
  boxSizing: 'border-box',
  padding: '0 12px',
  border: `1px solid ${colors.lineStrong}`,
  borderRadius: radius.md,
  background: colors.white,
  fontFamily: fonts.regular,
  fontSize: 16,
  color: colors.ink,
} as const;

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 14 },
});
