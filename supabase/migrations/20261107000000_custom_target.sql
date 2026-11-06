-- Munchy: a person can set their own daily target (calories and macros) instead of the calculated one.
-- Run once in the Supabase SQL editor (or with the Supabase CLI: `supabase db push`).
-- All four are null until they do (then the app uses the calculated target); the existing profile update policy covers them.

alter table public.profiles
  add column custom_kcal      integer check (custom_kcal between 1000 and 6000),
  add column custom_protein_g integer check (custom_protein_g between 0 and 1000),
  add column custom_carbs_g   integer check (custom_carbs_g between 0 and 1000),
  add column custom_fat_g     integer check (custom_fat_g between 0 and 1000);
