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
  claimed_by  text,                          -- display name of whoever will gift it
  image_url   text                           -- optional photo/screenshot (data URL)
);

-- Keep older installs in sync (columns added/removed over time).
alter table public.wishlist_items add column if not exists user_id   uuid references auth.users(id) on delete cascade;
alter table public.wishlist_items add column if not exists image_url text;
alter table public.wishlist_items drop column if exists price;

-- Owner + name are stamped server-side so nobody can post under another name.
create or replace function public.wishlist_set_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id     := auth.uid();
  new.person_name := coalesce((select display_name from public.profiles where id = auth.uid()), 'Someone');
  new.claimed_by  := null;   -- a wish can't be pre-claimed at creation
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
-- 3) CLAIMING — anyone signed in can claim/unclaim a wish (that's a gift pledge,
--    not editing the wish). Done via a function so the owner-only UPDATE policy
--    above still protects the wish's actual contents.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.claim_wish(p_id uuid, p_claim boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select display_name into me from public.profiles where id = auth.uid();

  if p_claim then
    update public.wishlist_items set claimed_by = me
      where id = p_id and claimed_by is null;               -- only if still free
  else
    update public.wishlist_items set claimed_by = null
      where id = p_id and claimed_by = me;                  -- only the claimer can release
  end if;
end;
$$;

grant execute on function public.claim_wish(uuid, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) REALTIME — new/updated/removed wishes appear live for everyone.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table public.wishlist_items;
exception when duplicate_object then
  null;  -- already added; ignore
end $$;
