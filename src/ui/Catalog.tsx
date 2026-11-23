import { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadCatalog, type Catalog as CatalogData, type CatalogProduct, type StockStatus } from '@/data/catalog';
import { formatPeso } from '@/domain/money';
import { matchesSearch, searchWords } from '@/domain/search';

import { currentState, pressedState } from './a11y';
import { hideBoot, takeEarlyTap } from './boot';
import { Button } from './Button';
import { Icon } from './Icon';
import { Photo } from './Photo';
import { FilterChips } from './FilterChips';
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

  const openProduct = (id: string) => {
    setOpenId(id);
    if (onWeb) history.pushState({ catalogProduct: id }, '');
  };
  const fetchCatalog = () =>
    loadCatalog().then(
      (catalog) => {
        setData(catalog);
        // The page drew these products before the app loaded (public/index.html); open one the
        // visitor already tapped there.
        const tapped = takeEarlyTap();
        if (tapped && catalog.products.some((p) => p.id === tapped)) openProduct(tapped);
      },
      (e: unknown) => {
        console.error(e);
        setFailed(true);
      },
    );
  useEffect(() => void fetchCatalog(), []); // eslint-disable-line react-hooks/exhaustive-deps -- load once on open
  const load = () => {
    setFailed(false);
    void fetchCatalog();
  };
  // Take over from the page's own drawing once these products (or the error) are on screen.
  useEffect(() => {
    if (data || failed) hideBoot();
  }, [data, failed]);

  // On the web, the browser's Back button closes an open product instead of leaving the site.
  useEffect(() => {
    if (!onWeb) return;
    const onPop = () => setOpenId(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const closeProduct = () => (onWeb ? history.back() : setOpenId(null));

  const products = useMemo(() => data?.products ?? [], [data]);
  // Only categories that hold at least one catalog product.
  const categories = useMemo(
    () => (data?.categories ?? []).filter((c) => products.some((p) => p.categoryIds.includes(c.id))),
    [data, products],
  );
  const heading = categories.find((c) => c.id === category)?.name ?? 'All products';
  const shown = useMemo(() => {
    const words = searchWords(query);
    return products.filter((p) => (!category || p.categoryIds.includes(category)) && matchesSearch(p, words));
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
        // One row that swipes sideways, so the products start higher on a phone (design review 15).
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
          <FilterChips
            label="Categories"
            options={[{ key: null, label: 'All products' }, ...categories.map((c) => ({ key: c.id, label: c.name }))]}
            value={category}
            onChange={setCategory}
          />
        </ScrollView>
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
          <Button label="Instagram" icon="logo-instagram" variant="outline" accessibilityLabel="Instagram @caracebu" onPress={openInstagram} style={styles.igButton} />
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
        <Photo uri={product.gridPhoto} fallback={product.photo ?? product.variants[0]?.photo} name={product.name} fill badge={colours > 1 ? `${colours} colours` : null} />
      </View>
      <Txt weight="semibold" numberOfLines={2} style={styles.cardName}>{product.name}</Txt>
      <View style={styles.cardMeta}>
        <Txt weight="bold">{formatPeso(product.price)}</Txt>
        <StockTag stock={product.stock} />
      </View>
    </Pressable>
  );
}

/** On a phone, a description longer than this many characters shows its first lines and "Read more". */
const LONG_DESCRIPTION = 220;
const SHORT_LINES = 4;

function Detail({ product, backLabel, onBack }: { product: CatalogProduct; backLabel: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // One column (a phone): the colours move up under the price and Instagram pins to the bottom (design review 14).
  const narrow = width < 700;
  const [more, setMore] = useState(false);
  const colours = product.variants.length > 1 ? product.variants : [];
  // No colour picked on open, so the product's own photos show first; tapping a colour shows only
  // its photos, and tapping it again goes back (client, 2026-10-27 and round 5 question 3).
  const [colourId, setColourId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const colour = colours.find((v) => v.id === colourId) ?? null;
  const main = product.photos.length ? product.photos : (product.variants[0]?.photos ?? []);
  const shown = colour?.photos.length ? colour.photos : main;
  const at = Math.min(index, Math.max(0, shown.length - 1));
  return (
    <View style={[StyleSheet.absoluteFill, styles.detail]}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.detailContent, { paddingTop: insets.top + 12, paddingBottom: (narrow ? 0 : insets.bottom) + 32 }]}>
      <Button label={`Back to ${backLabel}`} variant="ghost" icon="chevron-back" onPress={onBack} style={styles.back} />
      <View style={styles.detailRow}>
        <View style={[styles.detailPhoto, product.stock === 'out' && styles.dim]}>
          <View>
            <Photo uri={shown[at] ?? null} name={product.name} fill />
            {shown.length > 1 ? (
              <View style={styles.position}>
                <Txt variant="small" weight="semibold" color={colors.ink}>{at + 1} of {shown.length}</Txt>
              </View>
            ) : null}
          </View>
          {shown.length > 1 ? (
            <View style={styles.thumbs} accessibilityLabel={colour ? `Photos of ${colour.name}` : 'Product photos'}>
              {shown.map((uri, i) => (
                <Pressable
                  key={`${i}-${uri}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Photo ${i + 1} of ${shown.length}`}
                  {...currentState(i === at)}
                  onPress={() => setIndex(i)}
                  style={[styles.thumb, i === at && { borderColor: colors.accent }]}
                >
                  <Photo uri={uri} name={product.name} size={68} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        <View style={styles.detailInfo}>
          <Txt variant="title">{product.name}</Txt>
          <View style={styles.priceRow}>
            <Txt variant="big">{formatPeso(product.price)}</Txt>
            <StockTag stock={product.stock} />
          </View>
          {colours.length ? (
            <View style={styles.colours}>
              <Txt weight="semibold">Colours <Txt variant="small">· tap to see photos</Txt></Txt>
              <View style={styles.swatches}>
                {colours.map((v) => {
                  const on = v.id === colourId;
                  return (
                    <Pressable
                      key={v.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${v.name}${stockText(v.stock)}`}
                      {...pressedState(on)}
                      onPress={() => {
                        setColourId(on ? null : v.id);
                        setIndex(0);
                      }}
                      style={[styles.swatch, v.stock === 'out' && styles.dim]}
                    >
                      {({ hovered }) => (
                        <>
                          <View style={[styles.swatchRing, (on || hovered) && { borderColor: colors.accent }]}>
                            <View style={styles.swatchPhoto}>
                              <Photo uri={v.photo ?? product.photo} name={v.name} size={SWATCH} />
                            </View>
                          </View>
                          <Txt variant="small" weight={on ? 'bold' : 'medium'} color={on ? colors.accent : colors.ink} numberOfLines={2} style={styles.swatchName}>{v.name}</Txt>
                          {v.stock ? <MiniTag stock={v.stock} /> : null}
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          {product.description ? (
            <View style={styles.descriptionWrap}>
              <Txt
                color={colors.body}
                style={styles.description}
                numberOfLines={narrow && !more ? SHORT_LINES : undefined}
              >
                {/* **words** show in bold, as in ChatGPT and chat apps; splitting puts them at odd indexes (client, 2026-10-28) */}
                {product.description.split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 ? <Txt key={i} weight="bold" color={colors.ink}>{part}</Txt> : part))}
              </Txt>
              {narrow && product.description.length > LONG_DESCRIPTION ? (
                <Button label={more ? 'Show less' : 'Read more'} variant="ghost" onPress={() => setMore(!more)} style={styles.readMore} />
              ) : null}
            </View>
          ) : null}
          {narrow ? null : <Button label="Message us on Instagram" icon="logo-instagram" size="lg" onPress={openInstagram} style={styles.order} />}
          <Txt variant="small">
            {product.stock === 'out'
              ? 'Sold out for now. Message us to ask when it’s back.'
              : `Tell us the product${colour ? ` and colour: ${product.name}, ${colour.name}.` : `: ${product.name}.`}`}
          </Txt>
        </View>
      </View>
    </ScrollView>
    {narrow ? (
      <View style={[styles.orderBar, { paddingBottom: 10 + insets.bottom }]}>
        <View>
          <Txt variant="heading">{formatPeso(product.price)}</Txt>
          {colours.length ? <Txt variant="small">{colour ? colour.name : `${colours.length} colours`}</Txt> : null}
        </View>
        <Button label="Message us on Instagram" icon="logo-instagram" size="lg" onPress={openInstagram} style={styles.orderBarButton} />
      </View>
    ) : null}
    </View>
  );
}

const SWATCH = 64;

/** "Low" or "Sold out" under a colour, smaller than the card's tag. */
function MiniTag({ stock }: { stock: StockStatus }) {
  const out = stock === 'out';
  return <Txt weight="bold" style={[styles.miniTag, out ? styles.miniOut : styles.miniLow]}>{out ? 'Sold out' : 'Low'}</Txt>;
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
  detailPhoto: { flexGrow: 1, flexBasis: 300, maxWidth: 480, gap: 10 },
  position: { position: 'absolute', right: 12, bottom: 12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(255, 255, 255, 0.9)' },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { borderWidth: 2, borderColor: 'transparent', borderRadius: radius.md + 2 },
  detailInfo: { flexGrow: 1, flexBasis: 300, minWidth: 0, gap: 14 },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  description: { maxWidth: 560 },
  colours: { gap: 10 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: SWATCH + 12, alignItems: 'center', gap: 4 },
  swatchRing: { padding: 3, borderRadius: (SWATCH + 10) / 2, borderWidth: 2, borderColor: 'transparent' },
  swatchPhoto: { width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  swatchName: { textAlign: 'center', lineHeight: 16 },
  miniTag: { paddingHorizontal: 6, borderRadius: radius.pill, fontSize: 11, lineHeight: 16, overflow: 'hidden' },
  miniLow: { backgroundColor: colors.warnBg, color: colors.warnInk },
  miniOut: { backgroundColor: colors.accentSoft, color: colors.accent },
  descriptionWrap: { gap: 2, alignItems: 'flex-start' },
  readMore: { marginLeft: -10 },
  order: { alignSelf: 'flex-start', marginTop: 4 },
  orderBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: PAD, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white, boxShadow: '0 -6px 18px rgba(31, 26, 28, 0.08)' },
  orderBarButton: { flex: 1 },
  chipsScroll: { flexGrow: 0, marginHorizontal: -(PAD - 8) - 8 },
  chips: { paddingHorizontal: PAD },
  igButton: { minHeight: 40, paddingHorizontal: 14 },
});
