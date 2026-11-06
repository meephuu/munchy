# Munchy frontend

Next.js (App Router) + Tailwind v4. The UI follows `../design/DESIGN.md` (V2, "Forest & Bronze"); the
`.dc.html` files in `../design/screens/` are the visual reference (rebuilt as components, never shipped).
The previous olive/teal design (V1) is kept in `../design/v1/` for reference only.

## Run it (two terminals)
```powershell
# 1. backend (from the repo root)
cd backend
..\.venv\Scripts\activate
uvicorn src.api:app --port 8000

# 2. frontend
cd frontend
npm install
copy .env.example .env.local     # BACKEND_URL, only needed if the backend is not on 127.0.0.1:8000
npm run dev                      # http://localhost:3000
```
`npm run build` makes a production build and type-checks; `npm run lint`; `npm test` runs the unit tests.

## Where things are
- `src/app/globals.css` – design tokens (colors, shadows, radii, the four font roles) as Tailwind `@theme` variables
- `src/app/layout.tsx` – fonts via `next/font`: Climate Crisis (logo and big numbers only), Fraunces (headings),
  Space Mono (eyebrows, amounts), Figtree + Anuphan for Thai (body)
- `src/components/Type.tsx` – `Eyebrow` (mono label), `Title` (serif heading, second half italic green), `Wordmark`
- `src/app/page.tsx` – Guest home (`/`)
- `src/app/dish/page.tsx` – Guest dish result (`/dish?q=...`): asks the backend, shows loading / error / empty states
- `src/lib/estimate.ts` – `POST /estimate` client (run on the server, so no CORS needed) and the mapping to what the screen shows
- `src/components/` – `DishResult`, `AmountEditor`, `IngredientSearch`, `DishStates`, `DishHeader`, `Chip`, icons
- `src/app/api/foods/route.ts` + `src/lib/foods.ts` – ingredient search proxy and client
- `src/app/onboarding/`, `src/components/OnboardingForm.tsx` – Get started: goal, body, typical day and the live daily target
- `src/lib/target.ts` – the target formula (pure, tested); `src/lib/profile.ts` – profile validation and database rows
- `src/app/login`, `src/app/signup`, `src/app/home`, `src/app/auth/callback` – accounts (see below)
- `src/proxy.ts`, `src/lib/supabase/` – keeps the login fresh and sends people to the right side of the app

## Daily target and accounts
**Get started** (`/onboarding`) asks goal, sex (optional; the formula needs it), age, height, weight and
typical day, and shows the daily target live: Mifflin-St Jeor resting needs x an activity factor (1.2 / 1.4 /
1.6), adjusted for the goal (-15% / 0 / +12% / +8%), protein by body weight, 28% of calories from fat, carbs
fill the rest. Weight loss is never targeted below the resting needs or 1,200 kcal, and the screen says so
when that floor applies. The answers wait in the browser until the person signs up.

**Accounts** use Supabase (email + password): `/signup` (needs the Get started answers first), `/login`,
`/home` (members only, see "Home and meal logging" below) and
`/auth/callback` (the link in the confirmation email). The proxy sends logged-in people from `/`, `/login`
and `/signup` to `/home`, and guests who open `/home` to `/login`. The profile is stored in one row per
account with row-level security; sign-up sends it along as metadata and a database trigger creates the row,
so it works with or without email confirmation. A logged-in person can reopen `/onboarding` to edit it.

Setup is in [`../supabase/README.md`](../supabase/README.md): create the project, run the SQL, put the URL
and anon key in `.env.local`. Without them the guest screens work and these pages say accounts are not
switched on.

## Home and meal logging
**Home** (`/home`) shows how many of today's calories are left (big number, gradient ring around the bowl,
terracotta when more than 5% over), the three macros against the daily target, and *Today's bites* (with
delete) plus a dashed NEXT row. "Today" is the person's own local day, so the meals are loaded in the browser
(`HomeToday`); `src/lib/meals.ts` holds the logic (slot from the time of day, day totals, next meal), all tested.
**Logging:** on a dish result a logged-in person gets "Log as" chips (breakfast / lunch / snack / dinner, from
their clock) and "Log to dinner · 392 kcal", which saves the meal with the amounts as edited and the foods as
added. Meals are rows in the Supabase `meals` table (run `supabase/migrations/20261104000000_meals.sql`).
The bottom nav (Home, Coach, "+", Progress, Me) is on the member screens; Coach is a "coming soon" page.
The proxy sends guests who open any member page to log in.

**Bite check extras (phase D):** "Where's it from?" (street stall / restaurant / home-cooked) and "Tweak it" chips
(less oil, no egg, half rice, extra protein; only the ones the dish has an ingredient for). They are plain rules in
`src/lib/tweaks.ts` that change amounts, so totals stay arithmetic and every change is listed under "How we estimated
this". Logged-in people also get a heart (favorites, shown on Home and the Log screen).

**Progress (phase E):** last 7 days of calories against the target (terracotta when over by more than 5%), streak,
protein average, a smoothed weight trend with a daily weight log, and "Buddy's note" written from rules in
`src/lib/progress.ts` (no LLM, no sodium).

**Account (`/account`, the Me tab):** profile card, daily target, the numbers behind it (edit goes to `/onboarding`, which has its own heading for logged-in people), shortcuts and log out.

**Search suggestions:** the Home and Log search boxes offer favorites, dishes searched on this device (kept in localStorage) or logged before, and new dishes that suit the person's goal (a curated list in `src/lib/suggest.ts`, rotated daily, never ones they already have).

**Coach (`/coach`):** the room left today (calories and protein) and up to 3 dishes that fit, on three tabs (Best fit, High protein, Lighter). Rules in `src/lib/coach.ts` over `src/lib/catalog.json`, which `backend/build_catalog.py` writes from our own estimator. No place data, so no "near me".

**My dishes:** on the Log screen ("+") a person can create their own dish: type calories and macros for one
serving, and/or add ingredients (optional) that add up into those numbers. Saved in `custom_dishes`, loggable in one tap.
Needs `supabase/migrations/20261105000000_favorites_weights_dishes.sql`.

## Editing amounts
Tap an ingredient on the result to change how much of it is in the meal: - / + , a typed amount, or
Half / As estimated / Double. 0 leaves the food out. The amount can be in grams or in the food's own
units (1 egg, 2 tbsp, 3 slices, a cup...): the backend sends each food's units (`units`, English labels),
the editor opens in the unit the amount reads best in (50 g of boiled egg -> 1 egg) and a "measure in"
row switches between them. Steps are 10 g, half a spoon/cup, or one piece. The meal itself always keeps
grams (`src/lib/units.ts` only converts for display and typing). Totals, macros, weight and the
range follow instantly: the backend sends each food's per-100 g values (`lines[].per_100g`), so this is
plain arithmetic in the browser (`summarize` in `src/lib/estimate.ts`), with no new request. "Reset to
the estimate" undoes all edits. Edits live only in the open page for now (nothing is saved).

## Adding an ingredient
"Add an ingredient" under the list opens a search box. As you type (after a short pause) it asks
`GET /api/foods?q=...`, a small route in this app that forwards to the backend's `/foods/search`, so the
browser never needs the backend address. Name matches come first (whole word before part of a longer
word), then similar foods by meaning (it also finds Thai names). Picking one adds it at its typical
serving, marked "added", with its amount editor open and a Remove button; picking a food that is already
in the meal just opens it. Added foods are listed under "How we estimated this", and "Reset to the
estimate" removes them.

## Phone frame
Everything is built for phone size only for now. On screens 600px and wider the app is shown as a fixed
390 x 844 phone on a dark page (scrolling inside it); below 600px it fills the screen with no frame.
This is `.app-shell` in `src/app/globals.css`; remove it when real responsive layouts are built.

## How the numbers get on screen
The backend returns totals, per-food lines, assumptions and warnings. The screen shows kcal with a
range of about ±14%, protein / carbs / fat, total weight and the ingredient list. A short yellow notice
appears only when part of the input could not be found (so the total is partial); everything else the
backend had to guess or was unsure about (assumed amounts, typical parts, uncertain matches) is in the
collapsed "How we estimated this" fold. A new search always starts from a clean result. Confidence is derived from what the backend had to
guess: **Low** if part of the input could not be matched, **Medium** if there were uncertain matches or
assumed amounts, **High** if neither.

## Not built yet
- Coach (placeholder for now), editing a logged meal or a saved dish (delete and create again instead).
- Place and tweak chips are approximations (fixed rules), not data from the backend.
- Sodium: the database has none, so the fourth tile shows total weight instead.
