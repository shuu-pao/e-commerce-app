import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { change, formatOrderNumber, totals } from '@/domain/checkout';
import { formatDateTime } from '@/domain/dates';
import { formatPeso } from '@/domain/money';
import { paymentLabel } from '@/domain/types';
import { useAppState, useEventName } from '@/data/hooks';
import { cartEditOrder, remove } from '@/data/store';
import { syncEnabled } from '@/data/sync';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { OrderLines } from '@/ui/OrderLines';
import { Card, Empty, Row, Screen } from '@/ui/Screen';
import { colors } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

/** The receipt on screen: right after checkout ("Order placed"), and from All orders. */
export default function OrderSummary() {
  const { id, placed } = useLocalSearchParams<{ id: string; placed?: string }>();
  const order = useAppState((s) => s.db.orders[id]);
  const unsynced = useAppState((s) => !!s.outbox[`orders/${id}`]);
  const syncNote = !syncEnabled ? 'Saved on this device.' : unsynced ? 'Saved on this device. Not synced yet.' : 'Synced';
  const cartBusy = useAppState((s) => s.cart.lines.length > 0 && s.cart.editingOrderId !== id);
  const eventName = useEventName();
  const [ask, setAsk] = useState<'edit' | 'delete' | null>(null);

  if (!order || order.deleted) {
    return (
      <Empty title="Order not found" message={order?.deleted ? 'This order was deleted.' : 'It may not have synced to this device yet.'}>
        <Button label="All orders" onPress={() => router.replace('/orders')} />
      </Empty>
    );
  }

  const t = totals(order);
  const changeDue = change(order.cashReceived, order.payments);
  const title = formatOrderNumber(order.number);
  const edit = () => {
    cartEditOrder(order);
    router.navigate('/sell');
  };

  return (
    <Screen maxWidth={640}>
      <Drawer.Screen options={{ title: placed ? 'Order placed' : `Order ${title}` }} />
      {placed ? (
        <View style={styles.placed}>
          <View style={styles.check}>
            <Ionicons name="checkmark" size={34} color={colors.accent} />
          </View>
          <Txt variant="title">Order placed</Txt>
        </View>
      ) : null}
      <View style={styles.head}>
        <Txt variant={placed ? 'heading' : 'title'}>Order {title}</Txt>
        <Txt color={colors.muted}>{formatDateTime(order.createdAt)} · {eventName(order.eventId)}</Txt>
        <Txt weight="semibold" color={syncEnabled && unsynced ? colors.warnInk : colors.okInk}>{syncNote}</Txt>
      </View>

      <Card>
        <OrderLines lines={order.lines} />
        <View style={styles.totals}>
          <Row label={`Subtotal (${t.pieces} ${t.pieces === 1 ? 'piece' : 'pieces'})`} value={formatPeso(t.subtotal)} />
          {t.discount ? <Row label={order.discount.kind === 'percent' ? `Discount (${order.discount.percent}%)` : 'Discount'} value={formatPeso(-t.discount)} /> : null}
          {t.deliveryFee ? <Row label="Delivery fee" value={formatPeso(t.deliveryFee)} /> : null}
          <Row label="Total" value={formatPeso(t.total)} strong />
        </View>
        <View style={styles.totals}>
          {order.payments.map((p, i) => (
            <Row key={i} label={order.payments.length > 1 ? `Paid by ${paymentLabel(p.method)}` : 'Paid by'} value={order.payments.length > 1 ? formatPeso(p.amount) : paymentLabel(p.method)} />
          ))}
          {order.cashReceived !== null ? <Row label="Cash received" value={formatPeso(order.cashReceived)} /> : null}
          {changeDue !== null ? <Row label="Change" value={formatPeso(changeDue)} /> : null}
        </View>
      </Card>

      {order.buyer ? (
        <Card>
          <Txt variant="label">Buyer</Txt>
          <Txt weight="semibold">{order.buyer.name || '—'}</Txt>
          {order.buyer.address ? <Txt color={colors.body}>{order.buyer.address}</Txt> : null}
        </Card>
      ) : null}

      <View style={styles.actions}>
        {placed ? <Button label="New order" size="lg" onPress={() => router.replace('/sell')} style={styles.grow} /> : null}
        <Button label="Edit order" variant={placed ? 'outline' : 'primary'} size="lg" icon="create-outline" onPress={() => (cartBusy ? setAsk('edit') : edit())} style={styles.grow} />
      </View>
      <Button label="Delete order" variant="danger" onPress={() => setAsk('delete')} style={styles.delete} />

      <ConfirmDialog
        visible={ask === 'edit'}
        title="Replace the current cart?"
        message="The items in the cart now are removed, and this order opens instead."
        confirmLabel="Edit this order"
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          setAsk(null);
          edit();
        }}
      />
      <ConfirmDialog
        visible={ask === 'delete'}
        title={`Delete order ${title}?`}
        message="Its items go back into stock and it leaves the reports. This can't be undone."
        confirmLabel="Delete order"
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          setAsk(null);
          remove('orders', order.id);
          router.replace('/orders');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  placed: { alignItems: 'center', gap: 10, paddingTop: 8 },
  check: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  head: { gap: 4 },
  totals: { gap: 8, paddingTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  grow: { flexGrow: 1, flexBasis: 200 },
  delete: { alignSelf: 'center' },
});
