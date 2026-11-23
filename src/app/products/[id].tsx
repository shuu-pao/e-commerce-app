import { Icon } from '@/ui/Icon';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { centsToInput, parsePeso } from '@/domain/money';
import { MAX_COLOUR_PHOTOS, MAX_PRODUCT_PHOTOS, photoList, type PhotoItem } from '@/domain/photos';
import { deltaToReach, LOW_STOCK } from '@/domain/stock';
import type { Id, Product } from '@/domain/types';
import { useAppState, useLive, useStockLeft } from '@/data/hooks';
import { adjustStock, newId, remove, save, savePhotos } from '@/data/store';
import { pickSquarePhotos } from '@/lib/photo';
import { Button } from '@/ui/Button';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Field, type FieldInput } from '@/ui/Field';
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

/** Stock that changed while the form was open (a sale on the iPad synced in); saving keeps that change. */
function changedSinceOpened(diff: number): string {
  const n = Math.abs(diff);
  return `${n} ${n === 1 ? 'piece' : 'pieces'} ${diff < 0 ? 'sold' : 'added'} since you opened this. Saving keeps ${diff < 0 ? 'the sale' : 'it'}.`;
}

interface VariantForm {
  id: Id;
  name: string;
  /** Its photos, the first one first (the one Sell, the cart and receipts show). */
  photos: PhotoItem[];
  stockText: string;
  /**
   * The stock this form showed when it opened. Saving applies only the change typed over it, so a sale
   * that syncs in while the form is open still counts (a colour left alone gets no stock change at all).
   */
  shownStock: number;
  isNew: boolean;
}

function Editor({ product }: { product: Product | undefined }) {
  const stock = useStockLeft();
  const categories = useLive('categories');
  const records = useAppState((s) => s.db.photos);
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [priceText, setPriceText] = useState(product ? centsToInput(product.price) : '');
  const [categoryIds, setCategoryIds] = useState<Id[]>(product?.categoryIds ?? []);
  // The first photo is the cover: the product card, and the catalog's first photo (client, round 5).
  const [photos, setPhotos] = useState<PhotoItem[]>(() => (product ? photoList(product.photo, Object.values(records), product.id, null) : []));
  const [showInCatalog, setShowInCatalog] = useState(product?.showInCatalog ?? false);
  const [variants, setVariants] = useState<VariantForm[]>(
    () =>
      product?.variants.map((v) => ({
        id: v.id,
        name: v.name,
        photos: photoList(v.photo, Object.values(records), product.id, v.id),
        stockText: String(stock.get(v.id) ?? 0),
        shownStock: stock.get(v.id) ?? 0,
        isNew: false,
      })) ?? [{ id: newId(), name: '', photos: [], stockText: '0', shownStock: 0, isNew: true }],
  );
  const [tried, setTried] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const insets = useSafeAreaInsets();
  // What the form opened with, to tell when something changed ("Changes not saved" in the Save bar).
  const [opened] = useState(() => ({ name, description, priceText, categoryIds, photos, showInCatalog, variants }));
  const dirty =
    name !== opened.name || description !== opened.description || priceText !== opened.priceText || showInCatalog !== opened.showInCatalog ||
    categoryIds.join() !== opened.categoryIds.join() || photos !== opened.photos ||
    variants.length !== opened.variants.length ||
    variants.some((v, i) => v.name !== opened.variants[i]?.name || v.stockText !== opened.variants[i]?.stockText || v.photos !== opened.variants[i]?.photos);
  // Save jumps to the first field that needs fixing (small fixes: the message alone was at the very bottom).
  const nameRef = useRef<FieldInput>(null);
  const priceRef = useRef<FieldInput>(null);
  const variantRefs = useRef<Record<string, FieldInput | null>>({});
  const stockRefs = useRef<Record<string, FieldInput | null>>({});

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

  const addPhotos = async (target: 'product' | number) => {
    const room = target === 'product' ? MAX_PRODUCT_PHOTOS - photos.length : MAX_COLOUR_PHOTOS - variants[target].photos.length;
    setPhotoError(null);
    setBusyPhoto(String(target));
    try {
      const added = (await pickSquarePhotos(room)).map((uri) => ({ id: null, uri }));
      if (target === 'product') setPhotos((list) => [...list, ...added]);
      else setVariants((list) => list.map((v, j) => (j === target ? { ...v, photos: [...v.photos, ...added] } : v)));
    } catch (e) {
      console.error(e);
      setPhotoError("That photo couldn't be used. Try another one.");
    } finally {
      setBusyPhoto(null);
    }
  };

  const submit = () => {
    setTried(true);
    if (!valid || price === null) {
      const bad = variants.findIndex((_, i) => errors.variant(i) || errors.stock(i));
      const first =
        errors.name ? nameRef.current
        : errors.price ? priceRef.current
        : bad >= 0 ? (errors.variant(bad) ? variantRefs.current[variants[bad].id] : stockRefs.current[variants[bad].id])
        : null;
      first?.focus();
      return;
    }
    const id = product?.id ?? newId();
    save('products', {
      id,
      name: name.trim(),
      description: description.trim(),
      price,
      categoryIds,
      photo: photos[0]?.uri ?? null,
      variants: variants.map((v) => ({ id: v.id, name: v.name.trim(), photo: v.photos[0]?.uri ?? null })),
      showInCatalog,
    });
    savePhotos(id, [{ variantId: null, items: photos }, ...variants.map((v) => ({ variantId: v.id, items: v.photos }))]);
    for (const v of variants) {
      adjustStock(id, v.id, deltaToReach(v.shownStock, Number(v.stockText)));
    }
    router.replace('/products');
  };

  const missing = [errors.name && 'title', errors.price && 'price'].filter(Boolean);
  return (
    <View style={{ flex: 1 }}>
    <Screen maxWidth={880}>
      <Drawer.Screen options={{ title: product ? 'Edit product' : 'Add product' }} />
      {tried && !valid ? (
        <View style={styles.problems} accessibilityLiveRegion="polite">
          <Txt color={colors.accent} weight="semibold">
            {missing.length ? `Add the ${missing.join(' and ')} to save.` : 'Fix the highlighted fields to save.'}
          </Txt>
        </View>
      ) : null}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Txt variant="heading">Product photos</Txt>
          <Txt variant="small" style={styles.sectionNote}>
            {photos.length} of {MAX_PRODUCT_PHOTOS} photos. The first photo is the cover: it shows on the product card and when the product opens.
          </Txt>
        </View>
        <View style={styles.tiles}>
          {photos.map((p, i) => (
            <View key={i} style={styles.tileCol}>
              <View style={[styles.tile, i === 0 && styles.tileCover]}>
                <Photo uri={p.uri} name={name || 'Product'} size={128} framed />
                {i === 0 ? (
                  <View style={styles.coverTag}>
                    <Txt variant="small" weight="bold" color={colors.white}>Cover</Txt>
                  </View>
                ) : null}
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} onPress={() => setPhotos(photos.filter((_, j) => j !== i))} style={styles.tileRemove}>
                  <Icon name="close" size={16} color={colors.ink} />
                </Pressable>
              </View>
              {i > 0 ? (
                <Button label="Make cover" variant="ghost" accessibilityLabel={`Make photo ${i + 1} the cover`} onPress={() => setPhotos([p, ...photos.filter((_, j) => j !== i)])} />
              ) : null}
            </View>
          ))}
          {photos.length < MAX_PRODUCT_PHOTOS ? (
            <Pressable accessibilityRole="button" onPress={() => addPhotos('product')} disabled={!!busyPhoto} style={styles.addTile}>
              <Icon name="add" size={22} color={colors.accent} />
              <Txt weight="semibold" color={colors.accent}>{busyPhoto === 'product' ? 'Preparing…' : 'Add photos'}</Txt>
            </Pressable>
          ) : null}
        </View>
      </View>
      {photoError ? <Txt color={colors.accent} weight="semibold">{photoError}</Txt> : null}
      <View style={styles.top}>
        <View style={styles.fields}>
          <Field label="Title" tag={{ text: 'Needed', tone: 'needed' }} inputRef={nameRef} value={name} onChangeText={setName} error={tried ? errors.name : null} />
          <Field label="Description" value={description} onChangeText={setDescription} multiline placeholder="Material, size…" />
          <Field label="Price (₱), the same for every colour" tag={{ text: 'Needed', tone: 'needed' }} inputRef={priceRef} numeric value={priceText} onChangeText={setPriceText} error={tried || priceText ? errors.price : null} style={{ maxWidth: 260 }} />
          <View style={[styles.catalog, showInCatalog && styles.catalogOn]}>
            <Switch
              value={showInCatalog}
              onValueChange={setShowInCatalog}
              accessibilityLabel="Show in catalog"
              trackColor={{ false: colors.lineStrong, true: colors.accent }}
              thumbColor={colors.white}
              {...{ activeThumbColor: colors.white } /* react-native-web's name for the "on" thumb */}
            />
            <View style={styles.catalogText}>
              <Txt weight="semibold">Show in catalog</Txt>
              <Txt variant="small">
                {showInCatalog ? 'Customers see this product at caracebu.expo.app. They never see the stock numbers.' : 'Hidden from the catalog. New products start hidden.'}
              </Txt>
            </View>
          </View>
        </View>
      </View>

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
                  aria-checked={on}
                  onPress={() => setCategoryIds(on ? categoryIds.filter((x) => x !== c.id) : [...categoryIds, c.id])}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Icon name={on ? 'checkmark' : 'add'} size={16} color={on ? colors.accent : colors.ink} />
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
        <Txt variant="small">Type how many you have now. A colour at 0 shows as Sold out. Up to {MAX_COLOUR_PHOTOS} photos per colour.</Txt>
        {variants.map((v, i) => (
          <View key={v.id} style={styles.variant}>
            <View style={styles.colourPhotos}>
              {v.photos.map((p, k) => (
                <View key={k}>
                  <Photo uri={p.uri} name={v.name || name || '+'} size={COLOUR_PHOTO} framed />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${k + 1} of ${v.name || 'this colour'}`}
                    hitSlop={8}
                    onPress={() => setVariant(i, { photos: v.photos.filter((_, j) => j !== k) })}
                    style={styles.smallRemove}
                  >
                    <Icon name="close" size={15} color={colors.white} />
                  </Pressable>
                </View>
              ))}
              {v.photos.length < MAX_COLOUR_PHOTOS ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Add a photo for ${v.name || 'this colour'}`} onPress={() => addPhotos(i)} disabled={!!busyPhoto} style={styles.smallAdd}>
                  {busyPhoto === String(i) ? <Txt variant="small">…</Txt> : <Icon name="add" size={18} color={colors.accent} />}
                </Pressable>
              ) : null}
            </View>
            <Field
              label={multi ? `Colour ${i + 1}` : 'Colour (optional)'}
              value={v.name}
              onChangeText={(t) => setVariant(i, { name: t })}
              placeholder={multi ? 'e.g. Yellow' : 'Leave empty if there are no colours'}
              error={tried ? errors.variant(i) : null}
              inputRef={(el) => { variantRefs.current[v.id] = el; }}
              style={styles.variantName}
            />
            <Field
              label="In stock"
              accessibilityLabel={`In stock${v.name ? `, ${v.name}` : ''}`}
              numeric
              value={v.stockText}
              onChangeText={(t) => setVariant(i, { stockText: t })}
              error={errors.stock(i)}
              inputRef={(el) => { stockRefs.current[v.id] = el; }}
              // "Low" beside the number instead of a sentence under every colour (design review 12).
              tag={Number(v.stockText) > 0 && Number(v.stockText) <= LOW_STOCK ? { text: 'Low', tone: 'warn' } : null}
              hint={
                !v.isNew && (stock.get(v.id) ?? 0) < 0
                  ? 'Oversold: sold more than counted.'
                  : !v.isNew && (stock.get(v.id) ?? 0) !== v.shownStock
                    ? changedSinceOpened((stock.get(v.id) ?? 0) - v.shownStock)
                    : undefined
              }
              style={styles.variantStock}
            />
            {multi ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${v.name || 'this colour'}`} onPress={() => setVariants(variants.filter((_, j) => j !== i))} style={styles.removeBtn}>
                <Icon name="close" size={20} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        ))}
        <Txt variant="small">The first photo of each colour shows in the cart and on receipts.{showInCatalog ? ` "Low" means the catalog shows Low on stock (${LOW_STOCK} or fewer).` : ''}</Txt>
        <Button label="Add colour" variant="outline" icon="add" onPress={() => setVariants([...variants, { id: newId(), name: '', photos: [], stockText: '0', shownStock: 0, isNew: true }])} style={styles.addColour} />
      </Card>

      {product ? (
        <View style={styles.actions}>
          <Button label="Delete product" variant="danger" onPress={() => setConfirmDelete(true)} />
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmDelete}
        title={`Delete ${product?.name ?? 'this product'}?`}
        message="It disappears from Sell. Past orders keep its name and price."
        confirmLabel="Delete"
        cancelLabel="Keep product"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          if (product) {
            remove('products', product.id);
            savePhotos(product.id, []);
          }
          router.replace('/products');
        }}
      />
    </Screen>
    {/* Save always in view, however long the colour list (design review 12). */}
    <View style={[styles.saveBar, { paddingBottom: 12 + insets.bottom }]}>
      <Txt numberOfLines={1} style={styles.saveNote} color={tried && !valid ? colors.accent : dirty ? colors.warnInk : colors.muted} weight={dirty || (tried && !valid) ? 'semibold' : undefined}>
        {tried && !valid ? (missing.length ? `Add the ${missing.join(' and ')}` : 'Fix the highlighted fields') : dirty ? 'Changes not saved' : product ? `${product.name} · ${variants.length} ${variants.length === 1 ? 'colour' : 'colours'}` : 'New product'}
      </Txt>
      <Button label="Cancel" variant="ghost" onPress={() => router.replace('/products')} />
      <Button label="Save" size="lg" onPress={submit} disabled={!!busyPhoto} />
    </View>
    </View>
  );
}

/** Colour photos in Edit product: twice the old size, so they can be checked at a glance. */
const COLOUR_PHOTO = 80;

const styles = StyleSheet.create({
  top: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  label: { fontSize: 14 },
  sectionHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 12, rowGap: 4 },
  sectionNote: { flexShrink: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tileCol: { width: 132, gap: 2 },
  tile: { borderWidth: 2, borderColor: 'transparent', borderRadius: radius.md + 2 },
  tileCover: { borderColor: colors.accent },
  coverTag: { position: 'absolute', left: 8, top: 8, paddingHorizontal: 8, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: colors.accent },
  tileRemove: { position: 'absolute', right: 6, top: 6, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.92)' },
  addTile: { width: 132, height: 132, gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lineStrong, borderRadius: radius.md + 2 },
  fields: { flex: 1, minWidth: 280, maxWidth: 620, gap: 14 },
  catalog: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.lg },
  catalogOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  catalogText: { flex: 1, gap: 2 },
  section: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: touch, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.lineStrong },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { fontFamily: fonts.semibold },
  variant: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  colourPhotos: { width: 3 * COLOUR_PHOTO + 2 * 10, flexDirection: 'row', gap: 10, marginTop: 22 }, // room for 3, so the colour names line up
  smallRemove: { position: 'absolute', right: -7, top: -7, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.white },
  smallAdd: { width: COLOUR_PHOTO, height: COLOUR_PHOTO, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lineStrong, borderRadius: radius.md },
  variantName: { flex: 1, minWidth: 180 },
  variantStock: { width: 140 },
  removeBtn: { width: touch, height: touch, marginTop: 22, alignItems: 'center', justifyContent: 'center' },
  addColour: { alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  problems: { padding: 12, borderRadius: radius.md, backgroundColor: colors.accentSoft },
  saveBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white, boxShadow: '0 -6px 18px rgba(31, 26, 28, 0.06)' },
  saveNote: { flex: 1, minWidth: 0 },
});
