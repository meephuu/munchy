-- Munchy: logged meals. One row per meal a person logs ("Log to dinner").
-- Run once in the Supabase SQL editor (after 20261103000000_profiles.sql).

create table public.meals (
  id         uuid primary key default gen_random_uuid(),
  -- filled in by the database from the login, so the app never sends (or fakes) it
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_at   timestamptz not null default now(),
  -- the person's LOCAL calendar day, sent by the app, so "today" follows their clock and timezone
  eaten_on   date not null,
  slot       text not null check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  title      text not null check (char_length(title) between 1 and 500),
  -- totals at the amounts they chose (stored so a day's sum is one cheap query)
  kcal       numeric(7, 1) not null check (kcal >= 0 and kcal <= 20000),
  protein_g  numeric(6, 1) not null check (protein_g >= 0 and protein_g <= 2000),
  carbs_g    numeric(6, 1) not null check (carbs_g >= 0 and carbs_g <= 5000),
  fat_g      numeric(6, 1) not null check (fat_g >= 0 and fat_g <= 2000),
  -- the ingredients as logged: [{name, grams, kcal, protein, carbs, fat}]
  items      jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now()
);

create index meals_user_day_idx on public.meals (user_id, eaten_on, eaten_at);

-- Row-level security: a signed-in person can read, add, change and delete only their own meals.
alter table public.meals enable row level security;

create policy "meals: read own" on public.meals
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "meals: insert own" on public.meals
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "meals: update own" on public.meals
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "meals: delete own" on public.meals
  for delete to authenticated using ((select auth.uid()) = user_id);
