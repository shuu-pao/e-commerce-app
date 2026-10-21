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

/** What still blocks placing the order, in plain words; empty when it can be placed. */
export function checkoutProblems(order: Pick<Order, 'lines' | 'discount' | 'deliveryFee' | 'payments' | 'cashReceived'>): string[] {
  const problems: string[] = [];
  const { total } = totals(order);
  if (order.lines.length === 0) problems.push('The cart is empty.');
  if (order.discount.kind === 'percent' && (order.discount.percent < 0 || order.discount.percent > 100)) {
    problems.push('A percent discount must be between 0 and 100.');
  }
  const sum = paid(order.payments);
  if (sum < total) problems.push(`Payments are ${formatPeso(total - sum)} short of the total.`);
  if (sum > total) problems.push(`Payments are ${formatPeso(sum - total)} over the total.`);
  const cash = cashPortion(order.payments);
  if (order.cashReceived !== null && order.cashReceived < cash) problems.push('Cash received is less than the cash amount.');
  return problems;
}

export function nextOrderNumber(orders: Iterable<Order>): number {
  let max = 0;
  for (const o of orders) if (o.number > max) max = o.number;
  return max + 1;
}

export function formatOrderNumber(n: number): string {
  return '#' + String(n).padStart(4, '0');
}
