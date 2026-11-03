-- Christmas Party Wishlist — database schema (with accounts)
-- Run this in your Supabase project: Dashboard → SQL Editor → paste → Run.
-- It is safe to re-run: existing objects are updated, not duplicated.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) PROFILES — one row per account, holds the display name shown on wishes.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles read"        on public.profiles;
drop policy if exists "profiles insert self" on public.profiles;
drop policy if exists "profiles update self" on public.profiles;

-- Signed-in users can see everyone's name (to label wishes) but only edit their own.
create policy "profiles read"        on public.profiles for select using (auth.uid() is not null);
create policy "profiles insert self" on public.profiles for insert with check (id = auth.uid());
create policy "profiles update self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Auto-create a profile whenever someone signs up. The display name comes from
-- the signup form (user metadata); falls back to the email's local part.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) WISHLIST ITEMS — each wish is bound to the account that created it.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete cascade,  -- the owner (set automatically)
  person_name text not null,                 -- owner's display name (set automatically)
  title       text not null,                 -- the wish itself
  url         text,                          -- link to the product / reference
  details     text,                          -- size, color, notes, etc.
  priority    text not null default 'Would love',  -- Top pick | Would love | Nice to have
  is_claimed  boolean not null default false, -- reserved by a (hidden) gifter — NO identity here
  image_url   text                           -- optional photo/screenshot (data URL)
);

-- Keep older installs in sync (columns added/removed over time).
alter table public.wishlist_items add column if not exists user_id    uuid references auth.users(id) on delete cascade;
alter table public.wishlist_items add column if not exists image_url  text;
alter table public.wishlist_items add column if not exists is_claimed boolean not null default false;
alter table public.wishlist_items drop column if exists price;
-- Drop the old identity-revealing claim column (claims now live in wish_claims).
alter table public.wishlist_items drop column if exists claimed_by;

-- Owner + name are stamped server-side so nobody can post under another name.
create or replace function public.wishlist_set_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nm text;
begin
  new.user_id := auth.uid();

  -- Prefer the profile name; if the profile is missing (account predates the
  -- profiles trigger), build it from the account and store it, so a real name
  -- always shows instead of a placeholder.
  select display_name into nm from public.profiles where id = auth.uid();
  if nm is null then
    select coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'), ''), split_part(u.email, '@', 1))
      into nm
      from auth.users u where u.id = auth.uid();
    if nm is not null then
      insert into public.profiles (id, display_name) values (auth.uid(), nm)
      on conflict (id) do nothing;
    end if;
  end if;

  new.person_name := coalesce(nm, 'Someone');
  new.is_claimed  := false;  -- a wish can't be pre-claimed at creation
  return new;
end;
$$;

drop trigger if exists wishlist_before_insert on public.wishlist_items;
create trigger wishlist_before_insert
  before insert on public.wishlist_items
  for each row execute function public.wishlist_set_owner();

alter table public.wishlist_items enable row level security;

drop policy if exists "wishlist read"       on public.wishlist_items;
drop policy if exists "wishlist insert"     on public.wishlist_items;
drop policy if exists "wishlist insert own" on public.wishlist_items;
drop policy if exists "wishlist update"     on public.wishlist_items;
drop policy if exists "wishlist update own" on public.wishlist_items;
drop policy if exists "wishlist delete"     on public.wishlist_items;
drop policy if exists "wishlist delete own" on public.wishlist_items;

-- Everyone signed in can read all wishes; you can only add/edit/remove your own.
create policy "wishlist read"       on public.wishlist_items for select using (auth.uid() is not null);
create policy "wishlist insert own" on public.wishlist_items for insert with check (user_id = auth.uid());
create policy "wishlist update own" on public.wishlist_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "wishlist delete own" on public.wishlist_items for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) CLAIMING — ANONYMOUS (Secret-Santa safe).
--    A claim lives in its own table that ONLY the claimer can read, so nobody —
--    not even the wisher — can see who is gifting a wish. The wish row carries
--    just a non-identifying boolean (is_claimed) so two people don't buy the same
--    gift. A security-definer trigger keeps that boolean in sync.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.wish_claims (
  wish_id    uuid primary key references public.wishlist_items(id) on delete cascade,
  claimer_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.wish_claims enable row level security;

drop policy if exists "claims read own"   on public.wish_claims;
drop policy if exists "claims insert own" on public.wish_claims;
drop policy if exists "claims delete own" on public.wish_claims;

-- You can only ever SEE / MAKE / REMOVE your own claim. Others' claims are invisible.
create policy "claims read own"   on public.wish_claims for select using (claimer_id = auth.uid());
create policy "claims insert own" on public.wish_claims for insert with check (claimer_id = auth.uid());
create policy "claims delete own" on public.wish_claims for delete using (claimer_id = auth.uid());

-- Mirror claim state onto the wish as a public, identity-free boolean.
create or replace function public.sync_is_claimed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.wishlist_items set is_claimed = true  where id = new.wish_id;
    return new;
  else
    update public.wishlist_items set is_claimed = false where id = old.wish_id;
    return old;
  end if;
end;
$$;

drop trigger if exists wish_claims_sync_ins on public.wish_claims;
drop trigger if exists wish_claims_sync_del on public.wish_claims;
create trigger wish_claims_sync_ins after insert on public.wish_claims
  for each row execute function public.sync_is_claimed();
create trigger wish_claims_sync_del after delete on public.wish_claims
  for each row execute function public.sync_is_claimed();

-- Remove the old identity-revealing claim function if it exists.
drop function if exists public.claim_wish(uuid, boolean);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) BACKFILL — give every existing account + wish a name to show.
--    Safe to run repeatedly. Fixes rows created before this schema existed.
-- ─────────────────────────────────────────────────────────────────────────────

-- a) Ensure every account has a profile (name from signup metadata, else email).
insert into public.profiles (id, display_name)
select u.id,
       coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'), ''), split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

-- b) Fill in any blank / placeholder wish names from the owner's profile.
update public.wishlist_items w
set person_name = p.display_name
from public.profiles p
where w.user_id = p.id
  and (w.person_name is null or btrim(w.person_name) = '' or w.person_name = 'Someone');

-- NOTE: wishes created under the very first (pre-accounts) schema may have a NULL
-- user_id and can't be matched to an owner. Those are almost certainly old test
-- rows — remove them with:
--   delete from public.wishlist_items where user_id is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) REALTIME — new/updated/removed wishes appear live for everyone.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table public.wishlist_items;
exception when duplicate_object then
  null;  -- already added; ignore
end $$;
