import { Icon } from './Icon';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { formatOrderNumber, lineTotal, stillEditable, totals } from '@/domain/checkout';
import { formatPeso } from '@/domain/money';
import type { OrderLine } from '@/domain/types';
import { useAppState, useStockLeft } from '@/data/hooks';
import { cartClear, cartSetQty } from '@/data/store';

import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { DeletedOrderNote } from './DeletedOrderNote';
import { Photo } from './Photo';
import { colors, radius } from './theme';
import { Txt } from './Txt';

/** The running order beside the products (or in a sheet on narrow screens). */
export function CartPanel({ onCheckout }: { onCheckout?: () => void }) {
  const cart = useAppState((s) => s.cart);
  const opened = useAppState((s) => (s.cart.editingOrderId ? s.db.orders[s.cart.editingOrderId] : undefined));
  const editing = stillEditable(opened);
  const deletedMeanwhile = !!opened && !editing;
  const products = useAppState((s) => s.db.products);
  const stock = useStockLeft(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const t = totals({ lines: cart.lines, discount: { kind: 'none' }, deliveryFee: 0 });

  const photoFor = (l: OrderLine) => {
    const p = products[l.productId];
    return p?.variants.find((v) => v.id === l.variantId)?.photo ?? p?.photo ?? null;
  };
  /** Quantity can't go above the stock left. Items whose product was since removed stay as they are. */
  const maxFor = (l: OrderLine) => {
    const p = products[l.productId];
    if (!p || p.deleted || !p.variants.some((v) => v.id === l.variantId)) return l.qty;
    return Math.max(stock.get(l.variantId) ?? 0, 0);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Txt variant="heading" style={{ flex: 1 }}>
          {editing ? `Editing order ${formatOrderNumber(editing.number)}` : 'Current order'}
        </Txt>
        {cart.lines.length > 0 || editing ? (
          <Button label={editing ? 'Stop editing' : 'Clear'} variant="ghost" onPress={() => setConfirmClear(true)} />
        ) : null}
      </View>
      {deletedMeanwhile && opened && cart.lines.length > 0 ? (
        <View style={styles.deleted}>
          <DeletedOrderNote number={opened.number} />
        </View>
      ) : null}

      {cart.lines.length === 0 ? (
        <View style={styles.empty}>
          <Txt color={colors.muted} style={{ textAlign: 'center' }}>Tap a product to add it here.</Txt>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.lines}>
          {cart.lines.map((l) => {
            const max = maxFor(l);
            const atMax = l.qty >= max;
            const label = l.name + (l.variantName ? `, ${l.variantName}` : '');
            return (
              // Two rows per line (design review 5): name and price, then the colour beside − qty + and remove.
              <View key={l.variantId} style={styles.line}>
                <Photo uri={photoFor(l)} name={l.name} size={52} />
                <View style={styles.lineBody}>
                  <View style={styles.lineTop}>
                    <Txt weight="semibold" numberOfLines={1} style={styles.lineName}>{l.name}</Txt>
                    <Txt weight="bold" style={styles.num}>{formatPeso(lineTotal(l))}</Txt>
                  </View>
                  <View style={styles.controls}>
                    <Txt variant="small" numberOfLines={2} style={styles.variant} color={atMax ? colors.accent : colors.muted}>
                      {[l.variantName, atMax ? 'no more left' : l.qty > 1 ? `${formatPeso(l.price)} each` : null].filter(Boolean).join(' · ')}
                    </Txt>
                    <View style={styles.stepper}>
                      <Step icon="remove" label={'Decrease ' + label} onPress={() => cartSetQty(l, l.qty - 1)} />
                      <Txt weight="bold" style={styles.qty} accessibilityLabel={`Quantity ${l.qty}`}>{l.qty}</Txt>
                      <Step icon="add" label={'Increase ' + label} disabled={atMax} onPress={() => cartSetQty(l, l.qty + 1)} />
                    </View>
                    <Pressable accessibilityRole="button" accessibilityLabel={'Remove ' + label} onPress={() => cartSetQty(l, 0)} hitSlop={4} style={styles.remove}>
                      <Icon name="close" size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.foot}>
        <View style={styles.row}>
          <Txt color={colors.body}>Total order</Txt>
          <Txt color={colors.body}>{t.pieces} {t.pieces === 1 ? 'piece' : 'pieces'}</Txt>
        </View>
        <View style={styles.row}>
          <Txt variant="heading">Total price</Txt>
          <Txt variant="big">{formatPeso(t.subtotal)}</Txt>
        </View>
        <Button
          label={editing ? 'Review changes' : 'Check out'}
          size="lg"
          disabled={cart.lines.length === 0}
          onPress={() => {
            onCheckout?.();
            router.push('/checkout');
          }}
        />
      </View>

      <ConfirmDialog
        visible={confirmClear}
        title={editing ? 'Stop editing this order?' : 'Clear the current order?'}
        message={editing ? 'The order stays as it was saved.' : 'Everything in the cart is removed.'}
        confirmLabel={editing ? 'Stop editing' : 'Clear'}
        cancelLabel={editing ? 'Keep editing' : 'Keep the order'}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          cartClear();
        }}
      />
    </View>
  );
}

function Step({ icon, label, disabled, onPress }: { icon: 'add' | 'remove'; label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ hovered }) => [styles.step, hovered && !disabled && { backgroundColor: colors.raised }, disabled && { opacity: 0.3 }]}
    >
      <Icon name={icon} size={17} color={colors.ink} />
    </Pressable>
  );
}

/** The − and + buttons: smaller than the usual 44 so a line fits on two rows, with a hit slop that makes up the rest. */
const STEP = 36;

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.white },
  head: { minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  deleted: { paddingHorizontal: 20, paddingTop: 12 },
  lines: { paddingHorizontal: 20 },
  line: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  lineBody: { flex: 1, minWidth: 0, gap: 4 },
  lineTop: { flexDirection: 'row', gap: 8, alignItems: 'baseline' },
  lineName: { flex: 1, minWidth: 0 },
  num: { fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  variant: { flex: 1, minWidth: 0 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.pill, backgroundColor: colors.white },
  step: { width: STEP, height: STEP, borderRadius: STEP / 2, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 26, textAlign: 'center', fontSize: 15, fontVariant: ['tabular-nums'] },
  remove: { width: STEP, height: STEP, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  foot: { padding: 20, gap: 10, borderTopWidth: 1, borderTopColor: colors.line },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
