import { StyleSheet, Text, type TextProps } from 'react-native';

import { colors, fonts, type Weight } from './theme';

const variants = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, color: colors.ink },
  heading: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  label: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  brand: { fontFamily: fonts.brand, fontSize: 21, lineHeight: 28, color: colors.brand },
  big: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32, color: colors.ink, fontVariant: ['tabular-nums'] },
});

interface Props extends TextProps {
  variant?: keyof typeof variants;
  weight?: Weight;
  color?: string;
}

/** Text in the app font. `weight` swaps the font file, which is how weights work across platforms. */
export function Txt({ variant = 'body', weight, color, style, ...rest }: Props) {
  return <Text {...rest} style={[variants[variant], weight && { fontFamily: fonts[weight] }, color ? { color } : null, style]} />;
}
