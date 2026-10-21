import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { centsToInput, parsePeso } from '@/domain/money';
import { deltaToReach } from '@/domain/stock';
import type { Id, Product } from '@/domain/types';
import { useAppState, useLive, useStockLeft } from '@/data/hooks';
import { adjustStock, newId, remove, save } from '@/data/store';
import { pickSquarePhoto } from '@/lib/photo';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Field } from '@/ui/Field';
import { Photo } from '@/ui/Photo';
import { Card, Empty, Screen } from '@/ui/Screen';
import { colors, fonts, radius, touch } from '@/ui/theme';
import { Txt } from '@/ui/Txt';
import { useFocusKey } from '@/ui/useFocusKey';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useAppState((s) => s.db.products[id]);
  const focus = useFocusKey();
  if (id !== 'new' && (!product || product.deleted)) {
    return (
      <Empty title="Product not found" message="It may have been deleted.">
        <Button label="All products" onPress={() => router.replace('/products')} />
      </Empty>
    );
  }
  return <Editor key={`${id}-${focus}`} product={id === 'new' ? undefined : product} />;
}

interface VariantForm {
  id: Id;
  name: string;
  photo: string | null;
  stockText: string;
  isNew: boolean;
}

function Editor({ product }: { product: Product | undefined }) {
  const stock = useStockLeft();
  const categories = useLive('categories');
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [priceText, setPriceText] = useState(product ? centsToInput(product.price) : '');
  const [categoryIds, setCategoryIds] = useState<Id[]>(product?.categoryIds ?? []);
  const [photo, setPhoto] = useState<string | null>(product?.photo ?? null);
  const [variants, setVariants] = useState<VariantForm[]>(
    product?.variants.map((v) => ({ id: v.id, name: v.name, photo: v.photo, stockText: String(stock.get(v.id) ?? 0), isNew: false })) ?? [
      { id: newId(), name: '', photo: null, stockText: '0', isNew: true },
    ],
  );
  const [tried, setTried] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const price = parsePeso(priceText);
  const multi = variants.length > 1;
  const names = variants.map((v) => v.name.trim().toLowerCase());
  const errors = {
    name: !name.trim() ? 'Give the product a name.' : null,
    price: price === null ? 'Type the price, like 120.' : null,
    variant: (i: number) => {
      const n = names[i];
      if (multi && !n) return 'Name this colour.';
      if (n && names.indexOf(n) !== i) return 'Two colours have the same name.';
      return null;
    },
    stock: (i: number) => (/^\d+$/.test(variants[i].stockText.trim()) ? null : 'Type a whole number, like 5.'),
  };
  const valid = !errors.name && !errors.price && variants.every((_, i) => !errors.variant(i) && !errors.stock(i));

  const setVariant = (i: number, patch: Partial<VariantForm>) => setVariants(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  const choosePhoto = async (target: 'product' | number) => {
    setPhotoError(null);
    setBusyPhoto(String(target));
    try {
      const uri = await pickSquarePhoto();
      if (uri) {
        if (target === 'product') setPhoto(uri);
        else setVariant(target, { photo: uri });
      }
    } catch (e) {
      console.error(e);
      setPhotoError("That photo couldn't be used. Try another one.");
    } finally {
      setBusyPhoto(null);
    }
  };

  const submit = () => {
    setTried(true);
    if (!valid || price === null) return;
    const id = product?.id ?? newId();
    save('products', {
      id,
      name: name.trim(),
      description: description.trim(),
      price,
      categoryIds,
      photo,
      variants: variants.map((v) => ({ id: v.id, name: v.name.trim(), photo: v.photo })),
    });
    for (const v of variants) {
      const current = v.isNew ? 0 : (stock.get(v.id) ?? 0);
      adjustStock(id, v.id, deltaToReach(current, Number(v.stockText)));
    }
    router.replace('/products');
  };

  return (
    <Screen maxWidth={880}>
      <Drawer.Screen options={{ title: product ? 'Edit product' : 'Add product' }} />
      <View style={styles.top}>
        <View style={styles.photoCol}>
          <Txt weight="semibold" style={styles.label}>Product photo</Txt>
          <Pressable accessibilityRole="button" accessibilityLabel={photo ? 'Change product photo' : 'Add product photo'} onPress={() => choosePhoto('product')} style={styles.bigPhoto}>
            <Photo uri={photo} name={name || 'New product'} fill />
            <View style={styles.photoHint}>
              <Txt variant="small" weight="semibold" color={colors.ink}>{busyPhoto === 'product' ? 'Preparing…' : photo ? 'Change photo' : 'Add photo'}</Txt>
            </View>
          </Pressable>
          {photo ? <Button label="Remove photo" variant="ghost" onPress={() => setPhoto(null)} /> : null}
        </View>
        <View style={styles.fields}>
          <Field label="Title" value={name} onChangeText={setName} error={tried ? errors.name : null} />
          <Field label="Description" value={description} onChangeText={setDescription} multiline placeholder="Material, size…" />
          <Field label="Price (₱), the same for every colour" numeric value={priceText} onChangeText={setPriceText} error={tried || priceText ? errors.price : null} style={{ maxWidth: 260 }} />
        </View>
      </View>
      {photoError ? <Txt color={colors.accent} weight="semibold">{photoError}</Txt> : null}

      <View style={styles.section}>
        <Txt weight="semibold" style={styles.label}>Categories (pick one or more)</Txt>
        {categories.length ? (
          <View style={styles.chips}>
            {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map((c) => {
              const on = categoryIds.includes(c.id);
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  onPress={() => setCategoryIds(on ? categoryIds.filter((x) => x !== c.id) : [...categoryIds, c.id])}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Ionicons name={on ? 'checkmark' : 'add'} size={16} color={on ? colors.accent : colors.ink} />
                  <Txt style={[styles.chipText, on && { color: colors.accent }]}>{c.name}</Txt>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Txt color={colors.muted}>
            No categories yet. <Link href="/categories"><Txt color={colors.accent} weight="semibold">Add categories</Txt></Link>
          </Txt>
        )}
      </View>

      <Card>
        <Txt variant="heading">{multi ? 'Colours and stock' : 'Stock'}</Txt>
        <Txt variant="small">Type how many you have now. A colour at 0 shows as Sold out.</Txt>
        {variants.map((v, i) => (
          <View key={v.id} style={styles.variant}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Photo for ${v.name || 'this colour'}`} onPress={() => choosePhoto(i)} style={styles.smallPhoto}>
              <Photo uri={v.photo} name={v.name || name || '+'} size={56} />
              {busyPhoto === String(i) ? <View style={styles.busy}><Txt variant="small">…</Txt></View> : null}
            </Pressable>
            <Field
              label={multi ? `Colour ${i + 1}` : 'Colour (optional)'}
              value={v.name}
              onChangeText={(t) => setVariant(i, { name: t })}
              placeholder={multi ? 'e.g. Yellow' : 'Leave empty if there are no colours'}
              error={tried ? errors.variant(i) : null}
              style={styles.variantName}
            />
            <Field
              label="In stock"
              accessibilityLabel={`In stock${v.name ? `, ${v.name}` : ''}`}
              numeric
              value={v.stockText}
              onChangeText={(t) => setVariant(i, { stockText: t })}
              error={errors.stock(i)}
              hint={!v.isNew && (stock.get(v.id) ?? 0) < 0 ? 'Oversold: sold more than counted.' : undefined}
              style={styles.variantStock}
            />
            {multi ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${v.name || 'this colour'}`} onPress={() => setVariants(variants.filter((_, j) => j !== i))} style={styles.removeBtn}>
                <Ionicons name="close" size={20} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        ))}
        <Button label="Add colour" variant="outline" icon="add" onPress={() => setVariants([...variants, { id: newId(), name: '', photo: null, stockText: '0', isNew: true }])} style={styles.addColour} />
      </Card>

      {tried && !valid ? <Txt color={colors.accent} weight="semibold">Fix the highlighted fields to save.</Txt> : null}
      <View style={styles.actions}>
        {product ? <Button label="Delete product" variant="danger" onPress={() => setConfirmDelete(true)} /> : null}
        <View style={{ flex: 1 }} />
        <Button label="Cancel" variant="ghost" onPress={() => router.replace('/products')} />
        <Button label="Save" size="lg" onPress={submit} disabled={!!busyPhoto} />
      </View>

      <ConfirmDialog
        visible={confirmDelete}
        title={`Delete ${product?.name ?? 'this product'}?`}
        message="It disappears from Sell. Past orders keep its name and price."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          if (product) remove('products', product.id);
          router.replace('/products');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  photoCol: { width: 200, gap: 8 },
  label: { fontSize: 14 },
  bigPhoto: { width: 200, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  photoHint: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.white },
  fields: { flex: 1, minWidth: 280, gap: 14 },
  section: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: touch, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.lineStrong },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { fontFamily: fonts.semibold },
  variant: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  smallPhoto: { marginTop: 22, borderRadius: radius.md, overflow: 'hidden' },
  busy: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.7)' },
  variantName: { flex: 1, minWidth: 180 },
  variantStock: { width: 140 },
  removeBtn: { width: touch, height: touch, marginTop: 22, alignItems: 'center', justifyContent: 'center' },
  addColour: { alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
});
