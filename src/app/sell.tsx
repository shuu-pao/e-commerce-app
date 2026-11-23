import { Icon } from '@/ui/Icon';
import { router, useLocalSearchParams } from 'expo-router';
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
import { EventLine } from '@/ui/EventPicker';
import { FilterChips } from '@/ui/FilterChips';
import { Empty } from '@/ui/Screen';
import { SLIM_MENU_WIDTH } from '@/ui/Sidebar';
import { GridSkeleton, useFirstDownload } from '@/ui/Skeleton';
import { LOW_STOCK } from '@/domain/stock';
import { colors, fonts, radius, touch, WIDE } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

const CART_WIDTH = 360;
const CARD_MIN = 140;

export default function Sell() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const products = useLive('products');
  const categoryName = useAppState((s) => (category ? s.db.categories[category]?.name : undefined));
  const categories = useLive('categories');
  const cart = useAppState((s) => s.cart);
  const stock = useStockLeft(true);
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const firstDownload = useFirstDownload();

  const contentWidth = width >= WIDE ? width - SLIM_MENU_WIDTH : width;
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
  /** Pieces of each product already in the order, for the badge on its card (design review 4). */
  const inOrder = useMemo(() => {
    const n = new Map<string, number>();
    for (const l of cart.lines) n.set(l.productId, (n.get(l.productId) ?? 0) + l.qty);
    return n;
  }, [cart.lines]);
  // Categories as chips above the grid, like the catalog's: the slim menu no longer lists them (design review 8).
  const chips = useMemo(
    () => [
      { key: null, label: 'All products' },
      ...categories.filter((c) => products.some((p) => p.categoryIds.includes(c.id))).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ key: c.id, label: c.name })),
    ],
    [categories, products],
  );
  const pickCategory = (key: string | null) => router.navigate(key ? { pathname: '/sell', params: { category: key } } : '/sell');

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
          {chips.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
              <FilterChips label="Categories" options={chips} value={category ?? null} onChange={pickCategory} />
            </ScrollView>
          ) : null}
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
              <ProductCard product={item} left={item.variants.reduce((n, v) => n + Math.max(0, free(v.id)), 0)} inOrder={inOrder.get(item.id) ?? 0} columns={columns} onPress={() => tap(item)} />
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

function ProductCard({ product, left, inOrder, columns, onPress }: { product: Product; left: number; inOrder: number; columns: number; onPress: () => void }) {
  const soldOut = left <= 0;
  const colours = product.variants.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatPeso(product.price)}, ${soldOut ? 'sold out' : `${left} left`}${colours > 1 ? `, ${colours} colours` : ''}${inOrder ? `, ${inOrder} in the order` : ''}`}
      disabled={soldOut}
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.card,
        { flexBasis: `${100 / columns}%`, maxWidth: `${100 / columns}%` },
        soldOut && !inOrder && styles.soldOut,
        inOrder ? styles.cardIn : (pressed || hovered) && !soldOut && styles.cardActive,
      ]}
    >
      <View>
        <Photo uri={product.photo ?? product.variants[0]?.photo ?? null} name={product.name} fill badge={colours > 1 ? `${colours} colours` : null} />
        {inOrder ? (
          <View style={styles.inOrder}>
            <Txt weight="bold" color={colors.white} style={styles.inOrderText}>{inOrder} in order</Txt>
          </View>
        ) : null}
      </View>
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

/** A wide picker from this many colours, when the screen allows (the client has products with 18). */
const WIDE_FROM = 6;
const PICKER_GAP = 10;
/** The smallest colour tile: six across in the wide picker, three on a phone. */
const TILE_MIN = 88;

/** "Pink - candy glitter" shows "Pink" large and "candy glitter" under it (client, design review 7). */
function splitColourName(name: string): [string, string] {
  const at = name.indexOf(' - ');
  return at > 0 ? [name.slice(0, at).trim(), name.slice(at + 3).trim()] : [name, ''];
}

function ColourPicker({ product, free, onPick, onClose }: { product: Product | null; free: (variantId: string) => number; onPick: (p: Product, v: Variant) => void; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = height - insets.top - insets.bottom - 48;
  const wide = !!product && product.variants.length >= WIDE_FROM && width >= 700;
  const boxWidth = Math.min(width - 48, wide ? 720 : 440);
  // Tiles share the list's own width (a percentage, so a scrollbar never pushes the last one onto a new row).
  const columns = Math.max(2, Math.floor((boxWidth - 48 + PICKER_GAP) / (TILE_MIN + PICKER_GAP)));
  const tile = { width: `${100 / columns}%` as const };
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
              {product.variants.map((v) => {
                const left = free(v.id);
                const soldOut = left <= 0;
                const [colour, style] = splitColourName(v.name || 'Default');
                return (
                  <View key={v.id} style={[styles.tileCell, tile]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${v.name || 'Default'}, ${soldOut ? 'sold out' : `${left} left`}`}
                      disabled={soldOut}
                      onPress={() => onPick(product, v)}
                      style={({ hovered }) => [styles.tile, hovered && !soldOut && { borderColor: colors.accent }, soldOut && styles.soldOut]}
                    >
                      <Photo uri={v.photo ?? product.photo} name={v.name || product.name} fill />
                      <View style={styles.tileText}>
                        <Txt weight="bold" numberOfLines={2} style={styles.tileName}>{colour}</Txt>
                        {style ? <Txt variant="small" numberOfLines={1} style={styles.tileStyle}>{style}</Txt> : null}
                        <Txt variant="small" weight={soldOut || left <= LOW_STOCK ? 'bold' : undefined} color={soldOut || left <= LOW_STOCK ? colors.accent : colors.muted} style={styles.tileStyle}>
                          {soldOut ? 'Sold out' : `${left} left`}
                        </Txt>
                      </View>
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
  chipsScroll: { marginHorizontal: -20, flexGrow: 0 },
  chips: { paddingHorizontal: 20 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: touch, paddingLeft: 14, paddingRight: 4, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.pill },
  searchInput: { flex: 1, minWidth: 0, minHeight: touch - 2, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, outlineStyle: 'none' } as never,
  clear: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  grid: { padding: 12, paddingBottom: 24 },
  gridRow: { alignItems: 'flex-start' },
  card: { padding: 8, gap: 6, borderRadius: radius.lg },
  cardActive: { backgroundColor: colors.surface },
  cardIn: { backgroundColor: colors.accentSoft, boxShadow: `inset 0 0 0 2px ${colors.accent}` },
  inOrder: { position: 'absolute', top: 6, right: 6, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.accent, boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)' },
  inOrderText: { fontSize: 12, lineHeight: 16 },
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
  options: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -PICKER_GAP / 2, rowGap: PICKER_GAP },
  tileCell: { paddingHorizontal: PICKER_GAP / 2 },
  tile: { flex: 1, padding: 5, gap: 6, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.lg, backgroundColor: colors.white },
  tileText: { paddingHorizontal: 3, paddingBottom: 3, gap: 1 },
  tileName: { fontSize: 15, lineHeight: 19 },
  tileStyle: { fontSize: 12, lineHeight: 16 },
});
