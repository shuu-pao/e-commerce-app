import { StyleSheet, View } from 'react-native';

import { colors, radius } from './theme';
import { Txt } from './Txt';

/** One headline number with its label. */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Txt variant="small" numberOfLines={1}>{label}</Txt>
      <Txt variant="big" numberOfLines={1} adjustsFontSizeToFit>{value}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { flexGrow: 1, flexBasis: 180, padding: 16, gap: 4, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg },
});
