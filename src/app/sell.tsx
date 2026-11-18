import { Icon } from '@/ui/Icon';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatPeso } from '@/domain/money';
import { matchesSearch, searchWords } from '@/domain/search';
import { totals } from '@/domain/checkout';
import type { Product, Variant } from '@/domain/types';
import { useAppState, useLive, useStockLeft } from '@/data/hooks';
import { cartAdd } from '@/data/store';
import { loadSampleData, sampleDataAllowed } from '@/data/sample';
import { Button } from '@/ui/Button';
import { CartPanel } from '@/ui/CartPanel';
import { Photo } from '@/ui/Photo';
import { Empty } from '@/ui/Screen';
import { GridSkeleton, useFirstDownload } from '@/ui/Skeleton';
import { colors, fonts, radius, touch, WIDE } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

const CART_WIDTH = 360;
const CARD_MIN = 140;

export default function Sell() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const products = useLive('products');
  const categoryName = useAppState((s) => (category ? s.db.categories[category]?.name : undefined));
  const cart = useAppState((s) => s.cart);
  const stock = useStockLeft(true);
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const firstDownload = useFirstDownload();

  const contentWidth = width >= WIDE ? width - 260 : width;
  const cartBeside = contentWidth >= 760;
  const gridWidth = contentWidth - (cartBeside ? CART_WIDTH : 0) - 40;
  const columns = Math.max(2, Math.floor((gridWidth + 16) / (CARD_MIN + 16)));

  /** Pieces of a colour still free to sell: stock left minus what's already in the cart. */
  const free = (variantId: string) =>
    (stock.get(variantId) ?? 0) - cart.lines.filter((l) => l.variantId === variantId).reduce((n, l) => n + l.qty, 0);

  const shown = useMemo(() => {
    const words = searchWords(query);
    return products
      .filter((p) => (!category || p.categoryIds.includes(category)) && matchesSearch(p, words))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, category, query]);

  const add = (p: Product, v: Variant) => {
    if (free(v.id) <= 0) return;
    cartAdd({ productId: p.id, variantId: v.id, name: p.name, variantName: v.name, price: p.price, qty: 1 });
    setPicking(null);
  };
  const tap = (p: Product) => (p.variants.length > 1 ? setPicking(p) : p.variants[0] && add(p, p.variants[0]));

  const t = totals({ lines: cart.lines, discount: { kind: 'none' }, deliveryFee: 0 });

  return (
    <View style={styles.page}>
      <Drawer.Screen options={{ title: categoryName ?? 'All products' }} />
      <View style={styles.main}>
        <View style={styles.top}>
          <EventLine />
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={categoryName ? `Search ${categoryName}` : 'Search products'}
              placeholderTextColor={colors.muted}
              accessibilityLabel="Search products"
              autoCorrect={false}
              style={styles.searchInput}
            />
            {query ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clear}>
                <Icon name="close-circle" size={20} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {products.length === 0 && firstDownload ? (
          <GridSkeleton columns={columns} />
        ) : products.length === 0 ? (
          <Empty title="No products yet" message="Add your products on the computer or here, with a photo, price and the stock for each colour.">
            <Button label="Add a product" onPress={() => router.push('/products/new')} />
            {sampleDataAllowed() ? <Button label="Try it with sample products" variant="ghost" onPress={loadSampleData} /> : null}
          </Empty>
        ) : (
          <FlatList
            key={columns}
            data={shown}
            numColumns={columns}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.gridRow}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Empty title="Nothing matches" message={query ? `No products match "${query}".` : 'This category has no products yet.'} />}
            renderItem={({ item }) => (
              <ProductCard product={item} left={item.variants.reduce((n, v) => n + Math.max(0, free(v.id)), 0)} columns={columns} onPress={() => tap(item)} />
            )}
          />
        )}

        {!cartBeside && (
          <View style={[styles.cartBar, { paddingBottom: 12 + insets.bottom }]}>
            <Button
              size="lg"
              label={t.pieces ? `View order · ${t.pieces} ${t.pieces === 1 ? 'piece' : 'pieces'} · ${formatPeso(t.subtotal)}` : 'View order'}
              onPress={() => setCartOpen(true)}
            />
          </View>
        )}
      </View>

      {cartBeside && (
        <View style={styles.side}>
          <CartPanel />
        </View>
      )}

      <Modal visible={!cartBeside && cartOpen} animationType="slide" onRequestClose={() => setCartOpen(false)}>
        <View style={[styles.sheet, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <Button label="Back to products" variant="ghost" icon="chevron-back" onPress={() => setCartOpen(false)} style={styles.back} />
          <CartPanel onCheckout={() => setCartOpen(false)} />
        </View>
      </Modal>

      <ColourPicker product={picking} free={free} onPick={add} onClose={() => setPicking(null)} />
    </View>
  );
}

function EventLine() {
  const event = useAppState((s) => (s.settings.currentEventId ? s.db.events[s.settings.currentEventId] : undefined));
  const live = event && !event.deleted;
  return (
    <View style={styles.eventLine}>
      <Txt color={colors.body} numberOfLines={1} style={{ flexShrink: 1 }}>
        {live ? 'Selling at ' : 'No event chosen for today'}
        {live ? <Txt weight="bold">{event.name}</Txt> : null}
      </Txt>
      <Link href="/events" style={styles.eventLink} accessibilityLabel={live ? 'Change event' : 'Choose event'}>
        <Txt weight="semibold" color={colors.accent}>{live ? 'Change' : 'Choose'}</Txt>
      </Link>
    </View>
  );
}

function ProductCard({ product, left, columns, onPress }: { product: Product; left: number; columns: number; onPress: () => void }) {
  const soldOut = left <= 0;
  const colours = product.variants.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatPeso(product.price)}, ${soldOut ? 'sold out' : `${left} left`}${colours > 1 ? `, ${colours} colours` : ''}`}
      accessibilityState={{ disabled: soldOut }}
      disabled={soldOut}
      onPress={onPress}
      style={({ pressed, hovered }) => [styles.card, { flexBasis: `${100 / columns}%`, maxWidth: `${100 / columns}%` }, soldOut && styles.soldOut, (pressed || hovered) && !soldOut && styles.cardActive]}
    >
      <Photo uri={product.photo ?? product.variants[0]?.photo ?? null} name={product.name} fill badge={colours > 1 ? `${colours} colours` : null} />
      <Txt weight="semibold" numberOfLines={2} style={styles.cardName}>{product.name}</Txt>
      <View style={styles.cardMeta}>
        <Txt weight="semibold">{formatPeso(product.price)}</Txt>
        <Txt variant="small" weight={soldOut ? 'bold' : undefined} color={soldOut ? colors.accent : colors.muted}>
          {soldOut ? 'Sold out' : `${left} left`}
        </Txt>
      </View>
    </Pressable>
  );
}

/** Colours in two columns from this many, when the screen is wide enough (the client has products with 18). */
const TWO_COLUMNS_FROM = 6;
const PICKER_GAP = 10;

function ColourPicker({ product, free, onPick, onClose }: { product: Product | null; free: (variantId: string) => number; onPick: (p: Product, v: Variant) => void; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = height - insets.top - insets.bottom - 48;
  const twoColumns = !!product && product.variants.length >= TWO_COLUMNS_FROM && width >= 700;
  const boxWidth = Math.min(width - 48, twoColumns ? 720 : 440);
  // Each column is half of the list's own width, which leaves out a scrollbar when one shows (a
  // fixed width wrapped the second column under the first as soon as the list scrolled).
  const cell = (i: number) => (!twoColumns ? styles.oneColumn : i % 2 ? styles.rightColumn : styles.leftColumn);
  return (
    <Modal visible={!!product} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.scrim, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        {product ? (
          // Never taller than the screen: the name and Cancel stay put, and the colours scroll between them.
          <View style={[styles.picker, { maxWidth: boxWidth, maxHeight }]} accessibilityViewIsModal>
            <View style={styles.pickerHead}>
              <Txt variant="heading">{product.name}</Txt>
              <Txt color={colors.muted}>Which colour?</Txt>
            </View>
            <ScrollView style={styles.optionsScroll} contentContainerStyle={styles.options}>
              {product.variants.map((v, i) => {
                const left = free(v.id);
                const soldOut = left <= 0;
                return (
                  <View key={v.id} style={cell(i)}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${v.name || 'Default'}, ${soldOut ? 'sold out' : `${left} left`}`}
                      accessibilityState={{ disabled: soldOut }}
                      disabled={soldOut}
                      onPress={() => onPick(product, v)}
                      style={({ hovered }) => [styles.option, hovered && !soldOut && { borderColor: colors.accent }, soldOut && styles.soldOut]}
                    >
                      <Photo uri={v.photo ?? product.photo} name={v.name || product.name} size={44} />
                      <Txt weight="semibold" numberOfLines={2} style={styles.optionName}>{v.name || 'Default'}</Txt>
                      <Txt variant="small" weight={soldOut ? 'bold' : undefined} color={soldOut ? colors.accent : colors.muted}>
                        {soldOut ? 'Sold out' : `${left} left`}
                      </Txt>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
            <Button label="Cancel" variant="ghost" onPress={onClose} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, flexDirection: 'row', backgroundColor: colors.white },
  main: { flex: 1, minWidth: 0 },
  top: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  eventLine: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  eventLink: { paddingVertical: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: touch, paddingLeft: 14, paddingRight: 4, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.pill },
  searchInput: { flex: 1, minWidth: 0, minHeight: touch - 2, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, outlineStyle: 'none' } as never,
  clear: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  grid: { padding: 12, paddingBottom: 24 },
  gridRow: { alignItems: 'flex-start' },
  card: { padding: 8, gap: 6, borderRadius: radius.lg },
  cardActive: { backgroundColor: colors.surface },
  cardName: { lineHeight: 20 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 },
  soldOut: { opacity: 0.55 },
  side: { width: CART_WIDTH, borderLeftWidth: 1, borderLeftColor: colors.line },
  cartBar: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white },
  sheet: { flex: 1, backgroundColor: colors.white },
  back: { alignSelf: 'flex-start', marginLeft: 8 },
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 24 },
  picker: { width: '100%', gap: 12, padding: 24, borderRadius: radius.lg + 2, backgroundColor: colors.white },
  pickerHead: { gap: 2 },
  optionsScroll: { flexGrow: 0, flexShrink: 1 },
  options: { flexDirection: 'row', flexWrap: 'wrap', rowGap: PICKER_GAP },
  oneColumn: { width: '100%' },
  leftColumn: { width: '50%', paddingRight: PICKER_GAP / 2 },
  rightColumn: { width: '50%', paddingLeft: PICKER_GAP / 2 },
  option: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.lg },
  optionName: { flex: 1, minWidth: 0 },
});
