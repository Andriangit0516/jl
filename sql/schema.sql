-- Christmas Party Wishlist — database schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → paste → Run.

-- 1) The table that stores every wish.
create table if not exists public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  person_name text not null,                 -- who wants it
  title       text not null,                 -- the wish itself
  url         text,                          -- link to the product / reference
  details     text,                          -- size, color, notes, etc.
  price       text,                          -- free text, e.g. "~₱1,500" or "any"
  priority    text not null default 'Would love',  -- Top pick | Would love | Nice to have
  claimed_by  text                           -- name of whoever will gift it (null = unclaimed)
);

-- 2) Row Level Security. This is an internal, trust-based party app using the
--    public anon key, so the policies below are intentionally permissive:
--    anyone with the app can read, add, claim, and remove wishes.
--    (Lock these down if you ever make it public-facing.)
alter table public.wishlist_items enable row level security;

drop policy if exists "wishlist read"   on public.wishlist_items;
drop policy if exists "wishlist insert" on public.wishlist_items;
drop policy if exists "wishlist update" on public.wishlist_items;
drop policy if exists "wishlist delete" on public.wishlist_items;

create policy "wishlist read"   on public.wishlist_items for select using (true);
create policy "wishlist insert" on public.wishlist_items for insert with check (true);
create policy "wishlist update" on public.wishlist_items for update using (true) with check (true);
create policy "wishlist delete" on public.wishlist_items for delete using (true);

-- 3) Realtime — so new wishes pop in live for everyone during the party.
alter publication supabase_realtime add table public.wishlist_items;
