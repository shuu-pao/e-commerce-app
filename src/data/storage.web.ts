// Device storage on the web: one IndexedDB object store of JSON values.
// IndexedDB (unlike localStorage) holds the tens of MB that product photos need.

const DB_NAME = 'caracebu';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => void): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Everything at once with getAll, not a cursor: WebKit steps a cursor one record at a time
 * (measured 2026-11-06: 9 s for 610 records, against 0.05 s with getAll).
 */
export async function loadAll(): Promise<Map<string, unknown>> {
  const out = new Map<string, unknown>();
  await run('readonly', (store) => {
    const keys = store.getAllKeys();
    const values = store.getAll();
    // Both requests read the same store in one transaction, in key order, so they line up.
    values.onsuccess = () => keys.result.forEach((k, i) => out.set(String(k), values.result[i]));
  });
  return out;
}

export function setMany(entries: [string, unknown][]): Promise<void> {
  return run('readwrite', (store) => {
    for (const [key, value] of entries) store.put(value, key);
  });
}

export function removeMany(keys: string[]): Promise<void> {
  return run('readwrite', (store) => {
    for (const key of keys) store.delete(key);
  });
}

export function clearAll(): Promise<void> {
  return run('readwrite', (store) => store.clear());
}

/** Asks the browser not to evict our data under storage pressure (granted for Home Screen apps). */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
