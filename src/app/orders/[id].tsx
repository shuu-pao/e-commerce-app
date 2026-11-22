import { Icon } from '@/ui/Icon';
import { router, useLocalSearchParams } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { change, daysOverdue, formatOrderNumber, totals, unpaidNote } from '@/domain/checkout';
import { dateKey, formatDateTime } from '@/domain/dates';
import { formatPeso } from '@/domain/money';
import type { Order } from '@/domain/types';
import { paymentLabel } from '@/domain/types';
import { useAppState, useEventName } from '@/data/hooks';
import { cartEditOrder, makeInvoice, remove } from '@/data/store';
import { syncEnabled } from '@/data/sync';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Field } from '@/ui/Field';
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
  const [ask, setAsk] = useState<'edit' | 'pay' | 'delete' | null>(null);

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
  // Paying goes through Checkout, so split payments, cash and change work as they do there.
  const pay = () => {
    cartEditOrder(order);
    router.navigate({ pathname: '/checkout', params: { pay: '1' } });
  };
  const today = dateKey(new Date());
  const late = order.notPaid ? daysOverdue(order, today) : 0;
  const openDoc = (kind: 'invoice' | 'receipt') => router.push({ pathname: '/document', params: { id: order.id, kind } });

  return (
    <Screen maxWidth={640}>
      <Drawer.Screen options={{ title: placed ? 'Order placed' : `Order ${title}` }} />
      {placed ? (
        <View style={styles.placed}>
          <View style={styles.check}>
            <Icon name="checkmark" size={34} color={colors.accent} />
          </View>
          <Txt variant="title">Order placed</Txt>
        </View>
      ) : null}
      <View style={styles.head}>
        <Txt variant={placed ? 'heading' : 'title'}>Order {title}</Txt>
        <Txt color={colors.muted}>{formatDateTime(order.createdAt)} · {eventName(order.eventId)}</Txt>
        <Txt weight="semibold" color={syncEnabled && unsynced ? colors.warnInk : colors.okInk}>{syncNote}</Txt>
        {order.notPaid ? (
          <Txt weight="bold" color={late ? colors.accent : colors.warnInk}>Not paid yet · {unpaidNote(order, today)}</Txt>
        ) : null}
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
          {order.notPaid ? <Row label="Paid by" value="Not paid yet" /> : null}
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

      <InvoiceCard key={order.id + (order.invoice ? '-invoice' : '')} order={order} onOpen={openDoc} />

      <View style={styles.actions}>
        {order.notPaid ? <Button label="Mark as paid" size="lg" icon="checkmark" onPress={() => (cartBusy ? setAsk('pay') : pay())} style={styles.grow} /> : null}
        {placed ? <Button label="New order" size="lg" variant={order.notPaid ? 'outline' : 'primary'} onPress={() => router.replace('/sell')} style={styles.grow} /> : null}
        <Button label="Edit order" variant={placed || order.notPaid ? 'outline' : 'primary'} size="lg" icon="create-outline" onPress={() => (cartBusy ? setAsk('edit') : edit())} style={styles.grow} />
      </View>
      <Button label={order.notPaid ? 'Cancel order' : 'Delete order'} variant="danger" onPress={() => setAsk('delete')} style={styles.delete} />

      <ConfirmDialog
        visible={ask === 'edit' || ask === 'pay'}
        title="Replace the current cart?"
        message="The items in the cart now are removed, and this order opens instead."
        confirmLabel={ask === 'pay' ? 'Mark this order as paid' : 'Edit this order'}
        onCancel={() => setAsk(null)}
        onConfirm={() => {
          const then = ask === 'pay' ? pay : edit;
          setAsk(null);
          then();
        }}
      />
      <ConfirmDialog
        visible={ask === 'delete'}
        title={order.notPaid ? `Cancel order ${title}?` : `Delete order ${title}?`}
        message={order.notPaid ? "The buyer didn't pay: its pieces go back on sale. This can't be undone." : "Its items go back into stock and it leaves the reports. This can't be undone."}
        confirmLabel={order.notPaid ? 'Cancel order' : 'Delete order'}
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

/** The Invoice and Payment receipt of an order with "Make an invoice" ticked, or a way to tick it now. */
function InvoiceCard({ order, onOpen }: { order: Order; onOpen: (kind: 'invoice' | 'receipt') => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(order.buyer?.name ?? '');
  const [address, setAddress] = useState(order.buyer?.address ?? '');
  const [tried, setTried] = useState(false);

  if (order.invoice) {
    return (
      <Card>
        <Txt variant="label">Invoice and receipt</Txt>
        <Txt variant="small">For {order.buyer?.name || 'the buyer'}. Save them as a picture or a PDF.</Txt>
        <View style={styles.actions}>
          <Button label="Invoice" variant="outline" icon="download-outline" onPress={() => onOpen('invoice')} style={styles.grow} />
          {order.notPaid ? null : <Button label="Payment receipt" variant="outline" icon="download-outline" onPress={() => onOpen('receipt')} style={styles.grow} />}
        </View>
        {order.notPaid ? <Txt variant="small">The Payment receipt is ready once the order is marked paid.</Txt> : null}
      </Card>
    );
  }
  if (!open) {
    return <Button label="Make an invoice for this buyer" variant="ghost" icon="add" onPress={() => setOpen(true)} style={styles.makeInvoice} />;
  }
  const save = () => {
    setTried(true);
    if (!name.trim()) return;
    makeInvoice(order, { name: name.trim(), address: address.trim() });
  };
  return (
    <Card>
      <Txt variant="heading">Make an invoice</Txt>
      <Field label="Buyer's name" value={name} onChangeText={setName} autoCapitalize="words" autoFocus error={tried && !name.trim() ? 'Needed for the invoice.' : null} />
      <Field label="Address (you can leave it empty)" value={address} onChangeText={setAddress} multiline placeholder="Street, barangay, city" />
      <View style={styles.actions}>
        <Button label="Make the invoice" onPress={save} style={styles.grow} />
        <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
      </View>
    </Card>
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
  makeInvoice: { alignSelf: 'flex-start', marginLeft: -8 },
});
