// The app's data: records in memory, saved on the device, with an outbox of
// changes not yet uploaded. Screens read it through hooks.ts; sync.ts uploads
// the outbox and merges what the other device changed.
import { randomUUID } from 'expo-crypto';

import { nextOrderNumber } from '@/domain/checkout';
import type { CollectionName, Collections, Id, Order, OrderLine, Product, ShopEvent, StockAdjustment } from '@/domain/types';
import { COLLECTIONS, ONLINE_EVENT_ID } from '@/domain/types';

import * as storage from './storage';

export type Db = { [K in CollectionName]: Record<Id, Collections[K]> };

export interface Cart {
  lines: OrderLine[];
  /** Set while a past order is open for editing. */
  editingOrderId: Id | null;
}

/** Per-device settings; never synced. */
export interface Settings {
  currentEventId: Id | null;
  /** Server time of the newest change already pulled. */
  lastPulledAt: string | null;
  /** Who signed in on this device. Kept while offline, so selling never locks out. */
  signedInEmail: string | null;
}

export interface SyncStatus {
  online: boolean;
  syncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

export interface AppState {
  ready: boolean;
  db: Db;
  /** "collection/id" keys of records changed here and not yet uploaded. */
  outbox: Record<string, true>;
  settings: Settings;
  cart: Cart;
  sync: SyncStatus;
  /** Set when saving to the device failed (for example, storage full). */
  saveError: string | null;
}

const emptyDb = (): Db => ({ products: {}, categories: {}, events: {}, orders: {}, stock: {} });
const emptyCart = (): Cart => ({ lines: [], editingOrderId: null });

let state: AppState = {
  ready: false,
  db: emptyDb(),
  outbox: {},
  settings: { currentEventId: null, lastPulledAt: null, signedInEmail: null },
  cart: emptyCart(),
  sync: { online: true, syncing: false, lastSyncedAt: null, error: null },
  saveError: null,
};

const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

// ---- Saving to the device -------------------------------------------------

const key = (collection: CollectionName, id: Id) => `${collection}/${id}`;
const SETTINGS_KEY = 'local/settings';
const CART_KEY = 'local/cart';
const OUTBOX_KEY = 'local/outbox';

let writes: Promise<void> = Promise.resolve();

/** Writes run one after another, so a later write never lands before an earlier one. */
function persist(entries: [string, unknown][]) {
  writes = writes
    .then(() => storage.setMany(entries))
    .then(() => {
      if (state.saveError) setState({ saveError: null });
    })
    .catch((e: unknown) => {
      console.error('Saving to the device failed', e);
      setState({ saveError: 'Saving on this device failed. Free up storage, then try again.' });
    });
}

export function whenSaved(): Promise<void> {
  return writes;
}

export async function loadFromDevice(): Promise<void> {
  const all = await storage.loadAll();
  const db = emptyDb();
  let settings = state.settings;
  let cart = state.cart;
  let outbox: Record<string, true> = {};
  for (const [k, value] of all) {
    if (k === SETTINGS_KEY) settings = { ...settings, ...(value as Partial<Settings>) };
    else if (k === CART_KEY) cart = value as Cart;
    else if (k === OUTBOX_KEY) outbox = value as Record<string, true>;
    else {
      const [collection, id] = k.split('/') as [CollectionName, Id];
      if (COLLECTIONS.includes(collection)) (db[collection] as Record<Id, unknown>)[id] = value;
    }
  }
  setState({ db, settings, cart, outbox, ready: true });
  if (!db.events[ONLINE_EVENT_ID]) {
    // Fixed id and an old timestamp, so both devices create the same record and any rename wins.
    writeRecords('events', [{ id: ONLINE_EVENT_ID, name: 'Online', startDate: null, endDate: null, updatedAt: '2000-01-01T00:00:00.000Z' }], true);
  }
  void storage.requestPersistence();
}

// ---- Records ---------------------------------------------------------------

export function newId(): Id {
  return randomUUID();
}

/** Never older than the record it replaces, even if this device's clock is behind. */
function nextStamp(previous: string | undefined): string {
  const now = Date.now();
  const prev = previous ? Date.parse(previous) : 0;
  return new Date(Math.max(now, prev + 1)).toISOString();
}

function writeRecords<K extends CollectionName>(collection: K, records: Collections[K][], toOutbox: boolean) {
  const table = { ...state.db[collection] } as Record<Id, Collections[K]>;
  const outbox = { ...state.outbox };
  for (const r of records) {
    table[r.id] = r;
    if (toOutbox) outbox[key(collection, r.id)] = true;
  }
  setState({ db: { ...state.db, [collection]: table }, outbox: toOutbox ? outbox : state.outbox });
  const entries: [string, unknown][] = records.map((r) => [key(collection, r.id), r]);
  if (toOutbox) entries.push([OUTBOX_KEY, outbox]);
  persist(entries);
}

type Draft<K extends CollectionName> = Omit<Collections[K], 'updatedAt'>;

/** Creates or replaces records and queues them for upload. */
export function save<K extends CollectionName>(collection: K, ...drafts: Draft<K>[]): Collections[K][] {
  const records = drafts.map(
    (d) => ({ ...d, updatedAt: nextStamp(state.db[collection][d.id]?.updatedAt) }) as Collections[K],
  );
  writeRecords(collection, records, true);
  return records;
}

/** Soft delete: the record stays (past orders still show its name) and the deletion syncs. */
export function remove(collection: CollectionName, id: Id) {
  const existing = state.db[collection][id];
  if (existing) save(collection, { ...existing, deleted: true });
}

// ---- Merging the other device's changes -------------------------------------

export interface RemoteRecord {
  collection: CollectionName;
  record: Collections[CollectionName];
}

/** Newer wins. A local change that is newer than the server's copy stays and uploads next. */
export function applyRemote(rows: RemoteRecord[]) {
  const db = { ...state.db };
  const outbox = { ...state.outbox };
  const entries: [string, unknown][] = [];
  for (const { collection, record } of rows) {
    if (!COLLECTIONS.includes(collection)) continue;
    const local = db[collection][record.id];
    const age = local ? Date.parse(local.updatedAt) - Date.parse(record.updatedAt) : -1;
    if (age > 0) continue;
    delete outbox[key(collection, record.id)];
    if (age === 0) continue; // our own upload coming back
    db[collection] = { ...db[collection], [record.id]: record } as never;
    entries.push([key(collection, record.id), record]);
  }
  if (!entries.length && Object.keys(outbox).length === Object.keys(state.outbox).length) return;
  setState({ db, outbox });
  entries.push([OUTBOX_KEY, outbox]);
  persist(entries);
}

/** Clears outbox entries whose record hasn't changed again since it was uploaded. */
export function markUploaded(uploaded: { collection: CollectionName; id: Id; updatedAt: string }[]) {
  const outbox = { ...state.outbox };
  for (const u of uploaded) {
    if (state.db[u.collection][u.id]?.updatedAt === u.updatedAt) delete outbox[key(u.collection, u.id)];
  }
  setState({ outbox });
  persist([[OUTBOX_KEY, outbox]]);
}

export function outboxRecords(): RemoteRecord[] {
  return Object.keys(state.outbox).flatMap((k) => {
    const [collection, id] = k.split('/') as [CollectionName, Id];
    const record = state.db[collection]?.[id];
    return record ? [{ collection, record }] : [];
  });
}

export function pendingOrderCount(s: AppState = state): number {
  return Object.keys(s.outbox).filter((k) => k.startsWith('orders/')).length;
}

// ---- Settings, sync status ---------------------------------------------------

export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...state.settings, ...patch };
  setState({ settings });
  persist([[SETTINGS_KEY, settings]]);
}

export function updateSync(patch: Partial<SyncStatus>) {
  setState({ sync: { ...state.sync, ...patch } });
}

/** Signs this device out: forgets every record. Callers check the outbox first. */
export async function clearDevice() {
  await whenSaved();
  await storage.clearAll();
  setState({
    db: emptyDb(),
    outbox: {},
    cart: emptyCart(),
    settings: { currentEventId: null, lastPulledAt: null, signedInEmail: null },
  });
}

// ---- Cart ------------------------------------------------------------------

function setCart(cart: Cart) {
  setState({ cart });
  persist([[CART_KEY, cart]]);
}

const sameItem = (a: OrderLine, b: OrderLine) => a.productId === b.productId && a.variantId === b.variantId;

export function cartAdd(line: OrderLine) {
  const lines = state.cart.lines;
  const found = lines.find((l) => sameItem(l, line));
  setCart({
    ...state.cart,
    lines: found ? lines.map((l) => (l === found ? { ...l, qty: l.qty + line.qty } : l)) : [...lines, line],
  });
}

export function cartSetQty(line: OrderLine, qty: number) {
  setCart({
    ...state.cart,
    lines: qty <= 0 ? state.cart.lines.filter((l) => !sameItem(l, line)) : state.cart.lines.map((l) => (sameItem(l, line) ? { ...l, qty } : l)),
  });
}

export function cartClear() {
  setCart(emptyCart());
}

/** Opens a past order in the cart, so its items can be swapped. */
export function cartEditOrder(order: Order) {
  setCart({ lines: order.lines.map((l) => ({ ...l })), editingOrderId: order.id });
}

// ---- Orders, stock, products --------------------------------------------------

export type OrderDraft = Omit<Order, 'id' | 'updatedAt' | 'number' | 'createdAt'>;

/** Saves the checkout as a new order, or updates the order being edited, then empties the cart. */
export function placeOrder(draft: OrderDraft): Order {
  const editing = state.cart.editingOrderId ? state.db.orders[state.cart.editingOrderId] : undefined;
  const [order] = save('orders', {
    ...draft,
    id: editing?.id ?? newId(),
    number: editing?.number ?? nextOrderNumber(Object.values(state.db.orders)),
    createdAt: editing?.createdAt ?? new Date().toISOString(),
  });
  cartClear();
  return order;
}

export function adjustStock(productId: Id, variantId: Id, delta: number) {
  if (delta === 0) return;
  const adjustment: Omit<StockAdjustment, 'updatedAt'> = {
    id: newId(), productId, variantId, delta, createdAt: new Date().toISOString(),
  };
  save('stock', adjustment);
}

export function setCurrentEvent(id: Id | null) {
  updateSettings({ currentEventId: id });
}

export type { Product, ShopEvent };
