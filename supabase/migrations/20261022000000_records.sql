-- caracebu: the whole database. Run in Supabase › SQL Editor (see README).
-- Safe to run again after changes: everything below replaces what's there.
--
-- Every synced record (products, categories, events, orders, stock changes) is one row of JSON.
-- The app keeps its own copy on each device and works offline; this table is where the
-- iPad and the computer meet. The newer change wins.

-- Who may use the data: the shop owner's login only. Add the owner's user id after creating
-- the account (README step 4). Sign-ups stay disabled, but this keeps the data safe even if
-- someone turns them on by mistake.
create table if not exists public.shop_owners (
  user_id uuid primary key references auth.users on delete cascade
);
alter table public.shop_owners enable row level security; -- no policies: only the dashboard edits it

create or replace function public.is_shop_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shop_owners where user_id = (select auth.uid()));
$$;
revoke all on function public.is_shop_owner() from public, anon;
grant execute on function public.is_shop_owner() to authenticated;

create table if not exists public.records (
  collection text not null check (collection in ('products', 'categories', 'events', 'orders', 'stock')),
  id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  -- Server time of the last write; devices download only rows newer than what they've seen.
  synced_at timestamptz not null default clock_timestamp(),
  primary key (collection, id)
);
create index if not exists records_synced_at on public.records (synced_at, id);

alter table public.records enable row level security;
drop policy if exists "shop owner reads" on public.records;
drop policy if exists "shop owner adds" on public.records;
drop policy if exists "shop owner changes" on public.records;
create policy "shop owner reads" on public.records for select to authenticated using (public.is_shop_owner());
create policy "shop owner adds" on public.records for insert to authenticated with check (public.is_shop_owner());
create policy "shop owner changes" on public.records for update to authenticated
  using (public.is_shop_owner()) with check (public.is_shop_owner());
-- No delete policy: deleting is a flag (deleted = true), so it reaches the other device.

create or replace function public.touch_synced_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.touch_synced_at();

-- Uploads a batch from a device. A row only replaces the stored one if it's at least as new.
-- Limits (so a stolen login or a buggy device can't fill the free 500 MB database in one go):
-- at most 500 records per upload, and 4 MB per record (a product with photos is ~0.1–1 MB).
-- Two devices can give an order the same number while offline; the later upload gets the
-- next free number (and a fresh timestamp, so both devices pick up the change).
create or replace function public.push_records(rows jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  r jsonb;
  next_number int;
begin
  -- One upload at a time, so two devices can't both claim the next order number.
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) > 500 then
    raise exception 'An upload holds at most 500 records' using errcode = '54000';
  end if;
  perform pg_advisory_xact_lock(hashtext('caracebu.push_records'));
  for r in select value from jsonb_array_elements(rows) loop
    if octet_length((r->'data')::text) > 4000000 then
      raise exception 'A record is larger than 4 MB' using errcode = '54000';
    end if;
    if r->>'collection' = 'orders'
       and not coalesce((r->>'deleted')::boolean, false)
       and exists (
         select 1 from records
         where collection = 'orders' and id <> (r->>'id')::uuid and not deleted
           and data->'number' = r->'data'->'number'
       ) then
      select coalesce(max((data->>'number')::int), 0) + 1 into next_number from records where collection = 'orders';
      r := jsonb_set(r, '{data,number}', to_jsonb(next_number));
      -- Newer than the upload even if the device's clock runs ahead, so the device takes the new number.
      r := jsonb_set(r, '{data,updatedAt}', to_jsonb(to_char(
        greatest(clock_timestamp(), (r->>'updated_at')::timestamptz + interval '1 millisecond') at time zone 'utc',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
      r := jsonb_set(r, '{updated_at}', r->'data'->'updatedAt');
    end if;

    insert into records (collection, id, data, updated_at, deleted)
    values (
      r->>'collection',
      (r->>'id')::uuid,
      r->'data',
      (r->>'updated_at')::timestamptz,
      coalesce((r->>'deleted')::boolean, false)
    )
    on conflict (collection, id) do update
      set data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted
      where records.updated_at <= excluded.updated_at;
  end loop;
end $$;
revoke all on function public.push_records(jsonb) from public, anon;
grant execute on function public.push_records(jsonb) to authenticated;

-- ---- Public catalog (docs/BRIEF.md, "Public catalog") ----------------------------------
-- Anyone, signed in or not, can read the products the owner switched to "Show in catalog":
-- name, description, price, categories, colours and photo file names. Stock never leaves as a
-- number, only 'out' (sold out) or 'low' (5 pieces or fewer). Orders, events and stock records
-- stay owner-only: this function is the only way in for visitors.

create or replace function public.stock_status(n numeric) returns text
language sql immutable set search_path = '' as $$
  select case when n <= 0 then 'out' when n <= 5 then 'low' end;
$$;

-- Photos are data URLs inside the product record. The owner's device copies each catalog photo
-- to the public "catalog" bucket under the SHA-256 of that text, so visitors load ordinary,
-- cacheable images instead of pulling every photo through the database (src/data/catalog.ts).
create or replace function public.catalog_photo_path(photo text) returns text
language sql immutable set search_path = '' as $$
  select case when coalesce(photo, '') = '' then null
    else encode(sha256(convert_to(photo, 'UTF8')), 'hex') || '.jpg' end;
$$;

create or replace function public.catalog() returns jsonb
language sql stable security definer set search_path = '' as $$
  with left_by_variant as (
    select variant_id, sum(n) as n from (
      select s.data->>'variantId' as variant_id, (s.data->>'delta')::bigint as n
      from public.records s where s.collection = 'stock' and not s.deleted
      union all
      select l->>'variantId', -(l->>'qty')::bigint
      from public.records o cross join lateral jsonb_array_elements(o.data->'lines') l
      where o.collection = 'orders' and not o.deleted
    ) x group by variant_id
  ),
  shown as (
    select p.data as d from public.records p
    where p.collection = 'products' and not p.deleted and coalesce((p.data->>'showInCatalog')::boolean, false)
  )
  select jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d->>'id',
        'name', d->>'name',
        'description', d->>'description',
        'price', (d->>'price')::bigint,
        'categoryIds', d->'categoryIds',
        'photo', public.catalog_photo_path(d->>'photo'),
        'variants', (
          select jsonb_agg(jsonb_build_object(
            'id', v->>'id',
            'name', v->>'name',
            'photo', public.catalog_photo_path(v->>'photo'),
            'stock', public.stock_status(coalesce(s.n, 0))
          ) order by t.ord)
          from jsonb_array_elements(d->'variants') with ordinality as t(v, ord)
          left join left_by_variant s on s.variant_id = v->>'id'
        ),
        'stock', public.stock_status((
          select coalesce(sum(greatest(s.n, 0)), 0)
          from jsonb_array_elements(d->'variants') v
          join left_by_variant s on s.variant_id = v->>'id'
        ))
      ) order by d->>'name')
      from shown
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.data->>'id', 'name', c.data->>'name') order by c.data->>'name')
      from public.records c where c.collection = 'categories' and not c.deleted
        -- only categories that hold a catalog product, so other category names stay private
        and c.data->>'id' in (select jsonb_array_elements_text(d->'categoryIds') from shown)
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.catalog() from public;
grant execute on function public.catalog() to anon, authenticated;

-- The bucket is public for reading (that's what makes the photos cacheable); only the owner
-- uploads. JPEG only, at most 1 MB a file (the app saves 600 px photos, about 100 KB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog', 'catalog', true, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shop owner reads catalog photos" on storage.objects;
drop policy if exists "shop owner adds catalog photos" on storage.objects;
drop policy if exists "shop owner changes catalog photos" on storage.objects;
create policy "shop owner reads catalog photos" on storage.objects for select to authenticated
  using (bucket_id = 'catalog' and public.is_shop_owner());
create policy "shop owner adds catalog photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog' and public.is_shop_owner());
create policy "shop owner changes catalog photos" on storage.objects for update to authenticated
  using (bucket_id = 'catalog' and public.is_shop_owner()) with check (bucket_id = 'catalog' and public.is_shop_owner());
