// The public catalog: what visitors see without signing in (docs/BRIEF.md, "Public catalog").
// Visitors read it through public.catalog(); the owner's device uploads the photos it lists.
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

import type { Cents, Id } from '@/domain/types';

import * as store from './store';
import { supabase } from './supabase';

const BUCKET = 'catalog';

/** 'out' = sold out, 'low' = 5 pieces or fewer. The number itself never leaves the database. */
export type StockStatus = 'out' | 'low' | null;

export interface CatalogVariant {
  id: Id;
  name: string;
  photo: string | null;
  stock: StockStatus;
}

export interface CatalogProduct {
  id: Id;
  name: string;
  description: string;
  price: Cents;
  categoryIds: Id[];
  photo: string | null;
  variants: CatalogVariant[];
  stock: StockStatus;
}

export interface Catalog {
  products: CatalogProduct[];
  categories: { id: Id; name: string }[];
}

const photoUrl = (path: string | null) => (path && supabase ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null);

export async function loadCatalog(): Promise<Catalog> {
  if (!supabase) return { products: [], categories: [] };
  const { data, error } = await supabase.rpc('catalog');
  if (error) throw error;
  const catalog = data as Catalog;
  return {
    categories: catalog.categories,
    products: catalog.products.map((p) => ({
      ...p,
      photo: photoUrl(p.photo),
      variants: p.variants.map((v) => ({ ...v, photo: photoUrl(v.photo) })),
    })),
  };
}

// ---- Uploading the photos (owner's device, after each sync) -----------------------------

const paths = new Map<string, string>();

/** The file name public.catalog_photo_path() gives the same photo: SHA-256 of the data URL. */
async function pathFor(photo: string): Promise<string> {
  let path = paths.get(photo);
  if (!path) {
    path = (await digestStringAsync(CryptoDigestAlgorithm.SHA256, photo)) + '.jpg';
    paths.set(photo, path);
  }
  return path;
}

function bytes(dataUrl: string): Uint8Array {
  const raw = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Copies the photos of catalog products to the public bucket, once each. Files are named by
 * their content, so a changed photo is a new file and browsers can cache them forever.
 * ponytail: old files are never deleted; 1 GB of free storage holds ~10,000 photos. Add a clean-up if it fills.
 */
export async function publishPhotos(): Promise<void> {
  if (!supabase) return;
  const done = new Set(store.getState().settings.publishedPhotos ?? []);
  for (const p of Object.values(store.getState().db.products)) {
    if (p.deleted || !p.showInCatalog) continue;
    for (const photo of [p.photo, ...p.variants.map((v) => v.photo)]) {
      if (!photo) continue;
      const path = await pathFor(photo);
      if (done.has(path)) continue;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes(photo), { contentType: 'image/jpeg', cacheControl: '31536000', upsert: true });
      if (error) throw error;
      done.add(path);
      store.updateSettings({ publishedPhotos: [...done] });
    }
  }
}
