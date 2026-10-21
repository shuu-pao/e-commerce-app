import { useMemo, useSyncExternalStore } from 'react';

import { stockByVariant } from '@/domain/stock';
import type { CollectionName, Collections, Id } from '@/domain/types';

import type { AppState } from './store';
import { getState, subscribe } from './store';

/** Reads part of the app state; the selector must return stored values, not new objects. */
export function useAppState<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(getState()), () => selector(getState()));
}

/** The records of a collection, without deleted ones. */
export function useLive<K extends CollectionName>(collection: K): Collections[K][] {
  const table = useAppState((s) => s.db[collection]);
  return useMemo(() => Object.values(table).filter((r) => !r.deleted) as Collections[K][], [table]);
}

/**
 * Stock left per variant id. For selling, an order open for editing counts its own pieces
 * as available (pass forSelling). Stock counts on the product screens use the true number.
 */
export function useStockLeft(forSelling = false): Map<Id, number> {
  const stock = useAppState((s) => s.db.stock);
  const orders = useAppState((s) => s.db.orders);
  const editing = useAppState((s) => (forSelling ? s.cart.editingOrderId : null));
  return useMemo(
    () => stockByVariant(Object.values(stock), Object.values(orders), editing ?? undefined),
    [stock, orders, editing],
  );
}

/** Names events by id, including deleted ones (past orders still point at them). */
export function useEventName(): (id: Id | null) => string {
  const events = useAppState((s) => s.db.events);
  return useMemo(() => (id: Id | null) => (id ? (events[id]?.name ?? 'Unknown event') : 'No event'), [events]);
}
