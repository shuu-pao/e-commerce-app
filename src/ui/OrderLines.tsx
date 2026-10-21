import { StyleSheet, View } from 'react-native';

import { lineTotal } from '@/domain/checkout';
import { formatPeso } from '@/domain/money';
import type { OrderLine } from '@/domain/types';
import { useAppState } from '@/data/hooks';

import { Photo } from './Photo';
import { colors } from './theme';
import { Txt } from './Txt';

/** Lines of an order or cart, each with its square photo first, price on the right. */
export function OrderLines({ lines }: { lines: OrderLine[] }) {
  const products = useAppState((s) => s.db.products);
  return (
    <View style={styles.list}>
      {lines.map((l) => {
        const p = products[l.productId];
        const photo = p?.variants.find((v) => v.id === l.variantId)?.photo ?? p?.photo ?? null;
        return (
          <View key={l.variantId} style={styles.line}>
            <Photo uri={photo} name={l.name} size={56} />
            <View style={styles.text}>
              <Txt weight="semibold">{`${l.qty} × ${l.name}`}</Txt>
              <Txt variant="small">{(l.variantName ? `${l.variantName} · ` : '') + `${formatPeso(l.price)} each`}</Txt>
            </View>
            <Txt weight="semibold" style={styles.num}>{formatPeso(lineTotal(l))}</Txt>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderTopWidth: 1, borderTopColor: colors.line },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  text: { flex: 1, minWidth: 0, gap: 2 },
  num: { fontVariant: ['tabular-nums'] },
});
