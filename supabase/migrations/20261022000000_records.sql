-- caracebu: the whole database. Run once in Supabase › SQL Editor (see README).
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
-- Two devices can give an order the same number while offline; the later upload gets the
-- next free number (and a fresh timestamp, so both devices pick up the change).
create or replace function public.push_records(rows jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  r jsonb;
  next_number int;
begin
  -- One upload at a time, so two devices can't both claim the next order number.
  perform pg_advisory_xact_lock(hashtext('caracebu.push_records'));
  for r in select value from jsonb_array_elements(rows) loop
    if r->>'collection' = 'orders'
       and not coalesce((r->>'deleted')::boolean, false)
       and exists (
         select 1 from records
         where collection = 'orders' and id <> (r->>'id')::uuid and not deleted
           and data->'number' = r->'data'->'number'
       ) then
      select coalesce(max((data->>'number')::int), 0) + 1 into next_number from records where collection = 'orders';
      r := jsonb_set(r, '{data,number}', to_jsonb(next_number));
      r := jsonb_set(r, '{data,updatedAt}', to_jsonb(to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
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
