import { Icon } from './Icon';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { formatOrderNumber, lineTotal, totals } from '@/domain/checkout';
import { formatPeso } from '@/domain/money';
import type { OrderLine } from '@/domain/types';
import { useAppState, useStockLeft } from '@/data/hooks';
import { cartClear, cartSetQty } from '@/data/store';

import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { Photo } from './Photo';
import { colors, radius, touch } from './theme';
import { Txt } from './Txt';

/** The running order beside the products (or in a sheet on narrow screens). */
export function CartPanel({ onCheckout }: { onCheckout?: () => void }) {
  const cart = useAppState((s) => s.cart);
  const editing = useAppState((s) => (s.cart.editingOrderId ? s.db.orders[s.cart.editingOrderId] : undefined));
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
              <View key={l.variantId} style={styles.line}>
                <View style={styles.lineTop}>
                  <Photo uri={photoFor(l)} name={l.name} size={56} />
                  <View style={styles.lineText}>
                    <Txt weight="semibold" numberOfLines={2}>{l.name}</Txt>
                    <Txt variant="small">{(l.variantName ? `${l.variantName} · ` : '') + `${formatPeso(l.price)} each`}</Txt>
                  </View>
                  <Txt weight="bold" style={styles.num}>{formatPeso(lineTotal(l))}</Txt>
                </View>
                <View style={styles.controls}>
                  <Step icon="remove" label={'Decrease ' + label} onPress={() => cartSetQty(l, l.qty - 1)} />
                  <Txt weight="bold" style={styles.qty} accessibilityLabel={`Quantity ${l.qty}`}>{l.qty}</Txt>
                  <Step icon="add" label={'Increase ' + label} disabled={atMax} onPress={() => cartSetQty(l, l.qty + 1)} />
                  <Txt variant="small" style={{ flex: 1, paddingLeft: 6 }}>{atMax ? 'No more in stock' : ''}</Txt>
                  <Pressable accessibilityRole="button" accessibilityLabel={'Remove ' + label} onPress={() => cartSetQty(l, 0)} style={styles.remove}>
                    <Icon name="close" size={20} color={colors.muted} />
                  </Pressable>
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
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered }) => [styles.step, hovered && !disabled && { borderColor: colors.accent }, disabled && { opacity: 0.35 }]}
    >
      <Icon name={icon} size={18} color={colors.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.white },
  head: { minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  lines: { paddingHorizontal: 20 },
  line: { paddingVertical: 12, gap: 6, borderBottomWidth: 1, borderBottomColor: colors.line },
  lineTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  lineText: { flex: 1, minWidth: 0, gap: 2 },
  num: { fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 68 },
  step: { width: touch, height: touch, borderRadius: touch / 2, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  qty: { minWidth: 32, textAlign: 'center', fontSize: 16 },
  remove: { width: touch, height: touch, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  foot: { padding: 20, gap: 10, borderTopWidth: 1, borderTopColor: colors.line },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
