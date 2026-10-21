import { totals } from './checkout.ts';
import { addDays, addMonths, isoToDateKey, monthEnd, monthStart, weekStart } from './dates.ts';
import type { Cents, Id, Order, PaymentMethod } from './types.ts';
import { PAYMENT_METHODS } from './types.ts';

/** Inclusive range of date keys. */
export interface Range {
  from: string;
  to: string;
}

export type Period = 'day' | 'week' | 'month';

export function periodRange(period: Period, anchor: string): Range {
  if (period === 'day') return { from: anchor, to: anchor };
  if (period === 'week') {
    const from = weekStart(anchor);
    return { from, to: addDays(from, 6) };
  }
  return { from: monthStart(anchor), to: monthEnd(anchor) };
}

/** The anchor day of the previous (-1) or next (+1) period. */
export function shiftPeriod(period: Period, anchor: string, dir: 1 | -1): string {
  if (period === 'day') return addDays(anchor, dir);
  if (period === 'week') return addDays(anchor, 7 * dir);
  return addMonths(anchor, dir);
}

export interface OrderFilter {
  range?: Range;
  eventId?: Id | null;
}

export function filterOrders(orders: Iterable<Order>, filter: OrderFilter): Order[] {
  const out: Order[] = [];
  for (const o of orders) {
    if (o.deleted) continue;
    if (filter.eventId !== undefined && o.eventId !== filter.eventId) continue;
    if (filter.range) {
      const day = isoToDateKey(o.createdAt);
      if (day < filter.range.from || day > filter.range.to) continue;
    }
    out.push(o);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface Summary {
  sales: Cents;
  orders: number;
  pieces: number;
  discounts: Cents;
  deliveryFees: Cents;
}

export function summarize(orders: Order[]): Summary {
  const s: Summary = { sales: 0, orders: orders.length, pieces: 0, discounts: 0, deliveryFees: 0 };
  for (const o of orders) {
    const t = totals(o);
    s.sales += t.total;
    s.pieces += t.pieces;
    s.discounts += t.discount;
    s.deliveryFees += t.deliveryFee;
  }
  return s;
}

export interface DayRow {
  day: string;
  orders: number;
  pieces: number;
  sales: Cents;
}

export function byDay(orders: Order[]): DayRow[] {
  const rows = new Map<string, DayRow>();
  for (const o of orders) {
    const day = isoToDateKey(o.createdAt);
    const row = rows.get(day) ?? { day, orders: 0, pieces: 0, sales: 0 };
    const t = totals(o);
    row.orders += 1;
    row.pieces += t.pieces;
    row.sales += t.total;
    rows.set(day, row);
  }
  return [...rows.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function byPayment(orders: Order[]): { method: PaymentMethod; amount: Cents }[] {
  const sums = new Map<PaymentMethod, Cents>();
  for (const o of orders) for (const p of o.payments) sums.set(p.method, (sums.get(p.method) ?? 0) + p.amount);
  return PAYMENT_METHODS.map((m) => ({ method: m.id, amount: sums.get(m.id) ?? 0 })).filter((r) => r.amount > 0);
}

export interface BestSeller {
  productId: Id;
  name: string;
  pieces: number;
  sales: Cents;
}

/** Products by pieces sold (ties broken by sales), using the names they sold under. */
export function bestSellers(orders: Order[], limit = 5): BestSeller[] {
  const rows = new Map<Id, BestSeller>();
  for (const o of orders) {
    for (const l of o.lines) {
      const row = rows.get(l.productId) ?? { productId: l.productId, name: l.name, pieces: 0, sales: 0 };
      row.pieces += l.qty;
      row.sales += l.price * l.qty;
      rows.set(l.productId, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.pieces - a.pieces || b.sales - a.sales).slice(0, limit);
}
