import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { formatPeso } from '@/domain/money';
import { useAppState, useLive, useStockLeft } from '@/data/hooks';
import { loadSampleData, sampleDataAllowed } from '@/data/sample';
import { Button } from '@/ui/Button';
import { Photo } from '@/ui/Photo';
import { Empty } from '@/ui/Screen';
import { colors, fonts, radius, touch } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

export default function Products() {
  const products = useLive('products');
  const categories = useAppState((s) => s.db.categories);
  const stock = useStockLeft();
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => !q || p.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  }, [products, query]);

  return (
    <FlatList
      data={shown}
      keyExtractor={(p) => p.id}
      style={{ backgroundColor: colors.white }}
      contentContainerStyle={styles.page}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.head}>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search products" placeholderTextColor={colors.muted} accessibilityLabel="Search products" style={styles.searchInput} />
          </View>
          <Button label="Add product" icon="add" onPress={() => router.push('/products/new')} />
        </View>
      }
      ListEmptyComponent={
        products.length ? (
          <Empty title="Nothing matches" message={`No products match "${query}".`} />
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
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 40, maxWidth: 900, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center', paddingBottom: 12 },
  search: { flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: touch, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.pill },
  searchInput: { flex: 1, minHeight: touch - 2, fontFamily: fonts.regular, fontSize: 16, color: colors.ink, outlineStyle: 'none' } as never,
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.line, borderRadius: radius.sm },
  text: { flex: 1, minWidth: 0, gap: 2 },
  right: { alignItems: 'flex-end', gap: 2 },
});
