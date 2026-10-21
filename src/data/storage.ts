// Device storage on iOS and Android (development builds and Expo Go): SQLite key-value store.
// The web build uses storage.web.ts (IndexedDB); both export the same functions.
import Storage from 'expo-sqlite/kv-store';

export async function loadAll(): Promise<Map<string, unknown>> {
  const keys = await Storage.getAllKeys();
  const pairs = await Storage.multiGet(keys);
  return new Map(pairs.filter(([, v]) => v !== null).map(([k, v]) => [k, JSON.parse(v as string)]));
}

export function setMany(entries: [string, unknown][]): Promise<void> {
  return Storage.multiSet(entries.map(([k, v]) => [k, JSON.stringify(v)]));
}

export function removeMany(keys: string[]): Promise<void> {
  return Storage.multiRemove(keys);
}

export function clearAll(): Promise<void> {
  return Storage.clear();
}

export async function requestPersistence(): Promise<boolean> {
  return true; // app storage on a phone isn't evicted
}
