import { StyleSheet, View } from 'react-native';

import { colors, radius } from './theme';
import { Txt } from './Txt';

/** One headline number with its label. */
/** `note` goes under the number: the event's name on Home, which a label cut off (small fixes). */
export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}${note ? `, ${note}` : ''}: ${value}`}>
      <Txt variant="small" numberOfLines={1}>{label}</Txt>
      <Txt variant="big" numberOfLines={1} adjustsFontSizeToFit>{value}</Txt>
      {note ? <Txt variant="small" numberOfLines={2} color={colors.body}>{note}</Txt> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { flexGrow: 1, flexBasis: 150, padding: 16, gap: 4, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg },
});
