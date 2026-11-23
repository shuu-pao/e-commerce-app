import { addDays, daysBetween, formatDate, isoToDateKey } from './dates.ts';
import { formatPeso } from './money.ts';
import type { Cents, Discount, Order, OrderLine, Payment } from './types.ts';

export function lineTotal(line: OrderLine): Cents {
  return line.price * line.qty;
}

export function subtotal(lines: OrderLine[]): Cents {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

export function pieces(lines: OrderLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}

/** The peso amount a discount takes off, never more than the subtotal. */
export function discountAmount(discount: Discount, sub: Cents): Cents {
  const raw =
    discount.kind === 'percent' ? Math.round((sub * discount.percent) / 100)
    : discount.kind === 'amount' ? discount.amount
    : 0;
  return Math.min(Math.max(raw, 0), sub);
}

export interface Totals {
  subtotal: Cents;
  discount: Cents;
  deliveryFee: Cents;
  total: Cents;
  pieces: number;
}

export function totals(order: Pick<Order, 'lines' | 'discount' | 'deliveryFee'>): Totals {
  const sub = subtotal(order.lines);
  const disc = discountAmount(order.discount, sub);
  return {
    subtotal: sub,
    discount: disc,
    deliveryFee: order.deliveryFee,
    total: sub - disc + order.deliveryFee,
    pieces: pieces(order.lines),
  };
}

export function paid(payments: Payment[]): Cents {
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

export function cashPortion(payments: Payment[]): Cents {
  return payments.filter((p) => p.method === 'cash').reduce((sum, p) => sum + p.amount, 0);
}

/** Change to hand back, or null when no cash amount was given or it's too little. */
export function change(cashReceived: Cents | null, payments: Payment[]): Cents | null {
  const due = cashPortion(payments);
  if (cashReceived === null || due === 0 || cashReceived < due) return null;
  return cashReceived - due;
}

/**
 * One-tap cash amounts after "Exact": what a buyer would hand over in Philippine bills (client, design
 * review 2). The amount due rounded up to ₱100, ₱500, ₱1,000 and ₱5,000, the first three that differ and
 * are above it, topped up with ₱1,000 steps when fewer are left. ₱399 → 400, 500, 1,000; ₱2,548 → 2,600,
 * 3,000, 5,000; ₱1,000 → 2,000, 3,000, 5,000.
 */
export function quickCash(due: Cents, count = 3): Cents[] {
  if (due <= 0) return [];
  const up = (step: Cents) => Math.ceil(due / step) * step;
  const out = new Set<Cents>();
  for (const step of [10000, 50000, 100000, 500000]) {
    const amount = up(step);
    if (amount > due && out.size < count) out.add(amount);
  }
  for (let next = Math.floor(due / 100000) * 100000 + 100000; out.size < count; next += 100000) out.add(next);
  return [...out].sort((a, b) => a - b);
}

/** What still blocks placing the order, in plain words; empty when it can be placed. */
export function checkoutProblems(order: Pick<Order, 'lines' | 'discount' | 'deliveryFee' | 'payments' | 'cashReceived' | 'notPaid'>): string[] {
  const problems: string[] = [];
  const { total } = totals(order);
  if (order.lines.length === 0) problems.push('The cart is empty.');
  if (order.discount.kind === 'percent' && (order.discount.percent < 0 || order.discount.percent > 100)) {
    problems.push('A percent discount must be between 0 and 100.');
  }
  if (order.notPaid) return problems; // paid later, with Mark as paid
  const sum = paid(order.payments);
  if (sum < total) problems.push(`Payments are ${formatPeso(total - sum)} short of the total.`);
  if (sum > total) problems.push(`Payments are ${formatPeso(sum - total)} over the total.`);
  const cash = cashPortion(order.payments);
  if (order.cashReceived !== null && order.cashReceived < cash) problems.push('Cash received is less than the cash amount.');
  return problems;
}

/**
 * The order a cart in edit mode still edits. None when it was deleted meanwhile (on its receipt or on
 * the other device): checkout then places the cart as a new order instead of bringing the deleted one back.
 */
export function stillEditable(order: Order | undefined): Order | undefined {
  return order && !order.deleted ? order : undefined;
}

export function nextOrderNumber(orders: Iterable<Order>): number {
  let max = 0;
  for (const o of orders) if (o.number > max) max = o.number;
  return max + 1;
}

export function formatOrderNumber(n: number): string {
  return '#' + String(n).padStart(4, '0');
}

// ---- Not paid yet (invoices) ------------------------------------------------

/** Pay by the day after the invoice (client, round 6). */
export const PAY_BY_DAYS = 1;

/** When the money came in: when it was marked paid, or when it was placed. */
export function paidAt(order: Pick<Order, 'paidAt' | 'createdAt'>): string {
  return order.paidAt ?? order.createdAt;
}

/** The invoice's pay-by day (YYYY-MM-DD). */
export function payByKey(order: Pick<Order, 'createdAt'>): string {
  return addDays(isoToDateKey(order.createdAt), PAY_BY_DAYS);
}

/** Days past the pay-by day; 0 up to and on it. */
export function daysOverdue(order: Pick<Order, 'createdAt'>, today: string): number {
  return Math.max(0, daysBetween(payByKey(order), today));
}

/** "2 days overdue", "Due today" or "Pay by 23 Nov 2026", for a not-paid order. */
export function unpaidNote(order: Pick<Order, 'createdAt'>, today: string): string {
  const late = daysOverdue(order, today);
  if (late > 0) return `${late} ${late === 1 ? 'day' : 'days'} overdue`;
  const due = payByKey(order);
  return due === today ? 'Due today' : `Pay by ${formatDate(due)}`;
}

/** Not-paid orders, the longest overdue first (then by order number). */
export function unpaidFirst(orders: Iterable<Order>): Order[] {
  const out: Order[] = [];
  for (const o of orders) if (!o.deleted && o.notPaid) out.push(o);
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.number - b.number);
}
