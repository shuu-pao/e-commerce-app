import type { BaseRecord, CollectionName } from './types.ts';
import { COLLECTIONS } from './types.ts';

export type Tables = Record<CollectionName, Record<string, BaseRecord>>;

export interface Incoming {
  collection: CollectionName;
  record: BaseRecord;
}

export const outboxKey = (collection: CollectionName, id: string) => `${collection}/${id}`;

/**
 * Merges records downloaded from the server. Newer wins: a local change newer than the
 * server's copy stays (and uploads next); otherwise the server's copy replaces it and any
 * pending upload of the older version is dropped. Returns only what changed.
 */
export function mergeRemote(tables: Tables, outbox: Record<string, true>, incoming: Incoming[]) {
  const next = { ...tables };
  const nextOutbox = { ...outbox };
  const written: [string, BaseRecord][] = [];
  for (const { collection, record } of incoming) {
    if (!COLLECTIONS.includes(collection)) continue;
    const local = next[collection][record.id];
    const age = local ? Date.parse(local.updatedAt) - Date.parse(record.updatedAt) : -1;
    if (age > 0) continue; // ours is newer
    delete nextOutbox[outboxKey(collection, record.id)];
    if (age === 0) continue; // our own upload coming back
    next[collection] = { ...next[collection], [record.id]: record };
    written.push([outboxKey(collection, record.id), record]);
  }
  const outboxChanged = Object.keys(nextOutbox).length !== Object.keys(outbox).length;
  return { tables: next, outbox: nextOutbox, written, changed: written.length > 0 || outboxChanged };
}

/** A change time never older than the record it replaces, even if this device's clock is behind. */
export function nextStamp(previous: string | undefined, now = Date.now()): string {
  const prev = previous ? Date.parse(previous) : 0;
  return new Date(Math.max(now, prev + 1)).toISOString();
}
