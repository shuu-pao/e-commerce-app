// The public catalog: what visitors see without signing in (docs/BRIEF.md, "Public catalog").
// Visitors read it through public.catalog(); the owner's device uploads the photos it lists.
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

import type { Cents, Id } from '@/domain/types';
import { shrinkPhoto } from '@/lib/photo';

import * as store from './store';
import { supabase } from './supabase';

const BUCKET = 'catalog';
/** The catalog grid loads a 480 px copy of each product's cover: sharp on a 3x phone screen, ~40% fewer bytes. */
const GRID_SIZE = 480;
const gridName = (path: string) => path.replace(/\.jpg$/, `-${GRID_SIZE}.jpg`);

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
  /** The cover's small copy for the grid; the owner's device uploads it on its next sync, so it may be missing. */
  gridPhoto: string | null;
  variants: CatalogVariant[];
  stock: StockStatus;
}

export interface Catalog {
  products: CatalogProduct[];
  categories: { id: Id; name: string }[];
}

const photoUrl = (path: string | null, grid = false) =>
  path && supabase ? supabase.storage.from(BUCKET).getPublicUrl(grid ? gridName(path) : path).data.publicUrl : null;

export async function loadCatalog(): Promise<Catalog> {
  if (!supabase) return { products: [], categories: [] };
  // The published page starts this request before the app's code arrives (scripts/head.mjs).
  const page = globalThis as { __catalog?: Promise<Catalog | null> };
  const early = page.__catalog;
  page.__catalog = undefined; // used once; a later load asks again
  let catalog = early ? await early : null;
  if (!catalog) {
    const { data, error } = await supabase.rpc('catalog');
    if (error) throw error;
    catalog = data as Catalog;
  }
  return {
    categories: catalog.categories,
    products: catalog.products.map((p) => ({
      ...p,
      photo: photoUrl(p.photo),
      gridPhoto: photoUrl(p.photo ?? p.variants[0]?.photo ?? null, true),
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

function bytes(base64: string): Uint8Array {
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Copies the photos of catalog products to the public bucket, once each. Files are named by
 * their content, so a changed photo is a new file and browsers can cache them forever.
 * ponytail: old files are never deleted; 1 GB of free storage holds ~10,000 photos. Add a clean-up if it fills.
 */
export async function publishPhotos(): Promise<void> {
  if (!supabase) return;
  const bucket = supabase.storage.from(BUCKET);
  const done = new Set(store.getState().settings.publishedPhotos ?? []);
  const put = async (path: string, base64: string) => {
    const { error } = await bucket.upload(path, bytes(base64), { contentType: 'image/jpeg', cacheControl: '31536000', upsert: true });
    if (error) throw error;
    done.add(path);
    store.updateSettings({ publishedPhotos: [...done] });
  };
  for (const p of Object.values(store.getState().db.products)) {
    if (p.deleted || !p.showInCatalog) continue;
    for (const photo of [p.photo, ...p.variants.map((v) => v.photo)]) {
      if (!photo) continue;
      const path = await pathFor(photo);
      if (!done.has(path)) await put(path, photo.slice(photo.indexOf(',') + 1));
    }
    const cover = p.photo ?? p.variants[0]?.photo; // the grid's photo, as loadCatalog picks it
    if (!cover) continue;
    const grid = gridName(await pathFor(cover));
    if (done.has(grid)) continue;
    const small = await shrinkPhoto(cover, GRID_SIZE);
    if (small) await put(grid, small);
  }
}
