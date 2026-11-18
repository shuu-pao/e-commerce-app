import { StyleSheet, View } from 'react-native';

import { formatOrderNumber } from '@/domain/checkout';

import { colors, radius } from './theme';
import { Txt } from './Txt';

/** The order the cart was editing was deleted meanwhile (on its receipt or on the other device). */
export function DeletedOrderNote({ number }: { number: number }) {
  return (
    <View style={styles.note} accessibilityRole="alert">
      <Txt weight="semibold" color={colors.warnInk}>Order {formatOrderNumber(number)} was deleted while you were editing it.</Txt>
      <Txt variant="small" color={colors.warnInk}>These items will be placed as a new order, with a new number and today’s date.</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { gap: 4, padding: 12, borderRadius: radius.md, backgroundColor: colors.warnBg },
});
