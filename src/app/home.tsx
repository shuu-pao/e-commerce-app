import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dateKey, formatDate } from '@/domain/dates';
import { formatPeso } from '@/domain/money';
import { bestSellers, filterOrders, summarize } from '@/domain/reports';
import { useAppState } from '@/data/hooks';
import { BarList } from '@/ui/BarList';
import { Button } from '@/ui/Button';
import { Card, Screen } from '@/ui/Screen';
import { Stat } from '@/ui/Stat';
import { colors, fonts, radius } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

const HIDDEN = '₱ ••••';

/** The dashboard. It never opens by itself, and peso amounts stay hidden until asked for. */
export default function Home() {
  const orders = useAppState((s) => s.db.orders);
  const event = useAppState((s) => (s.settings.currentEventId ? s.db.events[s.settings.currentEventId] : undefined));
  const [shown, setShown] = useState(false);
  // Hide again whenever Home is left, so the amounts are never on screen by surprise.
  useFocusEffect(useCallback(() => () => setShown(false), []));

  const today = dateKey(new Date());
  const todays = useMemo(() => filterOrders(Object.values(orders), { range: { from: today, to: today } }), [orders, today]);
  const eventOrders = useMemo(() => (event ? filterOrders(Object.values(orders), { eventId: event.id }) : []), [orders, event]);
  const s = summarize(todays);
  const peso = (cents: number) => (shown ? formatPeso(cents) : HIDDEN);
  const best = bestSellers(todays, 5);

  return (
    <Screen maxWidth={1000}>
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Txt variant="title">Today</Txt>
          <Txt color={colors.muted}>{formatDate(today)}{event && !event.deleted ? ` · ${event.name}` : ''}</Txt>
        </View>
        <Button
          label={shown ? 'Hide amounts' : 'Show amounts'}
          variant="outline"
          icon={shown ? 'eye-off-outline' : 'eye-outline'}
          onPress={() => setShown(!shown)}
        />
        <Button label="Start selling" onPress={() => router.navigate('/sell')} />
      </View>

      <View style={styles.stats}>
        <Stat label="Sales today" value={peso(s.sales)} />
        <Stat label="Orders today" value={String(s.orders)} />
        <Stat label="Pieces sold today" value={String(s.pieces)} />
        {event && !event.deleted ? <Stat label={`${event.name} so far`} value={peso(summarize(eventOrders).sales)} /> : null}
      </View>

      <View style={styles.cols}>
        <Card style={styles.col}>
          <Txt variant="heading">Best sellers today</Txt>
          {best.length ? (
            <BarList rows={best.map((b) => ({ key: b.productId, label: b.name, value: b.pieces, detail: `${b.pieces} pcs · ${peso(b.sales)}` }))} />
          ) : (
            <Txt color={colors.muted}>No sales yet today.</Txt>
          )}
        </Card>
        <Card style={styles.col}>
          <Txt variant="heading">Reports</Txt>
          {(
            [
              ['day', 'Daily sales'],
              ['week', 'Weekly sales'],
              ['month', 'Monthly sales'],
              ['event', 'Sales per event'],
              ['range', 'Choose dates'],
            ] as const
          ).map(([view, label]) => (
            <Pressable
              key={view}
              accessibilityRole="link"
              onPress={() => router.navigate({ pathname: '/reports', params: { view } })}
              style={({ hovered }) => [styles.link, hovered && { borderColor: colors.accent }]}
            >
              <Txt style={styles.linkText}>{label}</Txt>
              <Txt color={colors.muted}>›</Txt>
            </Pressable>
          ))}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  cols: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  col: { flexGrow: 1, flexBasis: 320 },
  link: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md },
  linkText: { fontFamily: fonts.semibold },
});
