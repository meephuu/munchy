# Supabase setup (accounts and profiles)

Munchy uses Supabase only for sign-up / log-in and for per-person data. The food database and the
estimation engine stay in `backend/` (SQLite), untouched.

## 1. Create the project
1. Sign up at https://supabase.com and create a new project (the free tier is enough). Pick the region
   closest to your users (e.g. Singapore) and save the database password somewhere safe.
2. Click **Connect** (top of the project page) → **Framework: Next.js**, then open the **`.env.local`** tab:
   it shows your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` lines ready to copy.
   (Also under **Project Settings → API Keys**.) Never use the secret / `service_role` key in the frontend.

## 2. Create the tables
Open **SQL Editor**, paste the contents of `migrations/20261103000000_profiles.sql` and run it. It creates
the `profiles` table with row-level security (people can only see and change their own row) and a trigger
that builds the profile from the sign-up form.

## 3. Choose how sign-up confirms
**Authentication → Providers → Email**:
- For development, turn **Confirm email** off: people are signed in right after sign-up.
- For production keep it on: after sign-up the app shows "check your email" and the profile is created
  from the sign-up data by the trigger. Add your site URL under **Authentication → URL Configuration**.

## 4. Tell the frontend
Create `frontend/.env.local` (it is gitignored) and paste the two lines from step 1:
```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```
(`NEXT_PUBLIC_SUPABASE_ANON_KEY` works too, for older projects.)
Restart `npm run dev`. Without these two values the guest screens still work; the sign-up and log-in
pages just say that accounts are not set up.
