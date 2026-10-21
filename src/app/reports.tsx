import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ordersToCsv } from '@/domain/csv';
import { addDays, dateKey, formatDate, formatDay, formatMonth } from '@/domain/dates';
import { formatPeso } from '@/domain/money';
import { bestSellers, byDay, byPayment, filterOrders, periodRange, shiftPeriod, summarize, type Period, type Range } from '@/domain/reports';
import { ONLINE_EVENT_ID, paymentLabel } from '@/domain/types';
import { useAppState, useEventName, useLive } from '@/data/hooks';
import { downloadText } from '@/lib/download';
import { BarList } from '@/ui/BarList';
import { Button } from '@/ui/Button';
import { Choice } from '@/ui/Choice';
import { DateField } from '@/ui/DateField';
import { Card, Row, Screen } from '@/ui/Screen';
import { Stat } from '@/ui/Stat';
import { colors } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

type View_ = Period | 'event' | 'range';
const VIEWS: { value: View_; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'event', label: 'Event' },
  { value: 'range', label: 'Choose dates' },
];
const isView = (v: unknown): v is View_ => VIEWS.some((x) => x.value === v);

export default function Reports() {
  const params = useLocalSearchParams<{ view?: string }>();
  const orders = useAppState((s) => s.db.orders);
  const currentEventId = useAppState((s) => s.settings.currentEventId);
  const events = useLive('events');
  const eventName = useEventName();
  const today = dateKey(new Date());

  // The view lives in the URL, so Home's shortcuts (and the browser's back button) pick it.
  const view: View_ = isView(params.view) ? params.view : 'day';
  const setView = (v: View_) => router.setParams({ view: v });
  const [anchor, setAnchor] = useState(today);
  const [eventId, setEventId] = useState(currentEventId ?? ONLINE_EVENT_ID);
  const [range, setRange] = useState<Range>({ from: addDays(today, -29), to: today });
  const [notice, setNotice] = useState<string | null>(null);

  const period = view === 'day' || view === 'week' || view === 'month' ? view : null;
  const activeRange = period ? periodRange(period, anchor) : view === 'range' ? range : undefined;
  const from = activeRange?.from;
  const to = activeRange?.to;
  const shown = useMemo(
    () => filterOrders(Object.values(orders), view === 'event' ? { eventId } : { range: from && to ? { from, to } : undefined }),
    [orders, view, eventId, from, to],
  );
  const s = summarize(shown);
  const days = byDay(shown);
  const pays = byPayment(shown);
  const best = bestSellers(shown, 10);

  const periodLabel =
    view === 'day' ? formatDate(anchor)
    : view === 'week' && activeRange ? `${formatDay(activeRange.from)} – ${formatDay(activeRange.to)}`
    : view === 'month' ? formatMonth(anchor)
    : '';

  const fileName =
    view === 'event' ? `caracebu-${eventName(eventId).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    : `caracebu-${activeRange?.from}-to-${activeRange?.to}`;

  return (
    <Screen maxWidth={1000}>
      <View style={styles.bar}>
        <Choice label="Report period" options={VIEWS} value={view} onChange={setView} style={{ flexShrink: 1 }} />
        <Button
          label="Download to Excel"
          variant="outline"
          icon="download-outline"
          disabled={!shown.length}
          onPress={() => {
            if (!downloadText(`${fileName}.csv`, ordersToCsv(shown, eventName))) setNotice('Downloading works in the web app.');
          }}
        />
      </View>
      {notice ? <Txt color={colors.accent}>{notice}</Txt> : null}

      {period ? (
        <View style={styles.nav}>
          <Button label="Previous" variant="ghost" icon="chevron-back" accessibilityLabel={`Previous ${period}`} onPress={() => setAnchor(shiftPeriod(period, anchor, -1))} />
          <Txt variant="heading" style={styles.navLabel}>{periodLabel}</Txt>
          <Button label="Next" variant="ghost" icon="chevron-forward" accessibilityLabel={`Next ${period}`} disabled={!!activeRange && activeRange.to >= today} onPress={() => setAnchor(shiftPeriod(period, anchor, 1))} />
          {anchor !== today ? <Button label="Today" variant="ghost" onPress={() => setAnchor(today)} /> : null}
        </View>
      ) : view === 'event' ? (
        <Choice
          label="Event"
          options={[...events].sort((a, b) => a.name.localeCompare(b.name)).map((e) => ({ value: e.id, label: e.name }))}
          value={eventId}
          onChange={setEventId}
        />
      ) : (
        <View style={styles.nav}>
          <View style={styles.date}><DateField label="From" value={range.from} onChange={(from) => setRange({ ...range, from })} /></View>
          <View style={styles.date}><DateField label="To" value={range.to} onChange={(to) => setRange({ ...range, to })} /></View>
        </View>
      )}

      <View style={styles.stats}>
        <Stat label="Total sales" value={formatPeso(s.sales)} />
        <Stat label="Orders" value={String(s.orders)} />
        <Stat label="Pieces sold" value={String(s.pieces)} />
        <Stat label="Discounts given" value={formatPeso(s.discounts)} />
        {s.deliveryFees ? <Stat label="Delivery fees" value={formatPeso(s.deliveryFees)} /> : null}
      </View>

      {shown.length === 0 ? (
        <Txt color={colors.muted}>No orders in this period.</Txt>
      ) : (
        <View style={styles.cols}>
          <Card style={styles.col}>
            <Txt variant="heading">Best sellers</Txt>
            <BarList rows={best.map((b) => ({ key: b.productId, label: b.name, value: b.pieces, detail: `${b.pieces} pcs · ${formatPeso(b.sales)}` }))} />
          </Card>
          <View style={[styles.col, { gap: 14 }]}>
            <Card>
              <Txt variant="heading">By day</Txt>
              {days.map((d) => (
                <Row key={d.day} label={formatDay(d.day)} value={`${d.orders} orders · ${d.pieces} pcs · ${formatPeso(d.sales)}`} />
              ))}
            </Card>
            <Card>
              <Txt variant="heading">By payment method</Txt>
              {pays.map((p) => <Row key={p.method} label={paymentLabel(p.method)} value={formatPeso(p.amount)} />)}
            </Card>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  nav: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  navLabel: { minWidth: 180, textAlign: 'center' },
  date: { width: 180 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  cols: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' },
  col: { flexGrow: 1, flexBasis: 340 },
});
