import { Icon } from '@/ui/Icon';
import { router } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { formatPeso } from '@/domain/money';
import { useAppState, useLive, useStockLeft } from '@/data/hooks';
import { loadSampleData, sampleDataAllowed } from '@/data/sample';
import { Button } from '@/ui/Button';
import { FilterChips } from '@/ui/FilterChips';
import { Photo } from '@/ui/Photo';
import { Empty } from '@/ui/Screen';
import { RowsSkeleton, useFirstDownload } from '@/ui/Skeleton';
import { colors, fonts, radius, touch } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

/** The category chips: all products, one category, or products in none (client, round 5). */
const ALL = 'all';
const NONE = 'none';

export default function Products() {
  const products = useLive('products');
  const categories = useAppState((s) => s.db.categories);
  const stock = useStockLeft();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(ALL);
  const firstDownload = useFirstDownload();

  const live = useMemo(() => Object.values(categories).filter((c) => !c.deleted).sort((a, b) => a.name.localeCompare(b.name)), [categories]);
  const chips = [{ key: ALL, label: 'All products' }, ...live.map((c) => ({ key: c.id, label: c.name })), { key: NONE, label: 'No category' }];
  // A category deleted while it was picked: back to all products.
  const filter = chips.some((c) => c.key === picked) ? picked : ALL;
  const filterName = chips.find((c) => c.key === filter)!.label;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inFilter = (categoryIds: string[]) => {
      if (filter === ALL) return true;
      if (filter === NONE) return !categoryIds.some((id) => categories[id] && !categories[id].deleted);
      return categoryIds.includes(filter);
    };
    return products
      .filter((p) => inFilter(p.categoryIds) && (!q || p.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, categories, filter, query]);

  const nothingMatches = query.trim()
    ? `No products match "${query.trim()}"${filter === ALL ? '' : ` in ${filterName}`}.`
    : filter === NONE
      ? 'Every product is in a category.'
      : `No products in ${filterName} yet.`;

  return (
    <>
      <Drawer.Screen options={{ title: filter === ALL ? 'Products' : `Products · ${filterName}` }} />
      <FlatList
        data={shown}
        keyExtractor={(p) => p.id}
        style={{ backgroundColor: colors.white }}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.top}>
            {products.length ? <Txt variant="small">{shown.length} {shown.length === 1 ? 'product' : 'products'}</Txt> : null}
            <View style={styles.head}>
              <View style={styles.search}>
                <Icon name="search" size={18} color={colors.muted} />
                <TextInput value={query} onChangeText={setQuery} placeholder="Search products" placeholderTextColor={colors.muted} accessibilityLabel="Search products" style={styles.searchInput} />
              </View>
              <Button label="Add product" icon="add" onPress={() => router.push('/products/new')} />
            </View>
            {products.length ? <FilterChips label="Categories" options={chips} value={filter} onChange={setPicked} /> : null}
          </View>
        }
        ListEmptyComponent={
          firstDownload ? (
            <RowsSkeleton />
          ) : products.length ? (
            <Empty title="Nothing matches" message={nothingMatches} />
          ) : (
            <Empty title="No products yet" message="Add each product with its photo, price, categories and the stock for each colour.">
              {sampleDataAllowed() ? <Button label="Try it with sample products" variant="ghost" onPress={loadSampleData} /> : null}
            </Empty>
          )
        }
        renderItem={({ item: p }) => {
          const counts = p.variants.map((v) => stock.get(v.id) ?? 0);
          const total = counts.reduce((a, b) => a + Math.max(0, b), 0);
          const oversold = counts.some((c) => c < 0);
          const soldOut = p.variants.filter((_, i) => counts[i] <= 0).map((v) => v.name).filter(Boolean);
          const cats = p.categoryIds.map((id) => categories[id]).filter((c) => c && !c.deleted).map((c) => c!.name).join(', ');
          return (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Edit ${p.name}`}
              onPress={() => router.push({ pathname: '/products/[id]', params: { id: p.id } })}
              style={({ hovered }) => [styles.row, hovered && { backgroundColor: colors.surface }]}
            >
              <Photo uri={p.photo ?? p.variants[0]?.photo ?? null} name={p.name} size={56} />
              <View style={styles.text}>
                <Txt weight="semibold" numberOfLines={1}>{p.name}</Txt>
                <Txt variant="small" numberOfLines={1}>{[cats || 'No category', p.variants.length > 1 ? `${p.variants.length} colours` : null].filter(Boolean).join(' · ')}</Txt>
                {oversold ? (
                  <Txt variant="small" weight="bold" color={colors.accent}>Oversold. Check the stock count.</Txt>
                ) : soldOut.length && soldOut.length < p.variants.length ? (
                  <Txt variant="small" color={colors.accent}>Sold out: {soldOut.join(', ')}</Txt>
                ) : null}
              </View>
              <View style={styles.right}>
                <Txt weight="semibold">{formatPeso(p.price)}</Txt>
                <Txt variant="small" weight={total ? undefined : 'bold'} color={total ? colors.muted : colors.accent}>{total ? `${total} in stock` : 'Sold out'}</Txt>
              </View>
            </Pressable>
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 40, maxWidth: 900, width: '100%', alignSelf: 'center' },
  top: { gap: 12, paddingBottom: 12 },
  head: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  search: { flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: touch, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.pill },
  searchInput: { flex: 1, minHeight: touch - 2, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, outlineStyle: 'none' } as never,
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.line, borderRadius: radius.sm },
  text: { flex: 1, minWidth: 0, gap: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
});
