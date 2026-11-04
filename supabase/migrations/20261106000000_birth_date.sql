-- Munchy: date of birth on the profile (the app works the age out from it).
-- Run once in the Supabase SQL editor (after 20261105000000_favorites_weights_dishes.sql).
--
-- `age` stays (it is still required and checked): the app writes the age it worked out from the date when it
-- saves. People who signed up before this have no birth_date yet; the app asks them for it when they edit
-- their profile, and uses the stored age until then.

alter table public.profiles add column birth_date date
  check (birth_date is null or (birth_date <= current_date and birth_date >= date '1900-01-01'));

-- Sign-up sends the profile in the new user's metadata; read the date from it too.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p jsonb := new.raw_user_meta_data -> 'profile';
begin
  if p is null then
    return new;
  end if;
  begin
    insert into public.profiles
      (id, goal, activity, sex, age, birth_date, height_cm, weight_kg, target_kcal, protein_g, carbs_g, fat_g)
    values
      (new.id, p ->> 'goal', p ->> 'activity', p ->> 'sex', (p ->> 'age')::integer,
       nullif(p ->> 'birth_date', '')::date,
       (p ->> 'height_cm')::numeric, (p ->> 'weight_kg')::numeric, (p ->> 'target_kcal')::integer,
       (p ->> 'protein_g')::integer, (p ->> 'carbs_g')::integer, (p ->> 'fat_g')::integer);
  exception when others then
    raise warning 'handle_new_user: no profile created for %: %', new.id, sqlerrm;
  end;
  return new;
end $$;
