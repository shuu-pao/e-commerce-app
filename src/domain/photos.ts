// Several photos per product and per colour (client, round 5). The first photo (the cover)
// stays in the product record; every other photo is its own `photos` record, so saving a price
// never uploads photos again and no record nears the server's 4 MB limit.
import type { Id, ProductPhoto } from './types.ts';

export const MAX_PRODUCT_PHOTOS = 6;
export const MAX_COLOUR_PHOTOS = 3;

/** A photo on Edit product: `id` is its photo record, or null if it has none yet (a cover, or a photo just added). */
export interface PhotoItem {
  id: Id | null;
  uri: string;
}

/** The photos of a product (variantId null) or of one colour, cover first. */
export function photoList(cover: string | null, records: ProductPhoto[], productId: Id, variantId: Id | null): PhotoItem[] {
  const extras = records
    .filter((r) => !r.deleted && r.photo && r.productId === productId && r.variantId === variantId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  return [...(cover ? [{ id: null, uri: cover }] : []), ...extras.map((r) => ({ id: r.id, uri: r.photo }))];
}

/**
 * What saving Edit product changes in the photo records: each list's first photo is its cover
 * (the caller puts it in the product record), the rest are saved only if new or moved, and the
 * product's records that are in no list any more are deleted.
 */
export function planPhotos(records: ProductPhoto[], productId: Id, lists: { variantId: Id | null; items: PhotoItem[] }[], newId: () => Id) {
  const mine = new Map(records.filter((r) => !r.deleted && r.productId === productId).map((r) => [r.id, r]));
  const keep = new Set<Id>();
  const save: Omit<ProductPhoto, 'updatedAt'>[] = [];
  for (const { variantId, items } of lists) {
    items.slice(1).forEach((item, i) => {
      const old = item.id ? mine.get(item.id) : undefined;
      const id = old?.id ?? newId();
      keep.add(id);
      if (!old || old.position !== i + 1 || old.variantId !== variantId || old.photo !== item.uri) {
        save.push({ id, productId, variantId, position: i + 1, photo: item.uri });
      }
    });
  }
  const drop = [...mine.values()].filter((r) => !keep.has(r.id));
  return { save, drop };
}
