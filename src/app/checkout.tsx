import { router } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { change, checkoutProblems, formatOrderNumber, totals } from '@/domain/checkout';
import { centsToInput, formatPeso, parsePeso } from '@/domain/money';
import type { Discount, Id, Order, PaymentMethod } from '@/domain/types';
import { ONLINE_EVENT_ID, PAYMENT_METHODS } from '@/domain/types';
import { useAppState, useLive } from '@/data/hooks';
import { placeOrder } from '@/data/store';
import { Button } from '@/ui/Button';
import { Choice } from '@/ui/Choice';
import { Field } from '@/ui/Field';
import { OrderLines } from '@/ui/OrderLines';
import { Empty, Row } from '@/ui/Screen';
import { colors, radius, WIDE } from '@/ui/theme';
import { Txt } from '@/ui/Txt';
import { useFocusKey } from '@/ui/useFocusKey';

type DiscountChoice = 'none' | 'ten' | 'percent' | 'amount';
interface SplitRow {
  method: PaymentMethod;
  text: string;
}

const DISCOUNTS: { value: DiscountChoice; label: string }[] = [
  { value: 'none', label: 'No discount' },
  { value: 'ten', label: '10% off' },
  { value: 'percent', label: 'Percent off' },
  { value: 'amount', label: 'Peso amount off' },
];

function initialDiscount(order: Order | undefined): [DiscountChoice, string] {
  const d = order?.discount;
  if (!d || d.kind === 'none') return ['none', ''];
  if (d.kind === 'percent') return d.percent === 10 ? ['ten', ''] : ['percent', String(d.percent)];
  return ['amount', centsToInput(d.amount)];
}

export default function Checkout() {
  const focus = useFocusKey();
  const editingId = useAppState((s) => s.cart.editingOrderId);
  return <CheckoutForm key={`${editingId}-${focus}`} />;
}

function CheckoutForm() {
  const cart = useAppState((s) => s.cart);
  const editing = useAppState((s) => (s.cart.editingOrderId ? s.db.orders[s.cart.editingOrderId] : undefined));
  const currentEventId = useAppState((s) => s.settings.currentEventId);
  const events = useLive('events');
  const { width } = useWindowDimensions();
  const twoColumns = (width >= WIDE ? width - 260 : width) >= 900;

  const [eventId, setEventId] = useState<Id | null>(editing ? editing.eventId : currentEventId);
  const [[discountKind, discountText], setDiscount] = useState(() => initialDiscount(editing));
  const [buyerName, setBuyerName] = useState(editing?.buyer?.name ?? '');
  const [address, setAddress] = useState(editing?.buyer?.address ?? '');
  const [feeText, setFeeText] = useState(editing?.deliveryFee ? centsToInput(editing.deliveryFee) : '');
  const [split, setSplit] = useState((editing?.payments.length ?? 0) > 1);
  const [method, setMethod] = useState<PaymentMethod>(editing?.payments[0]?.method ?? 'cash');
  const [rows, setRows] = useState<SplitRow[]>(() =>
    editing && editing.payments.length > 1
      ? editing.payments.map((p) => ({ method: p.method, text: centsToInput(p.amount) }))
      : [{ method: 'cash', text: '' }, { method: 'gcash', text: '' }],
  );
  const [cashText, setCashText] = useState(editing?.cashReceived ? centsToInput(editing.cashReceived) : '');
  const [tried, setTried] = useState(false);

  const online = eventId === ONLINE_EVENT_ID;

  // ---- Turn what was typed into an order --------------------------------------
  const percent = discountKind === 'percent' ? Number(discountText) : NaN;
  const percentError = discountKind === 'percent' && !(discountText !== '' && percent >= 0 && percent <= 100) ? 'Type a percent from 0 to 100.' : null;
  const amountOff = discountKind === 'amount' ? parsePeso(discountText) : null;
  const amountError = discountKind === 'amount' && amountOff === null ? 'Type an amount, like 50.' : null;
  const discount: Discount =
    discountKind === 'ten' ? { kind: 'percent', percent: 10 }
    : discountKind === 'percent' && !percentError ? { kind: 'percent', percent }
    : discountKind === 'amount' && amountOff !== null ? { kind: 'amount', amount: amountOff }
    : { kind: 'none' };

  const fee = online && feeText ? parsePeso(feeText) : 0;
  const feeError = fee === null ? 'Type an amount, like 80.' : null;
  const t = totals({ lines: cart.lines, discount, deliveryFee: fee ?? 0 });

  const rowAmounts = rows.map((r) => (r.text ? parsePeso(r.text) : 0));
  const payments = split
    ? rows.map((r, i) => ({ method: r.method, amount: rowAmounts[i] ?? 0 })).filter((p) => p.amount > 0)
    : [{ method, amount: t.total }];
  const left = t.total - payments.reduce((n, p) => n + p.amount, 0);
  const takesCash = payments.some((p) => p.method === 'cash');
  const cashReceived = takesCash && cashText ? parsePeso(cashText) : null;
  const cashError = takesCash && cashText && cashReceived === null ? 'Type an amount, like 1000.' : null;
  const changeDue = change(cashReceived, payments);

  const draft = {
    eventId,
    lines: cart.lines,
    discount,
    deliveryFee: fee ?? 0,
    payments,
    cashReceived: takesCash ? cashReceived : null,
    buyer: online ? { name: buyerName.trim(), address: address.trim() } : null,
  };
  const problems = [
    ...checkoutProblems(draft),
    ...[percentError, amountError, feeError, cashError].filter((e): e is string => !!e),
    ...(online && !buyerName.trim() ? ["Add the buyer's name for an online order."] : []),
    ...(split && rowAmounts.some((a) => a === null) ? ['One of the payment amounts isn’t a number.'] : []),
  ];

  const place = () => {
    setTried(true);
    if (problems.length) return;
    const order = placeOrder(draft);
    router.replace({ pathname: '/orders/[id]', params: editing ? { id: order.id } : { id: order.id, placed: '1' } });
  };

  // ---- Event options: today's event and Online first --------------------------------
  const eventOptions = useMemo(() => {
    const pinned = [currentEventId, ONLINE_EVENT_ID, eventId].filter((id, i, a): id is Id => !!id && a.indexOf(id) === i);
    const rest = events
      .filter((e) => !pinned.includes(e.id))
      .sort((a, b) => (b.startDate ?? b.updatedAt).localeCompare(a.startDate ?? a.updatedAt))
      .slice(0, 4);
    const byId = new Map(events.map((e) => [e.id, e]));
    return [...pinned.map((id) => byId.get(id)).filter((e) => !!e), ...rest].map((e) => ({ value: e.id, label: e.name }));
  }, [events, currentEventId, eventId]);

  if (cart.lines.length === 0) {
    return (
      <Empty title="Nothing to check out" message="Add products on the Sell screen first.">
        <Button label="Go to Sell" onPress={() => router.replace('/sell')} />
      </Empty>
    );
  }

  const summary = (
    <View style={styles.col}>
      <Button label="Back to the cart" variant="ghost" icon="chevron-back" onPress={() => router.navigate('/sell')} style={styles.backLink} />
      <OrderLines lines={cart.lines} />
      <Row label="Total order" value={`${t.pieces} ${t.pieces === 1 ? 'piece' : 'pieces'}`} />
    </View>
  );

  const panel = (
    <View style={[styles.panel, twoColumns && styles.panelSide]}>
      <Section title="Event">
        <Choice label="Event" options={[...eventOptions, { value: '', label: 'No event' }]} value={eventId ?? ''} onChange={(v) => setEventId(v || null)} />
        {online ? (
          <View style={styles.group}>
            <Field label="Buyer's name" value={buyerName} onChangeText={setBuyerName} autoCapitalize="words" error={tried && !buyerName.trim() ? 'Needed for online orders.' : null} />
            <Field label="Address" value={address} onChangeText={setAddress} multiline placeholder="Street, barangay, city" />
            <Field label="Delivery fee (₱)" numeric value={feeText} onChangeText={setFeeText} placeholder="0" error={feeError} />
          </View>
        ) : null}
      </Section>

      <Section title="Discount">
        <Choice label="Discount" columns={2} options={DISCOUNTS} value={discountKind} onChange={(v) => setDiscount([v, ''])} />
        {discountKind === 'percent' ? (
          <Field label="Percent off (%)" numeric value={discountText} onChangeText={(v) => setDiscount(['percent', v])} placeholder="15" error={discountText || tried ? percentError : null} />
        ) : discountKind === 'amount' ? (
          <Field label="Amount off (₱)" numeric value={discountText} onChangeText={(v) => setDiscount(['amount', v])} placeholder="50" error={discountText || tried ? amountError : null} />
        ) : null}
      </Section>

      <Section title="Paid by">
        {split ? (
          <View style={styles.group}>
            {rows.map((r, i) => (
              <View key={i} style={styles.splitRow}>
                <Choice
                  label={`Payment ${i + 1} method`}
                  options={PAYMENT_METHODS.map((m) => ({ value: m.id, label: m.label }))}
                  value={r.method}
                  onChange={(m) => setRows(rows.map((x, j) => (j === i ? { ...x, method: m } : x)))}
                  style={{ flex: 1 }}
                />
                <View style={styles.splitAmount}>
                  <Field
                    label={`Amount ${i + 1} (₱)`}
                    hideLabel
                    numeric
                    value={r.text}
                    placeholder={left > 0 && !r.text ? centsToInput(left) : '0'}
                    onChangeText={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, text: v } : x)))}
                  />
                  {!r.text && left > 0 ? (
                    <Button label="Rest" variant="ghost" accessibilityLabel={`Put the remaining ${formatPeso(left)} here`} onPress={() => setRows(rows.map((x, j) => (j === i ? { ...x, text: centsToInput(left) } : x)))} />
                  ) : null}
                </View>
              </View>
            ))}
            <View style={styles.splitFoot}>
              {rows.length < 4 ? <Button label="Add a method" variant="ghost" icon="add" onPress={() => setRows([...rows, { method: 'gcash', text: '' }])} /> : <View />}
              <Txt weight="semibold" color={left === 0 ? colors.okInk : colors.accent}>
                {left > 0 ? `Still to pay ${formatPeso(left)}` : left < 0 ? `Over by ${formatPeso(-left)}` : 'Fully paid'}
              </Txt>
            </View>
          </View>
        ) : (
          <Choice label="Payment method" columns={2} options={PAYMENT_METHODS.map((m) => ({ value: m.id, label: m.label }))} value={method} onChange={setMethod} />
        )}
        <Button label={split ? 'Pay with one method' : 'Split payment'} variant="ghost" onPress={() => setSplit(!split)} style={styles.inlineButton} />
        {takesCash ? (
          <View style={styles.cashBox}>
            <Field
              label="Cash received (₱)"
              numeric
              value={cashText}
              onChangeText={setCashText}
              placeholder={centsToInput(payments.filter((p) => p.method === 'cash').reduce((n, p) => n + p.amount, 0))}
              error={cashError ?? (cashReceived !== null && changeDue === null ? 'Less than the cash amount.' : null)}
              style={{ flex: 1 }}
            />
            <View style={styles.change}>
              <Txt variant="small">Change</Txt>
              <Txt variant="big" color={colors.okInk}>{changeDue === null ? '—' : formatPeso(changeDue)}</Txt>
            </View>
          </View>
        ) : null}
      </Section>

      <View style={styles.totals}>
        <Row label="Subtotal" value={formatPeso(t.subtotal)} />
        {t.discount ? <Row label={discount.kind === 'percent' ? `Discount (${discount.percent}%)` : 'Discount'} value={formatPeso(-t.discount)} /> : null}
        {online ? <Row label="Delivery fee" value={formatPeso(t.deliveryFee)} /> : null}
        <Row label="Total" value={formatPeso(t.total)} strong />
      </View>
      {tried && problems.length ? (
        <View style={styles.problems} accessibilityLiveRegion="polite">
          {problems.map((p) => <Txt key={p} color={colors.accent} weight="semibold">{p}</Txt>)}
        </View>
      ) : null}
      <Button label={editing ? `Save order ${formatOrderNumber(editing.number)}` : 'Place order'} size="lg" onPress={place} />
    </View>
  );

  return (
    <>
      <Drawer.Screen options={{ title: editing ? `Edit order ${formatOrderNumber(editing.number)}` : 'Checkout' }} />
      {twoColumns ? (
        <View style={styles.twoCol}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.pad}>{summary}</ScrollView>
          <ScrollView style={styles.side} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">{panel}</ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.pad, styles.stack]} keyboardShouldPersistTaps="handled">
          {summary}
          {panel}
        </ScrollView>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section} accessibilityRole="summary">
      <Txt variant="label">{title}</Txt>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  twoCol: { flex: 1, flexDirection: 'row', backgroundColor: colors.white },
  side: { width: 440, flexGrow: 0, borderLeftWidth: 1, borderLeftColor: colors.line, backgroundColor: colors.surface },
  pad: { padding: 20, paddingBottom: 40 },
  stack: { gap: 24 },
  col: { gap: 12 },
  backLink: { alignSelf: 'flex-start', marginLeft: -8 },
  panel: { gap: 20 },
  panelSide: {},
  section: { gap: 10 },
  group: { gap: 12 },
  splitRow: { gap: 8, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  splitAmount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  splitFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  inlineButton: { alignSelf: 'flex-start', marginLeft: -8 },
  cashBox: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  change: { minWidth: 110, alignItems: 'flex-end', paddingBottom: 4 },
  totals: { gap: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  problems: { gap: 4, padding: 12, borderRadius: radius.md, backgroundColor: colors.accentSoft },
});
