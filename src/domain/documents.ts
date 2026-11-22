// What an Invoice and a Payment receipt say (client, rounds 6 and 7). src/lib/documents.web.ts
// draws it; this file decides the words and numbers, so it can be tested without a browser.
import { change, paidAt, payByKey, totals } from './checkout.ts';
import { formatLongDate, isoToDateKey } from './dates.ts';
import type { Cents, Order, PaymentMethod, ShopDetails } from './types.ts';
import { paymentLabel, SHOP_ID } from './types.ts';

export type DocKind = 'invoice' | 'receipt';

export interface DocLine {
  description: string;
  /** The colour, under the name. */
  detail: string;
  unitPrice: string;
  qty: string;
  total: string;
}

export interface DocSum {
  label: string;
  value: string;
  /** total: the big line; paid: a payment; muted: cash received and change. */
  tone?: 'total' | 'paid' | 'muted';
}

export interface DocModel {
  kind: DocKind;
  /** "Invoice" or "Payment receipt". */
  title: string;
  /** Without the extension: caracebu-invoice-0042. */
  fileName: string;
  /** Right-aligned under the title: number and dates. */
  meta: { label: string; value: string }[];
  /** "Billed to" or "Received from". */
  partyLabel: string;
  partyName: string;
  partyLines: string[];
  lines: DocLine[];
  sums: DocSum[];
  /** The receipt's PAID stamp. */
  stamp: string | null;
  /** The invoice's accounts to pay into (empty on a receipt). */
  accounts: { bank: string; lines: string[] }[];
  /** The invoice shows the QR code picture. */
  qr: string | null;
  /** The receipt's signature line: who received the payment. */
  signature: string | null;
  from: { name: string; lines: string[] };
  footer: string;
}

/** ₱ 1,400.00: documents always show centavos. */
export function docPeso(cents: Cents): string {
  const sign = cents < 0 ? '− ' : '';
  const text = (Math.abs(cents) / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}₱ ${text}`;
}

/** 0042: the order number, which is also the invoice and receipt number. */
export function docNumber(n: number): string {
  return String(n).padStart(4, '0');
}

/** Shop details before the owner fills them in. Her own details never live in the code (the repo is public). */
export function emptyShop(): ShopDetails {
  return {
    id: SHOP_ID,
    updatedAt: '2000-01-01T00:00:00.000Z',
    shopName: 'caracebu',
    ownerName: '',
    phone: '',
    address: '',
    accounts: [
      { id: 'gcash', bank: 'GCash', accountName: '', number: '' },
      { id: 'bpi', bank: 'BPI', accountName: '', number: '' },
    ],
    qrPhoto: null,
  };
}

/** What still needs filling in before the documents look finished; empty when nothing does. */
export function shopGaps(shop: ShopDetails): string[] {
  const gaps: string[] = [];
  if (!shop.ownerName.trim() || !shop.phone.trim() || !shop.address.trim()) gaps.push('your name, phone number and address');
  if (!shop.accounts.some((a) => a.number.trim())) gaps.push('your payment accounts');
  return gaps;
}

const nonEmpty = (lines: string[]) => lines.map((l) => l.trim()).filter(Boolean);

export function buildDocument(kind: DocKind, order: Order, shop: ShopDetails): DocModel {
  const t = totals(order);
  const no = docNumber(order.number);
  const shopName = shop.shopName.trim() || 'caracebu';
  const invoice = kind === 'invoice';

  const meta = invoice
    ? [
        { label: 'Invoice no.', value: no },
        { label: 'Date', value: formatLongDate(isoToDateKey(order.createdAt)) },
        // Once paid, the invoice is history: no pay-by date to chase.
        ...(order.notPaid ? [{ label: 'Pay by', value: formatLongDate(payByKey(order)) }] : []),
      ]
    : [
        { label: 'Receipt no.', value: no },
        { label: 'Date paid', value: formatLongDate(isoToDateKey(paidAt(order))) },
        ...(order.invoice ? [{ label: 'For invoice no.', value: no }] : []),
      ];

  const sums: DocSum[] = [];
  if (t.discount || t.deliveryFee) sums.push({ label: 'Subtotal', value: docPeso(t.subtotal) });
  if (t.discount) {
    sums.push({ label: order.discount.kind === 'percent' ? `Discount (${order.discount.percent}%)` : 'Discount', value: docPeso(-t.discount) });
  }
  if (t.deliveryFee) sums.push({ label: 'Delivery fee', value: docPeso(t.deliveryFee) });
  sums.push({ label: 'Total', value: docPeso(t.total), tone: 'total' });
  if (!invoice) {
    const changeDue = change(order.cashReceived, order.payments);
    for (const p of order.payments) {
      sums.push({ label: `Paid by ${methodName(p.method)}`, value: docPeso(p.amount), tone: 'paid' });
      if (p.method === 'cash' && order.cashReceived !== null && order.payments.filter((x) => x.method === 'cash').indexOf(p) === 0) {
        sums.push({ label: 'Cash received', value: docPeso(order.cashReceived), tone: 'muted' });
        if (changeDue !== null) sums.push({ label: 'Change', value: docPeso(changeDue), tone: 'muted' });
      }
    }
  }

  const owner = shop.ownerName.trim();
  return {
    kind,
    title: invoice ? 'Invoice' : 'Payment receipt',
    fileName: `${slug(shopName)}-${invoice ? 'invoice' : 'receipt'}-${no}`,
    meta,
    partyLabel: invoice ? 'Billed to' : 'Received from',
    partyName: order.buyer?.name.trim() || '—',
    partyLines: nonEmpty((order.buyer?.address ?? '').split('\n')),
    lines: order.lines.map((l) => ({
      description: l.name,
      detail: l.variantName,
      unitPrice: docPeso(l.price),
      qty: String(l.qty),
      total: docPeso(l.price * l.qty),
    })),
    sums,
    stamp: invoice ? null : 'PAID',
    accounts: invoice
      ? shop.accounts
          .filter((a) => a.number.trim() || a.accountName.trim())
          .map((a) => ({
            bank: a.bank.trim() || 'Account',
            lines: nonEmpty([a.accountName.trim() && `Account name: ${a.accountName}`, a.number.trim() && `Account no.: ${a.number}`]),
          }))
      : [],
    qr: invoice ? shop.qrPhoto : null,
    signature: invoice ? null : nonEmpty([owner, shopName]).join(', '),
    from: { name: shopName, lines: nonEmpty([owner, shop.phone, ...shop.address.split('\n')]) },
    footer: `Thank you for shopping with ${shopName}!`,
  };
}

function methodName(method: PaymentMethod): string {
  return method === 'cash' ? 'cash' : paymentLabel(method);
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'shop';
}
