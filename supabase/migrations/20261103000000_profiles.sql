-- Munchy: one profile per account (what the person told us, and the daily target worked out from it).
-- Run once in the Supabase SQL editor (or with the Supabase CLI: `supabase db push`).

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  goal        text not null check (goal in ('lose', 'maintain', 'gain', 'muscle')),
  activity    text not null check (activity in ('desk', 'feet', 'active')),
  sex         text not null check (sex in ('female', 'male', 'unspecified')),
  age         integer not null check (age between 14 and 100),
  height_cm   numeric(5, 1) not null check (height_cm between 120 and 230),
  weight_kg   numeric(5, 1) not null check (weight_kg between 30 and 250),
  -- the target computed by the app from the fields above (see frontend/src/lib/target.ts)
  target_kcal integer not null check (target_kcal between 1000 and 6000),
  protein_g   integer not null check (protein_g >= 0),
  carbs_g     integer not null check (carbs_g >= 0),
  fat_g       integer not null check (fat_g >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Row-level security: a signed-in person can read and change only their own profile.
-- There is no delete policy: deleting the account deletes the profile (on delete cascade).
alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Sign-up sends the profile in the new user's metadata (options.data.profile), because with email
-- confirmation on there is no session yet to write the row with. This trigger turns it into the row.
-- If the metadata is missing or invalid the account is still created, without a profile; the app then
-- asks for the profile after login.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p jsonb := new.raw_user_meta_data -> 'profile';
begin
  if p is null then
    return new;
  end if;
  begin
    insert into public.profiles
      (id, goal, activity, sex, age, height_cm, weight_kg, target_kcal, protein_g, carbs_g, fat_g)
    values
      (new.id, p ->> 'goal', p ->> 'activity', p ->> 'sex', (p ->> 'age')::integer,
       (p ->> 'height_cm')::numeric, (p ->> 'weight_kg')::numeric, (p ->> 'target_kcal')::integer,
       (p ->> 'protein_g')::integer, (p ->> 'carbs_g')::integer, (p ->> 'fat_g')::integer);
  exception when others then
    raise warning 'handle_new_user: no profile created for %: %', new.id, sqlerrm;
  end;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
