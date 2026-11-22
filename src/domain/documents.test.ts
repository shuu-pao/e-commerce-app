/// <reference types="node" />
// Invoices, receipts and orders not paid yet (client, rounds 6 and 7). Run with `npm test`.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { jpegToPdf } from '../lib/pdf.ts';
import { checkoutProblems, daysOverdue, paidAt, payByKey, unpaidFirst, unpaidNote } from './checkout.ts';
import { ordersToCsv } from './csv.ts';
import { dateKey } from './dates.ts';
import { buildDocument, docPeso, emptyShop, shopGaps } from './documents.ts';
import { byDay, filterOrders, summarize } from './reports.ts';
import { stockByVariant } from './stock.ts';
import type { Order, ShopDetails } from './types.ts';

const at = (d: number, h = 10) => new Date(2026, 10, d, h).toISOString(); // November 2026, local time

const order = (over: Partial<Order> = {}): Order => ({
  id: 'o1', updatedAt: at(22), number: 42, createdAt: at(22), eventId: null,
  lines: [
    { productId: 'p1', variantId: 'v1', name: '250 - hairclip', variantName: 'Pink - candy glitter', price: 25000, qty: 2 },
    { productId: 'p2', variantId: 'v2', name: 'Quilted pouch', variantName: 'Cream', price: 38000, qty: 1 },
  ],
  discount: { kind: 'percent', percent: 10 }, deliveryFee: 12000,
  payments: [], cashReceived: null, buyer: { name: 'Maria Santos', address: 'Banilad\nCebu City' },
  invoice: true, notPaid: true, ...over,
});

const shop = (over: Partial<ShopDetails> = {}): ShopDetails => ({
  ...emptyShop(), ownerName: 'Shop Owner', phone: '0917 000 0000', address: 'Talamban, Cebu City',
  accounts: [
    { id: 'a', bank: 'GCash', accountName: 'Shop Owner', number: '0917 000 0000' },
    { id: 'b', bank: 'BPI', accountName: '', number: '' },
  ],
  ...over,
});

test('not paid: pay by the next day, then days overdue', () => {
  const o = order();
  assert.equal(payByKey(o), '2026-11-23');
  assert.equal(daysOverdue(o, '2026-11-22'), 0);
  assert.equal(unpaidNote(o, '2026-11-22'), 'Pay by Nov 23, 2026');
  assert.equal(unpaidNote(o, '2026-11-23'), 'Due today');
  assert.equal(unpaidNote(o, '2026-11-24'), '1 day overdue');
  assert.equal(unpaidNote(o, '2026-11-26'), '3 days overdue');
});

test('not paid: placed without payments, holds its pieces, not a sale until paid', () => {
  const o = order();
  assert.deepEqual(checkoutProblems(o), []);
  assert.ok(checkoutProblems({ ...o, notPaid: false }).some((p) => p.includes('short')), 'paid orders still need payments');
  assert.equal(stockByVariant([{ id: 's', updatedAt: at(1), productId: 'p1', variantId: 'v1', delta: 5, createdAt: at(1) }], [o]).get('v1'), 3);

  const paidLater = order({ id: 'o2', number: 43, notPaid: false, paidAt: at(25), payments: [{ method: 'gcash', amount: 91200 }] });
  const all = [o, paidLater, order({ id: 'o3', number: 44, deleted: true })];
  assert.deepEqual(filterOrders(all, { sales: true }).map((x) => x.number), [43]);
  assert.deepEqual(filterOrders(all, { sales: true, range: { from: '2026-11-22', to: '2026-11-22' } }), [], 'counted on the day paid');
  assert.equal(summarize(filterOrders(all, { sales: true, range: { from: '2026-11-25', to: '2026-11-25' } })).sales, 91200);
  assert.deepEqual(byDay(filterOrders(all, { sales: true })).map((d) => d.day), ['2026-11-25']);
  assert.equal(filterOrders(all, {}).length, 2, 'All orders still lists it');
  assert.equal(paidAt(order({ notPaid: false })), at(22), 'paid at checkout: paid when placed');
  assert.deepEqual(unpaidFirst([order({ id: 'b', number: 50, createdAt: at(21) }), o, paidLater]).map((x) => x.number), [50, 42]);
});

test('invoice: billed to, pay-by date, discount and delivery lines, accounts and QR', () => {
  const doc = buildDocument('invoice', order(), shop({ qrPhoto: 'data:image/jpeg;base64,AAAA' }));
  assert.equal(doc.title, 'Invoice');
  assert.equal(doc.fileName, 'caracebu-invoice-0042');
  assert.deepEqual(doc.meta, [
    { label: 'Invoice no.', value: '0042' },
    { label: 'Date', value: '22 November 2026' },
    { label: 'Pay by', value: '23 November 2026' },
  ]);
  assert.equal(doc.partyLabel, 'Billed to');
  assert.deepEqual([doc.partyName, ...doc.partyLines], ['Maria Santos', 'Banilad', 'Cebu City']);
  assert.deepEqual(doc.lines[0], { description: '250 - hairclip', detail: 'Pink - candy glitter', unitPrice: '₱ 250.00', qty: '2', total: '₱ 500.00' });
  assert.deepEqual(doc.sums.map((s) => `${s.label} ${s.value}`), [
    'Subtotal ₱ 880.00', 'Discount (10%) − ₱ 88.00', 'Delivery fee ₱ 120.00', 'Total ₱ 912.00',
  ]);
  assert.deepEqual(doc.accounts, [{ bank: 'GCash', lines: ['Account name: Shop Owner', 'Account no.: 0917 000 0000'] }], 'an account left empty stays off');
  assert.ok(doc.qr);
  assert.equal(doc.stamp, null);
  assert.deepEqual(doc.from, { name: 'caracebu', lines: ['Shop Owner', '0917 000 0000', 'Talamban, Cebu City'] });
});

test('receipt: each payment, cash received and change, PAID, signature', () => {
  const o = order({
    number: 57, notPaid: false, invoice: true, discount: { kind: 'none' }, deliveryFee: 0, buyer: { name: 'Ana Reyes', address: '' },
    lines: [{ productId: 'p', variantId: 'v', name: 'Canvas tote bag', variantName: '', price: 140000, qty: 1 }],
    payments: [{ method: 'cash', amount: 90000 }, { method: 'gcash', amount: 50000 }], cashReceived: 100000,
  });
  const doc = buildDocument('receipt', o, shop());
  assert.equal(doc.title, 'Payment receipt');
  assert.deepEqual(doc.meta.map((m) => m.label), ['Receipt no.', 'Date paid', 'For invoice no.']);
  assert.equal(doc.partyLabel, 'Received from');
  assert.deepEqual(doc.partyLines, []);
  assert.deepEqual(doc.sums.map((s) => `${s.label} ${s.value}`), [
    'Total ₱ 1,400.00', 'Paid by cash ₱ 900.00', 'Cash received ₱ 1,000.00', 'Change ₱ 100.00', 'Paid by GCash ₱ 500.00',
  ]);
  assert.equal(doc.stamp, 'PAID');
  assert.equal(doc.signature, 'Shop Owner, caracebu');
  assert.deepEqual(doc.accounts, []);
  // Marked paid later: the receipt's date is the day it was paid; the invoice no longer asks to pay by.
  const later = order({ notPaid: false, paidAt: at(25), payments: [{ method: 'bpi', amount: 91200 }] });
  assert.equal(buildDocument('receipt', later, shop()).meta[1].value, '25 November 2026');
  assert.deepEqual(buildDocument('invoice', later, shop()).meta.map((m) => m.label), ['Invoice no.', 'Date']);
});

test('shop details: what is still missing', () => {
  assert.deepEqual(shopGaps(emptyShop()), ['your name, phone number and address', 'your payment accounts']);
  assert.deepEqual(shopGaps(shop()), []);
  assert.equal(docPeso(-8800), '− ₱ 88.00');
});

test('csv: not-paid orders say so', () => {
  const csv = ordersToCsv([order()], () => 'Online');
  assert.ok(csv.split('\r\n')[0].endsWith(',Status'));
  assert.ok(csv.split('\r\n')[1].endsWith(',Not paid'));
  assert.ok(ordersToCsv([order({ notPaid: false })], () => '').split('\r\n')[1].endsWith(',Paid'));
});

test('pdf: one page, the picture filling it, offsets that readers can follow', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  const pdf = jpegToPdf(jpeg, 1240, 1754, 595.28, 'Invoice 0042 (caracebu)');
  const text = Buffer.from(pdf).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.endsWith('%%EOF\n'));
  assert.match(text, /\/MediaBox \[0 0 595.28 842.03\]/);
  assert.match(text, /\/Title \(Invoice 0042 \\\(caracebu\\\)\)/);
  // Every xref entry points at its "n 0 obj" line, and startxref at the table.
  const start = Number(/startxref\n(\d+)/.exec(text)![1]);
  assert.equal(text.slice(start, start + 4), 'xref');
  const entries = text.slice(start).split('\n').slice(3, 9);
  entries.forEach((e, i) => assert.equal(text.slice(Number(e.slice(0, 10)), Number(e.slice(0, 10)) + 8), `${i + 1} 0 obj\n`));
  assert.ok(text.includes(Buffer.from(jpeg).toString('latin1')), 'the JPEG goes in unchanged');
  assert.equal(dateKey(new Date(at(22))), '2026-11-22');
});
