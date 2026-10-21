import { StyleSheet, View } from 'react-native';

import { colors } from './theme';
import { Txt } from './Txt';

interface BarRow {
  key: string;
  label: string;
  value: number;
  detail: string;
}

/** A ranked list with a bar per row, scaled to the largest value. */
export function BarList({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <View style={styles.list}>
      {rows.map((r) => (
        <View key={r.key} style={styles.row} accessible accessibilityLabel={`${r.label}: ${r.detail}`}>
          <View style={styles.text}>
            <Txt weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{r.label}</Txt>
            <Txt color={colors.body} style={styles.num}>{r.detail}</Txt>
          </View>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${(r.value / max) * 100}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: { gap: 6 },
  text: { flexDirection: 'row', gap: 12 },
  num: { fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.raised, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
