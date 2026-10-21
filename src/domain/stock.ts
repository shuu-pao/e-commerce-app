import type { Id, Order, StockAdjustment } from './types.ts';

/**
 * Stock left per variant: everything added minus everything sold.
 * Both sides are append-only or per-order records, so an offline iPad and the
 * desktop can change stock at the same time and still agree after syncing.
 * Pass excludeOrderId while editing an order, so its own pieces count as available.
 */
export function stockByVariant(
  adjustments: Iterable<StockAdjustment>,
  orders: Iterable<Order>,
  excludeOrderId?: Id,
): Map<Id, number> {
  const left = new Map<Id, number>();
  const add = (id: Id, n: number) => left.set(id, (left.get(id) ?? 0) + n);
  for (const a of adjustments) if (!a.deleted) add(a.variantId, a.delta);
  for (const o of orders) {
    if (o.deleted || o.id === excludeOrderId) continue;
    for (const l of o.lines) add(l.variantId, -l.qty);
  }
  return left;
}

/** The adjustment that takes a variant from what the app counts to what the seller counted. */
export function deltaToReach(current: number, target: number): number {
  return target - current;
}
