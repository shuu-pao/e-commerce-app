// npm run test:db — no Supabase account needed.
// Runs the real migration in Postgres (PGlite) with a stub of Supabase's auth schema, then checks
// row-level security, newest-wins uploads, order renumbering and the public catalog.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const db = new PGlite();
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create role anon; create role authenticated;
  grant usage on schema public, auth to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update on storage.objects to anon, authenticated;
`);
await db.exec(readFileSync(new URL('./migrations/20261022000000_records.sql', import.meta.url), 'utf8'));
await db.exec(`
  grant select, insert, update on public.records to authenticated;
  grant execute on function auth.uid() to authenticated;
  insert into auth.users values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
  insert into public.shop_owners values ('11111111-1111-4111-8111-111111111111');
`);

const as = async (uid, sql, params) => {
  await db.exec(`set role authenticated; select set_config('test.uid', '${uid}', false);`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role;'); }
};
const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';
const row = (id, number, updatedAt, extra = {}) => ({
  collection: 'orders', id, updated_at: updatedAt, deleted: false,
  data: { id, number, updatedAt, lines: [], ...extra },
});
const push = (uid, rows) => as(uid, 'select public.push_records($1::jsonb)', [JSON.stringify(rows)]);
const orders = async () => (await as(OWNER, "select id, data->>'number' as n, data->>'note' as note from records where collection = 'orders' order by id")).rows;

const A = 'aaaaaaaa-0000-4000-8000-000000000001';
const B = 'bbbbbbbb-0000-4000-8000-000000000002';

// 1. The owner can upload; a stranger can't read or write.
await push(OWNER, [row(A, 1, '2026-10-22T10:00:00.000Z', { note: 'first' })]);
assert.equal((await orders()).length, 1);
assert.equal((await as(STRANGER, 'select * from records')).rows.length, 0, 'stranger reads nothing');
await assert.rejects(push(STRANGER, [row(B, 9, '2026-10-22T10:00:00.000Z')]), /row-level security/, 'stranger cannot write');

// 2. Newer wins, older is ignored.
await push(OWNER, [row(A, 1, '2026-10-22T09:00:00.000Z', { note: 'older' })]);
assert.equal((await orders())[0].note, 'first');
await push(OWNER, [row(A, 1, '2026-10-22T11:00:00.000Z', { note: 'newer' })]);
assert.equal((await orders())[0].note, 'newer');

// 3. Another device made order #1 too while offline: it gets the next number and a newer timestamp.
const before = (await as(OWNER, "select max(synced_at) as t from records")).rows[0].t;
await push(OWNER, [row(B, 1, '2026-10-22T10:30:00.000Z')]);
const all = await orders();
assert.deepEqual(all.map((o) => o.n), ['1', '2']);
const b = (await as(OWNER, `select data->>'updatedAt' as u, updated_at, synced_at from records where id = '${B}'`)).rows[0];
assert.ok(b.u > '2026-10-22T10:30:00.000Z' && b.synced_at > before, 'renumbered row is newer, so devices pull it');
assert.equal(new Date(b.updated_at).toISOString(), b.u, 'column and JSON timestamps agree');

// 4. Re-uploading the same order with its own number doesn't renumber it.
await push(OWNER, [row(B, 2, '2026-10-23T00:00:00.000Z')]);
assert.deepEqual((await orders()).map((o) => o.n), ['1', '2']);

// 5. Deletes are flags; there is no delete permission.
await assert.rejects(as(OWNER, `delete from records where id = '${A}'`), /permission denied|row-level/);

// 6. anon can't call the upload function.
await db.exec('set role anon;');
await assert.rejects(db.query('select public.push_records($1::jsonb)', ['[]']), /permission denied/);
await db.exec('reset role;');

// 7. Upload limits: more than 500 records, or one record over 4 MB, is refused.
const many = Array.from({ length: 501 }, (_, i) => row(`cccccccc-0000-4000-8000-${String(i).padStart(12, '0')}`, 1000 + i, '2026-10-22T10:00:00.000Z'));
await assert.rejects(push(OWNER, many), /at most 500/);
await assert.rejects(push(OWNER, [row('dddddddd-0000-4000-8000-000000000001', 3000, '2026-10-22T10:00:00.000Z', { photo: 'x'.repeat(4_100_000) })]), /larger than 4 MB/);
assert.equal((await orders()).length, 2, 'refused uploads wrote nothing');

// 8. The migration can be run again without errors (how updates are applied).
await db.exec(readFileSync(new URL('./migrations/20261022000000_records.sql', import.meta.url), 'utf8'));
assert.equal((await orders()).length, 2, 're-running keeps the data');


// 9. The public catalog: only switched-on products, stock as 'out'/'low' (never a number), and
// photo names that match what the app uploads (SHA-256 of the data URL, as src/data/catalog.ts).
const rec = (collection, id, data) => ({ collection, id, updated_at: '2026-10-24T00:00:00.000Z', deleted: false, data: { id, updatedAt: '2026-10-24T00:00:00.000Z', ...data } });
const P1 = 'eeeeeeee-0000-4000-8000-000000000001';
const P2 = 'eeeeeeee-0000-4000-8000-000000000002';
const photo = 'data:image/jpeg;base64,AAAA';
await push(OWNER, [
  rec('products', P1, { name: 'Daisy claw clip', description: 'Acetate', price: 12000, categoryIds: [], photo, showInCatalog: true,
    variants: [{ id: 'v-yellow', name: 'Yellow', photo: null }, { id: 'v-white', name: 'White', photo: null }, { id: 'v-pink', name: 'Pink', photo: null }] }),
  rec('products', P2, { name: 'Hidden', description: '', price: 100, categoryIds: [], photo: null, variants: [{ id: 'v-h', name: '', photo: null }] }),
  rec('stock', 'eeeeeeee-0000-4000-8000-000000000011', { productId: P1, variantId: 'v-yellow', delta: 8 }),
  rec('stock', 'eeeeeeee-0000-4000-8000-000000000012', { productId: P1, variantId: 'v-white', delta: 4 }),
  rec('orders', 'eeeeeeee-0000-4000-8000-000000000021', { number: 50, lines: [{ variantId: 'v-yellow', qty: 2 }] }),
]);
await db.exec('set role anon;');
const cat = (await db.query('select public.catalog() as c')).rows[0].c;
await assert.rejects(db.query('select * from public.records'), /permission denied/, 'anon reads no records directly');
await db.exec('reset role;');
assert.deepEqual(cat.products.map((p) => p.name), ['Daisy claw clip'], 'only switched-on products');
const daisy = cat.products[0];
assert.deepEqual(daisy.variants.map((v) => v.stock), [null, 'low', 'out'], 'yellow 6 left, white 4, pink 0');
assert.equal(daisy.stock, null, '10 left in total');
assert.equal(daisy.photo, createHash('sha256').update(photo).digest('hex') + '.jpg');
assert.ok(!JSON.stringify(cat).match(/"(delta|qty|lines)"/), 'no stock numbers or orders leave');

// 10. Only the owner can upload catalog photos.
const upload = (uid) => as(uid, "insert into storage.objects (bucket_id, name) values ('catalog', 'x.jpg')");
await upload(OWNER);
await assert.rejects(upload(STRANGER), /row-level security/);
await db.exec('set role anon;');
await assert.rejects(db.query("insert into storage.objects (bucket_id, name) values ('catalog', 'y.jpg')"), /row-level security/);
await db.exec('reset role;');
await db.exec(readFileSync(new URL('./migrations/20261022000000_records.sql', import.meta.url), 'utf8'));

console.log('SQL migration: all checks passed');
