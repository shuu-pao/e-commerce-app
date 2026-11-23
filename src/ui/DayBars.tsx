import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDay, keyToDate } from '@/domain/dates';

import { colors, radius } from './theme';
import { Txt } from './Txt';

export interface DayBar {
  /** YYYY-MM-DD */
  day: string;
  value: number;
  /** What the bar's label and tooltip say ("₱1,490", or "₱ ••••" while Home hides amounts). */
  text: string;
}

const weekday = new Intl.DateTimeFormat('en-PH', { weekday: 'short' });
const HEIGHT = 120;
const BAR = 24;

/**
 * Sales per day as columns (Home's last 7 days). One series, so no legend: the card's title names it.
 * Thin bars from one baseline, rounded only at the top; only the best day and today carry a label,
 * the others show theirs on hover, and every bar reads out its day and amount to a screen reader.
 */
export function DayBars({ bars, today }: { bars: DayBar[]; today: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const best = bars.reduce<DayBar | null>((m, b) => (b.value > 0 && (!m || b.value > m.value) ? b : m), null);
  return (
    <View style={styles.wrap}>
      <View style={styles.plot}>
        {bars.map((b) => {
          const labelled = b.day === hover || b.day === today || b.day === best?.day;
          return (
            <Pressable
              key={b.day}
              accessible
              accessibilityLabel={`${formatDay(b.day)}: ${b.text}`}
              onHoverIn={() => setHover(b.day)}
              onHoverOut={() => setHover((h) => (h === b.day ? null : h))}
              onPress={() => setHover(hover === b.day ? null : b.day)}
              style={styles.slot}
            >
              <Txt variant="small" numberOfLines={1} style={[styles.value, !labelled && styles.hidden]} color={colors.ink}>
                {b.value > 0 ? b.text : '—'}
              </Txt>
              <View style={[styles.bar, { height: b.value > 0 ? Math.max(4, (b.value / max) * HEIGHT) : 0 }, b.day === hover && styles.barHover]} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis} />
      <View style={styles.days}>
        {bars.map((b) => (
          <Txt key={b.day} variant="small" weight={b.day === today ? 'bold' : undefined} color={b.day === today ? colors.ink : colors.muted} style={styles.day}>
            {b.day === today ? 'Today' : weekday.format(keyToDate(b.day))}
          </Txt>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  plot: { height: HEIGHT + 22, flexDirection: 'row', alignItems: 'flex-end' },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' },
  value: { fontSize: 11, lineHeight: 14, fontVariant: ['tabular-nums'] },
  hidden: { opacity: 0 },
  bar: { width: BAR, borderTopLeftRadius: radius.sm / 2, borderTopRightRadius: radius.sm / 2, backgroundColor: colors.accent },
  barHover: { backgroundColor: colors.accentDark },
  axis: { height: 1, backgroundColor: colors.lineStrong },
  days: { flexDirection: 'row', paddingTop: 6 },
  day: { flex: 1, textAlign: 'center' },
});
