import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { addDays, dateKey, formatDate } from '@/domain/dates';
import { formatPeso } from '@/domain/money';
import { bestSellers, byDay, filterOrders, pcs, summarize } from '@/domain/reports';
import { useAppState } from '@/data/hooks';
import { BarList } from '@/ui/BarList';
import { Button } from '@/ui/Button';
import { DayBars } from '@/ui/DayBars';
import { Card, Screen } from '@/ui/Screen';
import { Stat } from '@/ui/Stat';
import { colors } from '@/ui/theme';
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
  const todays = useMemo(() => filterOrders(Object.values(orders), { range: { from: today, to: today }, sales: true }), [orders, today]);
  const eventOrders = useMemo(() => (event ? filterOrders(Object.values(orders), { eventId: event.id, sales: true }) : []), [orders, event]);
  const s = summarize(todays);
  const peso = (cents: number) => (shown ? formatPeso(cents) : HIDDEN);
  const best = bestSellers(todays, 5);
  // The last 7 days, today last (small fixes: replaces the shortcuts that repeated the Reports menu item).
  const week = useMemo(() => {
    const from = addDays(today, -6);
    const days = new Map(byDay(filterOrders(Object.values(orders), { range: { from, to: today }, sales: true })).map((d) => [d.day, d.sales]));
    return Array.from({ length: 7 }, (_, i) => addDays(from, i)).map((day) => ({ day, value: days.get(day) ?? 0 }));
  }, [orders, today]);
  const weekTotal = week.reduce((n, d) => n + d.value, 0);

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
        {event && !event.deleted ? <Stat label="This event" value={peso(summarize(eventOrders).sales)} note={event.name} /> : null}
      </View>

      <View style={styles.cols}>
        <Card style={styles.col}>
          <Txt variant="heading">Best sellers today</Txt>
          {best.length ? (
            <BarList rows={best.map((b) => ({ key: b.productId, label: b.name, value: b.pieces, detail: `${pcs(b.pieces)} · ${peso(b.sales)}` }))} />
          ) : (
            <Txt color={colors.muted}>No sales yet today.</Txt>
          )}
        </Card>
        <Card style={styles.col}>
          <View style={styles.chartHead}>
            <Txt variant="heading" style={{ flex: 1 }}>Sales, last 7 days</Txt>
            <Txt weight="semibold" color={colors.body}>{peso(weekTotal)}</Txt>
          </View>
          <DayBars today={today} bars={week.map((d) => ({ ...d, text: peso(d.value) }))} />
          <Button label="Open Reports" variant="ghost" icon="chevron-forward" onPress={() => router.navigate({ pathname: '/reports', params: { view: 'day' } })} style={styles.more} />
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
  chartHead: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  more: { alignSelf: 'flex-start', marginLeft: -8 },
});
