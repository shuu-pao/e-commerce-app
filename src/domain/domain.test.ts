/// <reference types="node" />
// Run with `npm test` (Node's built-in runner; Node 23.6+ runs TypeScript directly).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { change, checkoutProblems, discountAmount, formatOrderNumber, nextOrderNumber, totals } from './checkout.ts';
import { ordersToCsv } from './csv.ts';
import { addMonths, dateKey, isDateKey, monthEnd, weekStart } from './dates.ts';
import { mergeRemote, nextStamp } from './merge.ts';
import { photoList, planPhotos } from './photos.ts';
import { formatPeso, parsePeso } from './money.ts';
import { bestSellers, byDay, byPayment, filterOrders, periodRange, shiftPeriod, summarize } from './reports.ts';
import { stockByVariant } from './stock.ts';
import type { Order, OrderLine, ProductPhoto, StockAdjustment } from './types.ts';

const line = (over: Partial<OrderLine> = {}): OrderLine => ({
  productId: 'p1', variantId: 'v1', name: 'Daisy claw clip', variantName: 'Yellow', price: 12000, qty: 1, ...over,
});

const order = (over: Partial<Order> = {}): Order => ({
  id: 'o1', updatedAt: '2026-10-18T07:00:00.000Z', number: 1, createdAt: new Date(2026, 9, 18, 15, 42).toISOString(),
  eventId: null, lines: [line({ qty: 2 })], discount: { kind: 'none' }, deliveryFee: 0,
  payments: [{ method: 'cash', amount: 24000 }], cashReceived: null, buyer: null, ...over,
});

test('money: formats and parses pesos as centavos', () => {
  assert.equal(formatPeso(58000), '₱580');
  assert.equal(formatPeso(123450), '₱1,234.50');
  assert.equal(formatPeso(-5800), '−₱58');
  assert.equal(parsePeso('1,250.5'), 125050);
  assert.equal(parsePeso('₱99'), 9900);
  assert.equal(parsePeso(''), null);
  assert.equal(parsePeso('12.345'), null);
  assert.equal(parsePeso('-5'), null);
});

test('checkout: discounts never go below zero or above the subtotal', () => {
  assert.equal(discountAmount({ kind: 'percent', percent: 10 }, 58000), 5800);
  assert.equal(discountAmount({ kind: 'percent', percent: 10 }, 15500), 1550);
  assert.equal(discountAmount({ kind: 'amount', amount: 99999 }, 58000), 58000);
  assert.equal(discountAmount({ kind: 'percent', percent: -5 }, 58000), 0);
  assert.equal(discountAmount({ kind: 'none' }, 58000), 0);
});

test('checkout: totals add the delivery fee after the discount', () => {
  const t = totals({ lines: [line({ qty: 2 }), line({ variantId: 'v2', price: 18000 })], discount: { kind: 'percent', percent: 10 }, deliveryFee: 10000 });
  assert.deepEqual(t, { subtotal: 42000, discount: 4200, deliveryFee: 10000, total: 47800, pieces: 3 });
});

test('checkout: split payments must add up to the total, and change comes from the cash part', () => {
  const base = order({ discount: { kind: 'percent', percent: 10 } }); // total 216.00
  assert.deepEqual(checkoutProblems({ ...base, payments: [{ method: 'cash', amount: 10000 }, { method: 'gcash', amount: 11600 }] }), []);
  assert.match(checkoutProblems({ ...base, payments: [{ method: 'cash', amount: 10000 }] })[0], /₱116 short/);
  assert.match(checkoutProblems({ ...base, payments: [{ method: 'gcash', amount: 30000 }] })[0], /over/);
  assert.equal(change(50000, [{ method: 'cash', amount: 10000 }, { method: 'gcash', amount: 11600 }]), 40000);
  assert.equal(change(5000, [{ method: 'cash', amount: 10000 }]), null);
  assert.equal(change(50000, [{ method: 'gcash', amount: 21600 }]), null);
  assert.deepEqual(checkoutProblems({ ...base, lines: [], payments: [] }), ['The cart is empty.']);
});

test('checkout: order numbers continue from the highest one', () => {
  assert.equal(nextOrderNumber([order({ number: 41 }), order({ number: 7 })]), 42);
  assert.equal(nextOrderNumber([]), 1);
  assert.equal(formatOrderNumber(42), '#0042');
});

test('stock: added minus sold, skipping deleted orders and the order being edited', () => {
  const adj = (variantId: string, delta: number): StockAdjustment =>
    ({ id: variantId + delta, updatedAt: '', productId: 'p1', variantId, delta, createdAt: '' });
  const adjustments = [adj('v1', 6), adj('v1', 4), adj('v2', 3)];
  const orders = [order({ id: 'a' }), order({ id: 'b', lines: [line({ qty: 3 })] }), order({ id: 'c', deleted: true, lines: [line({ qty: 5 })] })];
  const left = stockByVariant(adjustments, orders);
  assert.equal(left.get('v1'), 5);
  assert.equal(left.get('v2'), 3);
  assert.equal(stockByVariant(adjustments, orders, 'b').get('v1'), 8);
});

test('dates: week starts Monday, months roll over', () => {
  assert.equal(weekStart('2026-10-18'), '2026-10-12'); // Sunday → Monday before
  assert.equal(weekStart('2026-10-12'), '2026-10-12');
  assert.equal(monthEnd('2026-02-10'), '2026-02-28');
  assert.equal(addMonths('2026-12-15', 1), '2027-01-01');
  assert.equal(isDateKey('2026-02-30'), false);
  assert.equal(dateKey(new Date(2026, 0, 5)), '2026-01-05');
});

test('reports: periods, filters and summaries', () => {
  assert.deepEqual(periodRange('week', '2026-10-18'), { from: '2026-10-12', to: '2026-10-18' });
  assert.deepEqual(periodRange('month', '2026-10-18'), { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(shiftPeriod('month', '2026-10-18', -1), '2026-09-01');

  const day1 = new Date(2026, 9, 17, 10).toISOString();
  const day2 = new Date(2026, 9, 18, 10).toISOString();
  const orders = [
    order({ id: 'a', createdAt: day1, eventId: 'fair' }),
    order({ id: 'b', createdAt: day2, eventId: 'fair', discount: { kind: 'amount', amount: 2000 }, payments: [{ method: 'cash', amount: 10000 }, { method: 'gcash', amount: 12000 }] }),
    order({ id: 'c', createdAt: day2, eventId: 'online', lines: [line({ productId: 'p2', name: 'Pouch', price: 18000 })], deliveryFee: 5000, payments: [{ method: 'gcash', amount: 23000 }] }),
    order({ id: 'd', createdAt: day2, deleted: true }),
  ];
  assert.deepEqual(filterOrders(orders, { eventId: 'fair' }).map((o) => o.id), ['b', 'a']);
  assert.deepEqual(filterOrders(orders, { range: { from: '2026-10-18', to: '2026-10-18' } }).map((o) => o.id).sort(), ['b', 'c']);

  const live = filterOrders(orders, {});
  assert.deepEqual(summarize(live), { sales: 24000 + 22000 + 23000, orders: 3, pieces: 5, discounts: 2000, deliveryFees: 5000 });
  assert.deepEqual(byDay(live).map((r) => [r.day, r.orders, r.sales]), [['2026-10-17', 1, 24000], ['2026-10-18', 2, 45000]]);
  assert.deepEqual(byPayment(live), [{ method: 'cash', amount: 34000 }, { method: 'gcash', amount: 35000 }]);
  assert.deepEqual(bestSellers(live).map((b) => [b.name, b.pieces]), [['Daisy claw clip', 4], ['Pouch', 1]]);
});

test('csv: Excel-ready with quoting', () => {
  const csv = ordersToCsv([order({ buyer: { name: 'Ana "AJ" Reyes', address: 'Lahug, Cebu' } })], () => 'Online');
  assert.ok(csv.startsWith('﻿Order,Date,'));
  assert.match(csv, /#0001,2026-10-18,/);
  assert.match(csv, /"Ana ""AJ"" Reyes","Lahug, Cebu"\r\n$/);
  assert.match(csv, /2 × Daisy claw clip \(Yellow\)/);
});

test('merge: newer wins, own uploads coming back clear the outbox, newer local edits stay', () => {
  const t = (iso: string, extra = {}) => ({ id: 'x', updatedAt: iso, ...extra });
  const tables = { products: { x: t('2026-10-22T10:00:00.000Z', { name: 'local' }) }, categories: {}, events: {}, orders: {}, stock: {}, photos: {} };
  const outbox = { 'products/x': true as const };

  // Server copy is older: keep ours, keep it queued.
  let m = mergeRemote(tables, outbox, [{ collection: 'products', record: t('2026-10-22T09:00:00.000Z') }]);
  assert.equal(m.changed, false);

  // Our own upload coming back (same time): nothing rewritten, outbox cleared.
  m = mergeRemote(tables, outbox, [{ collection: 'products', record: t('2026-10-22T10:00:00.000Z') }]);
  assert.deepEqual([m.written.length, m.outbox], [0, {}]);

  // The other device changed it later: take theirs, drop our stale upload.
  m = mergeRemote(tables, outbox, [{ collection: 'products', record: t('2026-10-22T11:00:00.000Z', { name: 'theirs' }) }]);
  assert.equal((m.tables.products.x as { name?: string }).name, 'theirs');
  assert.deepEqual(m.outbox, {});

  // New record, unknown collection ignored.
  m = mergeRemote(tables, {}, [{ collection: 'orders', record: { id: 'o', updatedAt: '2026-10-22T11:00:00.000Z' } }, { collection: 'nope' as never, record: t('2026') }]);
  assert.deepEqual(Object.keys(m.tables.orders), ['o']);
  assert.equal(m.written.length, 1);
});

test('merge: change times never go backwards on a device with a slow clock', () => {
  assert.equal(nextStamp('2026-10-22T10:00:00.000Z', Date.parse('2026-10-22T09:00:00.000Z')), '2026-10-22T10:00:00.001Z');
  assert.equal(nextStamp(undefined, Date.parse('2026-10-22T09:00:00.000Z')), '2026-10-22T09:00:00.000Z');
});

test('photos: cover in the product, the rest as records rewritten only when they move', () => {
  const rec = (id: string, position: number, photo: string, variantId: string | null = null): ProductPhoto => ({ id, updatedAt: '2026-11-06T00:00:00.000Z', productId: 'p', variantId, position, photo });
  const records = [rec('b', 2, 'B'), rec('a', 1, 'A'), rec('y', 1, 'Y2', 'v1'), rec('gone', 3, '', null), rec('other', 1, 'Z')].map((r) => (r.id === 'gone' ? { ...r, deleted: true } : r.id === 'other' ? { ...r, productId: 'q' } : r));
  const own = photoList('C', records, 'p', null);
  assert.deepEqual(own, [{ id: null, uri: 'C' }, { id: 'a', uri: 'A' }, { id: 'b', uri: 'B' }]);
  assert.deepEqual(photoList(null, records, 'p', 'v1').map((p) => p.uri), ['Y2']);

  let n = 0;
  const ids = () => `new${++n}`;
  // Nothing changed: nothing written (a price change uploads no photos).
  assert.deepEqual(planPhotos(records, 'p', [{ variantId: null, items: own }, { variantId: 'v1', items: [{ id: null, uri: 'Y1' }, { id: 'y', uri: 'Y2' }] }], ids), { save: [], drop: [] });

  // Make B the cover: the old cover becomes a record, A moves, B's record goes; v1 dropped with its colour.
  const plan = planPhotos(records, 'p', [{ variantId: null, items: [own[2], own[0], own[1]] }], ids);
  assert.deepEqual(plan.save, [
    { id: 'new1', productId: 'p', variantId: null, position: 1, photo: 'C' },
    { id: 'a', productId: 'p', variantId: null, position: 2, photo: 'A' },
  ]);
  assert.deepEqual(plan.drop.map((r) => r.id).sort(), ['b', 'y']);
});
