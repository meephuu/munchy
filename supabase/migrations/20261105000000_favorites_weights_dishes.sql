-- Munchy: favorite dishes (phase D), the weight log (phase E) and a person's own custom dishes.
-- Run once in the Supabase SQL editor (after 20261104000000_meals.sql).

-- ---- favorites: a dish the person saved with the heart on the Bite check -----------------------
create table public.favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 500),
  -- lower-cased, trimmed title (made by the app): one favorite per dish, however it was typed
  key        text not null check (char_length(key) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.favorites enable row level security;

create policy "favorites: read own" on public.favorites
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "favorites: insert own" on public.favorites
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "favorites: delete own" on public.favorites
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---- weights: one weigh-in per person per (local) day ----------------------------------------
create table public.weights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- the person's LOCAL calendar day, sent by the app (same idea as meals.eaten_on)
  logged_on  date not null,
  kg         numeric(5, 1) not null check (kg >= 30 and kg <= 250),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

alter table public.weights enable row level security;

create policy "weights: read own" on public.weights
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "weights: insert own" on public.weights
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "weights: update own" on public.weights
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "weights: delete own" on public.weights
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---- custom_dishes: a dish the person made up, with nutrition typed in (ingredients optional) ----
create table public.custom_dishes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  -- the numbers for ONE serving as the person entered them (or as the ingredients add up)
  kcal       numeric(7, 1) not null check (kcal >= 0 and kcal <= 20000),
  protein_g  numeric(6, 1) not null check (protein_g >= 0 and protein_g <= 2000),
  carbs_g    numeric(6, 1) not null check (carbs_g >= 0 and carbs_g <= 5000),
  fat_g      numeric(6, 1) not null check (fat_g >= 0 and fat_g <= 2000),
  -- optional ingredients: [{name, grams, kcal, protein, carbs, fat}] (empty when only totals were typed)
  items      jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now()
);

create index custom_dishes_user_idx on public.custom_dishes (user_id, created_at desc);

alter table public.custom_dishes enable row level security;

create policy "custom_dishes: read own" on public.custom_dishes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "custom_dishes: insert own" on public.custom_dishes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "custom_dishes: delete own" on public.custom_dishes
  for delete to authenticated using ((select auth.uid()) = user_id);
