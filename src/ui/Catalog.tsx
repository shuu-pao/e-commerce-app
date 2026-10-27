import { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadCatalog, type Catalog as CatalogData, type CatalogProduct, type StockStatus } from '@/data/catalog';
import { formatPeso } from '@/domain/money';

import { Button } from './Button';
import { Icon } from './Icon';
import { Photo } from './Photo';
import { Empty } from './Screen';
import { GridSkeleton } from './Skeleton';
import { colors, fonts, radius, touch } from './theme';
import { Txt } from './Txt';

const INSTAGRAM = 'https://instagram.com/caracebu';
const MAX_WIDTH = 1120;
const PAD = 20;
const CARD_MIN = 160;
const onWeb = Platform.OS === 'web' && typeof window !== 'undefined';

const openInstagram = () => void Linking.openURL(INSTAGRAM);

/** What visitors see without signing in: the products the owner switched to "Show in catalog". */
export function Catalog({ onSignIn }: { onSignIn: () => void }) {
  const [data, setData] = useState<CatalogData | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const fetchCatalog = () =>
    loadCatalog().then(setData, (e: unknown) => {
      console.error(e);
      setFailed(true);
    });
  useEffect(() => void fetchCatalog(), []);
  const load = () => {
    setFailed(false);
    void fetchCatalog();
  };

  // On the web, the browser's Back button closes an open product instead of leaving the site.
  useEffect(() => {
    if (!onWeb) return;
    const onPop = () => setOpenId(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openProduct = (id: string) => {
    setOpenId(id);
    if (onWeb) history.pushState({ catalogProduct: id }, '');
  };
  const closeProduct = () => (onWeb ? history.back() : setOpenId(null));

  const products = useMemo(() => data?.products ?? [], [data]);
  // Only categories that hold at least one catalog product.
  const categories = useMemo(
    () => (data?.categories ?? []).filter((c) => products.some((p) => p.categoryIds.includes(c.id))),
    [data, products],
  );
  const heading = categories.find((c) => c.id === category)?.name ?? 'All products';
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return products
      .filter((p) => !category || p.categoryIds.includes(category))
      .filter((p) => words.every((w) => `${p.name} ${p.description} ${p.variants.map((v) => v.name).join(' ')}`.toLowerCase().includes(w)));
  }, [products, category, query]);

  const inner = Math.min(width, MAX_WIDTH) - PAD * 2;
  const columns = Math.max(2, Math.floor((inner + 16) / (CARD_MIN + 16)));
  const open = products.find((p) => p.id === openId) ?? null;

  const header = (
    <View style={styles.listTop}>
      <View>
        <Txt variant="title">{heading}</Txt>
        {data ? <Txt variant="small">{shown.length} {shown.length === 1 ? 'product' : 'products'}</Txt> : null}
      </View>
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search products"
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
      {categories.length ? (
        <View style={styles.chips} accessibilityLabel="Categories">
          {[{ id: null, name: 'All products' }, ...categories].map((c) => {
            const on = c.id === category;
            return (
              <Pressable key={c.id ?? 'all'} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setCategory(c.id)} style={[styles.chip, on && styles.chipOn]}>
                <Txt weight="semibold" color={on ? colors.accent : colors.ink}>{c.name}</Txt>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  const footer = (
    <View style={[styles.footer, { paddingBottom: 12 + insets.bottom }]}>
      <Txt variant="small" style={{ flexShrink: 1 }}>Prices in pesos. To order, message us on Instagram.</Txt>
      <Button label="Shop owner? Sign in" variant="ghost" onPress={onSignIn} />
    </View>
  );

  return (
    <View style={styles.page}>
      <View style={[styles.bar, { paddingTop: insets.top }]}>
        <View style={styles.barInner}>
          <Txt variant="brand" style={styles.brand}>caracebu</Txt>
          <Button label="Instagram @caracebu" variant="outline" onPress={openInstagram} />
        </View>
      </View>

      {failed ? (
        <Empty title="The products couldn’t load" message="Check your internet connection, then try again.">
          <Button label="Try again" onPress={load} />
        </Empty>
      ) : (
        <FlatList
          key={columns}
          data={data ? shown : []}
          numColumns={columns}
          keyExtractor={(p) => p.id}
          style={styles.list}
          aria-hidden={!!open}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListFooterComponentStyle={styles.footerWrap}
          ListEmptyComponent={
            !data ? (
              <GridSkeleton columns={columns} />
            ) : products.length ? (
              <Empty title="Nothing matches" message={query ? `No products match "${query}".` : 'This category has no products yet.'} />
            ) : (
              <Empty title="No products yet" message="Check back soon, or see what’s new on Instagram." />
            )
          }
          renderItem={({ item }) => <Card product={item} columns={columns} onPress={() => openProduct(item.id)} />}
        />
      )}

      {open ? <Detail product={open} backLabel={heading} onBack={closeProduct} /> : null}
    </View>
  );
}

function StockTag({ stock }: { stock: StockStatus }) {
  if (!stock) return null;
  const out = stock === 'out';
  return (
    <View style={[styles.tag, { backgroundColor: out ? colors.accentSoft : colors.warnBg }]}>
      <Txt variant="small" weight="bold" color={out ? colors.accent : colors.warnInk}>{out ? 'Sold out' : 'Low on stock'}</Txt>
    </View>
  );
}

const stockText = (stock: StockStatus) => (stock === 'out' ? ', sold out' : stock === 'low' ? ', low on stock' : '');

function Card({ product, columns, onPress }: { product: CatalogProduct; columns: number; onPress: () => void }) {
  const colours = product.variants.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatPeso(product.price)}${stockText(product.stock)}${colours > 1 ? `, ${colours} colours` : ''}`}
      onPress={onPress}
      style={({ pressed, hovered }) => [styles.card, { flexBasis: `${100 / columns}%`, maxWidth: `${100 / columns}%` }, (pressed || hovered) && styles.cardActive]}
    >
      <View style={product.stock === 'out' && styles.dim}>
        <Photo uri={product.photo ?? product.variants[0]?.photo ?? null} name={product.name} fill badge={colours > 1 ? `${colours} colours` : null} />
      </View>
      <Txt weight="semibold" numberOfLines={2} style={styles.cardName}>{product.name}</Txt>
      <View style={styles.cardMeta}>
        <Txt weight="bold">{formatPeso(product.price)}</Txt>
        <StockTag stock={product.stock} />
      </View>
    </Pressable>
  );
}

function Detail({ product, backLabel, onBack }: { product: CatalogProduct; backLabel: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const colours = product.variants.length > 1 ? product.variants : [];
  // No colour picked on open, so the product's own photo shows first (client, 2026-10-27).
  const [colourId, setColourId] = useState<string | null>(null);
  const colour = colours.find((v) => v.id === colourId) ?? null;
  const photo = colour?.photo ?? product.photo ?? product.variants[0]?.photo ?? null;
  return (
    <ScrollView style={[StyleSheet.absoluteFill, styles.detail]} contentContainerStyle={[styles.detailContent, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}>
      <Button label={`Back to ${backLabel}`} variant="ghost" icon="chevron-back" onPress={onBack} style={styles.back} />
      <View style={styles.detailRow}>
        <View style={[styles.detailPhoto, product.stock === 'out' && styles.dim]}>
          <Photo uri={photo} name={product.name} fill />
        </View>
        <View style={styles.detailInfo}>
          <Txt variant="title">{product.name}</Txt>
          <View style={styles.priceRow}>
            <Txt variant="big">{formatPeso(product.price)}</Txt>
            <StockTag stock={product.stock} />
          </View>
          {product.description ? <Txt color={colors.body} style={styles.description}>{product.description}</Txt> : null}
          {colours.length ? (
            <View style={styles.colours}>
              <Txt weight="semibold">Colours</Txt>
              {colours.map((v) => {
                const on = v.id === colourId;
                return (
                  <Pressable
                    key={v.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${v.name}${stockText(v.stock)}`}
                    accessibilityState={{ selected: on }}
                    onPress={() => setColourId(v.id)}
                    style={({ hovered }) => [styles.colour, (on || hovered) && { borderColor: colors.accent }]}
                  >
                    <Photo uri={v.photo ?? product.photo} name={v.name} size={44} />
                    <Txt weight="semibold" style={{ flex: 1 }}>{v.name}</Txt>
                    <StockTag stock={v.stock} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <Button label="Message us on Instagram" size="lg" onPress={openInstagram} style={styles.order} />
          <Txt variant="small">
            {product.stock === 'out'
              ? 'Sold out for now. Message us to ask when it’s back.'
              : `Tell us the product${colour ? ` and colour: ${product.name}, ${colour.name}.` : `: ${product.name}.`}`}
          </Txt>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.white },
  bar: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  barInner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: PAD, paddingVertical: 10 },
  brand: { flex: 1, fontSize: 24, lineHeight: 32 },
  list: { flex: 1 },
  listContent: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: PAD - 8, flexGrow: 1 },
  listTop: { gap: 14, paddingHorizontal: 8, paddingTop: 20, paddingBottom: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: touch, paddingLeft: 14, paddingRight: 4, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.pill },
  searchInput: { flex: 1, minWidth: 0, minHeight: touch - 2, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, outlineStyle: 'none' } as never,
  clear: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: touch, justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.lineStrong },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  row: { alignItems: 'flex-start' },
  card: { padding: 8, gap: 6, borderRadius: radius.lg },
  cardActive: { backgroundColor: colors.surface },
  cardName: { lineHeight: 20 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  dim: { opacity: 0.55 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  footerWrap: { marginTop: 'auto' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginTop: 24, marginHorizontal: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  detail: { backgroundColor: colors.white },
  detailContent: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: PAD, gap: 12 },
  back: { alignSelf: 'flex-start', marginLeft: -10 },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 28 },
  detailPhoto: { flexGrow: 1, flexBasis: 300, maxWidth: 480 },
  detailInfo: { flexGrow: 1, flexBasis: 300, minWidth: 0, gap: 14 },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  description: { maxWidth: 560 },
  colours: { gap: 8 },
  colour: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderWidth: 1.5, borderColor: colors.lineStrong, borderRadius: radius.lg },
  order: { alignSelf: 'flex-start', marginTop: 4 },
});
