import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { daysOverdue, formatOrderNumber, totals, unpaidFirst, unpaidNote } from '@/domain/checkout';
import { ordersToCsv } from '@/domain/csv';
import { addDays, dateKey, formatDateTime } from '@/domain/dates';
import { formatPeso } from '@/domain/money';
import { filterOrders, summarize } from '@/domain/reports';
import type { Order } from '@/domain/types';
import { paymentLabel } from '@/domain/types';
import { useAppState, useEventName, useLive } from '@/data/hooks';
import { syncEnabled } from '@/data/sync';
import { downloadText } from '@/lib/download';
import { Button } from '@/ui/Button';
import { Choice } from '@/ui/Choice';
import { DateField } from '@/ui/DateField';
import { Empty } from '@/ui/Screen';
import { RowsSkeleton, useFirstDownload } from '@/ui/Skeleton';
import { colors, radius, WIDE } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

/** Event filter values besides the events' own ids (which are UUIDs, so these can't clash). */
const ALL_EVENTS = 'all';
const NO_EVENT = 'none';

export default function Orders() {
  const orders = useAppState((s) => s.db.orders);
  const outbox = useAppState((s) => s.outbox);
  const events = useLive('events');
  const eventName = useEventName();
  const today = dateKey(new Date());
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [eventId, setEventId] = useState<string>(ALL_EVENTS);
  const [notice, setNotice] = useState<string | null>(null);
  const firstDownload = useFirstDownload();
  const { width } = useWindowDimensions();
  const table = (width >= WIDE ? width - 260 : width) >= 760;

  // Orders not paid yet stay on top whatever the dates, so none are forgotten (client, round 7).
  const [unpaid, paid] = useMemo(() => {
    const event = eventId === ALL_EVENTS ? undefined : eventId === NO_EVENT ? null : eventId;
    const all = Object.values(orders);
    return [
      unpaidFirst(all).filter((o) => event === undefined || o.eventId === event),
      filterOrders(all, { range: { from, to }, eventId: event }).filter((o) => !o.notPaid),
    ];
  }, [orders, from, to, eventId]);
  const shown = useMemo(() => [...unpaid, ...paid], [unpaid, paid]);
  const s = summarize(paid);
  const owed = summarize(unpaid);

  const download = () => {
    const ok = downloadText(`caracebu-orders-${from}-to-${to}.csv`, ordersToCsv(shown, eventName));
    if (!ok) setNotice('Downloading works in the web app. Open the shop in Safari or Chrome to download.');
  };

  const eventOptions = [
    { value: ALL_EVENTS, label: 'All events' },
    ...[...events].sort((a, b) => a.name.localeCompare(b.name)).map((e) => ({ value: e.id, label: e.name })),
    { value: NO_EVENT, label: 'No event' },
  ];

  return (
    <FlatList
      data={shown}
      keyExtractor={(o) => o.id}
      style={{ backgroundColor: colors.white }}
      contentContainerStyle={styles.page}
      ListHeaderComponent={
        <View style={styles.head}>
          <View style={styles.filters}>
            <View style={styles.date}><DateField label="From" value={from} onChange={setFrom} /></View>
            <View style={styles.date}><DateField label="To" value={to} onChange={setTo} /></View>
            <Button label="Download to Excel" variant="outline" icon="download-outline" onPress={download} disabled={!shown.length} style={styles.download} />
          </View>
          <Choice label="Event" options={eventOptions} value={eventId} onChange={setEventId} />
          {notice ? <Txt color={colors.accent}>{notice}</Txt> : null}
          <Txt color={colors.body}>
            {s.orders} paid {s.orders === 1 ? 'order' : 'orders'} · {s.pieces} {s.pieces === 1 ? 'piece' : 'pieces'} · <Txt weight="bold">{formatPeso(s.sales)}</Txt>
            {owed.orders ? <Txt color={colors.accent} weight="semibold">{`  ·  ${owed.orders} not paid yet (${formatPeso(owed.sales)})`}</Txt> : null}
          </Txt>
          {table && shown.length ? (
            <View style={[styles.row, styles.headRow]}>
              <Txt variant="label" style={styles.cNo}>Order</Txt>
              <Txt variant="label" style={styles.cWhen}>Date & time</Txt>
              <Txt variant="label" style={styles.cItems}>Items</Txt>
              <Txt variant="label" style={styles.cPay}>Payment</Txt>
              <Txt variant="label" style={styles.cDisc}>Discount</Txt>
              <Txt variant="label" style={styles.cTotal}>Total</Txt>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={firstDownload ? <RowsSkeleton /> : <Empty title="No orders" message="No orders match these dates and event." />}
      renderItem={({ item }) => <OrderRow order={item} table={table} today={today} unsynced={syncEnabled && !!outbox[`orders/${item.id}`]} eventName={eventName(item.eventId)} />}
    />
  );
}

function OrderRow({ order, table, today, unsynced, eventName }: { order: Order; table: boolean; today: string; unsynced: boolean; eventName: string }) {
  const t = totals(order);
  const pay = order.notPaid ? 'Not paid' : order.payments.map((p) => paymentLabel(p.method)).join(' + ');
  const late = order.notPaid && daysOverdue(order, today) > 0;
  const disc = t.discount ? (order.discount.kind === 'percent' ? `${order.discount.percent}%` : formatPeso(t.discount)) : '—';
  const open = () => router.push({ pathname: '/orders/[id]', params: { id: order.id } });
  const no = (
    <View style={[styles.cNo, styles.noCell]}>
      <Txt weight="bold">{formatOrderNumber(order.number)}</Txt>
      {unsynced ? <Txt style={styles.pill}>Not synced</Txt> : null}
    </View>
  );
  const due = order.notPaid ? (
    <Txt weight="semibold" style={[styles.duePill, late && styles.latePill]}>{unpaidNote(order, today)}</Txt>
  ) : null;
  if (table) {
    return (
      <Pressable accessibilityRole="link" accessibilityLabel={`Order ${formatOrderNumber(order.number)}, ${formatPeso(t.total)}`} onPress={open} style={({ hovered }) => [styles.row, hovered && styles.hover]}>
        {no}
        <View style={[styles.cWhen, styles.whenCell]}>
          <Txt color={colors.body}>{formatDateTime(order.createdAt)}</Txt>
          {due}
        </View>
        <Txt style={styles.cItems}>{t.pieces}</Txt>
        <Txt style={styles.cPay} numberOfLines={1} color={order.notPaid ? colors.accent : undefined} weight={order.notPaid ? 'semibold' : undefined}>{pay}</Txt>
        <Txt color={colors.body} style={styles.cDisc}>{disc}</Txt>
        <Txt weight="semibold" style={styles.cTotal}>{formatPeso(t.total)}</Txt>
      </Pressable>
    );
  }
  return (
    <Pressable accessibilityRole="link" onPress={open} style={({ hovered }) => [styles.card, hovered && styles.hover]}>
      <View style={styles.cardTop}>
        {no}
        <Txt weight="bold">{formatPeso(t.total)}</Txt>
      </View>
      {due ? <View style={styles.dueRow}>{due}</View> : null}
      <Txt variant="small">{formatDateTime(order.createdAt)} · {eventName}</Txt>
      <Txt variant="small">{t.pieces} {t.pieces === 1 ? 'piece' : 'pieces'} · {pay}{t.discount ? ` · ${disc} off` : ''}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 40, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  head: { gap: 14, paddingBottom: 8 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 },
  date: { width: 180 },
  download: { marginLeft: 'auto' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: colors.line },
  headRow: { minHeight: 40, backgroundColor: colors.surface, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  hover: { backgroundColor: colors.surface },
  noCell: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cNo: { width: 190 },
  cWhen: { flex: 1, minWidth: 0 },
  cItems: { width: 60, textAlign: 'right' },
  cPay: { width: 140 },
  cDisc: { width: 80, textAlign: 'right' },
  cTotal: { width: 100, textAlign: 'right', fontVariant: ['tabular-nums'] },
  whenCell: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  dueRow: { flexDirection: 'row' },
  duePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.warnBg, color: colors.warnInk, fontSize: 12, lineHeight: 16, overflow: 'hidden' },
  latePill: { backgroundColor: colors.accentSoft, color: colors.accent },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.warnBg, color: colors.warnInk, fontSize: 11, lineHeight: 15, overflow: 'hidden' },
  card: { gap: 4, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
