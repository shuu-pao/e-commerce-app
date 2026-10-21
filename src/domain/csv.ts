import { formatOrderNumber, totals } from './checkout.ts';
import { formatTime, isoToDateKey } from './dates.ts';
import type { Id, Order } from './types.ts';
import { paymentLabel } from './types.ts';

function cell(value: string | number): string {
  let text = String(value);
  // A typed name like "=HYPERLINK(...)" must stay text, not become an Excel formula.
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const pesos = (cents: number) => (cents / 100).toFixed(2);

/** Orders as CSV that Excel opens directly (UTF-8 with a byte-order mark). */
export function ordersToCsv(orders: Order[], eventName: (id: Id | null) => string): string {
  const header = ['Order', 'Date', 'Time', 'Event', 'Items', 'Pieces', 'Subtotal', 'Discount', 'Delivery fee', 'Total', 'Payment', 'Buyer', 'Address'];
  const rows = orders.map((o) => {
    const t = totals(o);
    return [
      formatOrderNumber(o.number),
      isoToDateKey(o.createdAt), // YYYY-MM-DD sorts and filters as a date in Excel
      formatTime(o.createdAt),
      eventName(o.eventId),
      o.lines.map((l) => `${l.qty} × ${l.name}${l.variantName ? ` (${l.variantName})` : ''}`).join('; '),
      t.pieces,
      pesos(t.subtotal),
      pesos(t.discount),
      pesos(t.deliveryFee),
      pesos(t.total),
      o.payments.map((p) => `${paymentLabel(p.method)} ${pesos(p.amount)}`).join('; '),
      o.buyer?.name ?? '',
      o.buyer?.address ?? '',
    ];
  });
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
