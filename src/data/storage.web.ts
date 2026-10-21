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

export async function loadAll(): Promise<Map<string, unknown>> {
  const out = new Map<string, unknown>();
  await run('readonly', (store) => {
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      out.set(String(cursor.key), cursor.value);
      cursor.continue();
    };
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
