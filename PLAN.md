# Munchy — product plan (frontend + accounts)

This file is the plan for everything built **after** the estimation engine. The backend's own
step list (steps 1–15, all done) stays in [`backend/ROADMAP.md`](backend/ROADMAP.md).

## Where these steps come from
- **Screens:** the table in [`design/DESIGN.md`](design/DESIGN.md) lists 7 screens (Guest home, Guest dish
  result, Onboarding, Home, Bite check, Coach, Progress). That table is the only thing the design folder says.
- **Order and grouping (phases A–F below):** worked out in the planning chat by sorting those screens by what
  each one needs first (accounts before logging, logging before Progress, and so on). It is a proposal, not
  something the design dictates; change it if your priorities differ.
- **Working rules:** [`CLAUDE.md`](CLAUDE.md): one step at a time, explain the plan and wait for an OK before
  coding, tick things off here, one commit per finished step.

## Status

| Phase | What | Status | Commits |
|-------|------|--------|---------|
| — | Guest home, guest dish result, real estimates from the backend | done | `372f6f9`, `e3d41d3` |
| — | Edit amounts, add an ingredient, units per food, phone frame | done | `ec55548`, `70b0136`, `a517281`, `9409e6b` |
| A | Guest polish: installable app (manifest, icons), 390px check | done | `f925016` |
| B | Get started screen + daily target formula + Supabase accounts (sign-up, log-in, log-out, profile) | done | `da4c259`, `f8e38e1` |
| — | Redesign to V2 "Forest & Bronze" | done | `da639bd` |
| C | Home + meal logging | done, checked against the real Supabase project | `2029751`, `a547113`, `c81596a` |
| D | Logged-in Bite check (tweak chips, "where's it from", favorites) | built; needs the new SQL run, then a real-project check | |
| E | Progress (week bars, streak, weight log + trend, rule-based note) | built; needs the new SQL run, then a real-project check | |
| — | My dishes: custom dishes with typed nutrition, ingredients optional | built; same SQL | |
| F | Coach | planned, least defined | |

Not in any phase yet (backlog): see the end of this file.

---

## Phase C — Home and meal logging (done)

**Goal:** a logged-in person can log what they ate, and Home shows how much of today's target is left.

**Result:** built as planned (option 1: Supabase straight from the app; slots breakfast / lunch / snack / dinner;
"today" ends at the person's local midnight). Checked end to end against the real project with test users:
sign up, log a meal with edited amounts from the dish page, see it on Home with the right totals, delete it
with a confirm; and at the database level: another user sees nothing, cannot insert a meal for someone else,
cannot delete someone else's, an invalid slot is refused. Details below are the plan as written.

### C.0 Decision needed first: where meals are stored
| Option | Good | Bad |
|--------|------|-----|
| **1. Supabase, written from the app (recommended)** | Reuses the login and row-level security we already have; no new backend code; data already sits where Progress will read it | The backend can't see meals (fine until Coach needs them) |
| 2. Through the FastAPI backend | One place for all rules; backend can read meals for Coach | The backend must verify Supabase login tokens; more code now |

The rest of this plan assumes option 1. If we pick option 2, C.1 and C.2 change, the screens do not.

### C.1 Data model (`supabase/migrations/…_meals.sql`)
One table, `meals`:

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, primary key | default `gen_random_uuid()` |
| `user_id` | uuid → `auth.users` | on delete cascade |
| `eaten_at` | timestamptz | when it was logged |
| `eaten_on` | date | the person's **local** day, sent by the app, so "today" matches their clock and timezone |
| `slot` | text | `breakfast` / `lunch` / `dinner` / `snack` |
| `title` | text | what they searched, e.g. "caesar salad with boiled shrimp" |
| `kcal`, `protein_g`, `carbs_g`, `fat_g` | numeric | totals at the amounts they chose (stored, so a day's sum is one query) |
| `items` | jsonb | `[{name, grams, kcal, protein, carbs, fat}]`: the ingredients as logged |
| `created_at` | timestamptz | |

- Index on `(user_id, eaten_on)`.
- Row-level security: read / insert / update / delete **own rows only** (same pattern as `profiles`).
- Check constraints on slot and non-negative numbers.
- Why `items` is JSON and not a second table: nothing queries inside it yet; it is only shown back. If
  Progress later needs "most eaten foods", we can split it then.

### C.2 Pure logic, with tests (`frontend/src/lib/meals.ts`)
- `defaultSlot(date)`: morning → breakfast, midday → lunch, afternoon → snack, evening → dinner.
- `mealFromSummary(query, summary, slot, now)`: turns the dish screen's numbers into a row.
- `dayTotals(meals)`: kcal and macros eaten, share of target, kcal left, over-target flag.
- `localDate(now)`: `YYYY-MM-DD` in the person's timezone.
- Unit tests for all of it (edges: no meals, over target, midnight, empty items).

### C.3 "Log to {slot}" on the dish result
- The dish page learns whether the visitor is logged in (server-side, behind `<Suspense>` like `/home`).
- Guests: unchanged ("See how this fits your day" → Get started).
- Members: the bottom button becomes **Log to dinner** (slot picked from the time, changeable). It saves
  the meal with the **edited** amounts and **added** foods, then goes to Home.
- Guards: ignore a second tap while saving; clear error message if it fails; nothing is lost on failure.

### C.4 Home screen (`design/screens/Main.dc.html`)
Replaces the placeholder `/home`.
- Header (wordmark + profile avatar), greeting title, search bar.
- **Calorie card:** big "kcal left of target", gradient ring with the bowl in the middle, gradient bar,
  "910 eaten · 2 meals · 42 % of your day".
- **Three macro cards** (protein green, carbs bronze, fat terracotta) with progress bars.
- **Today's bites:** meals with mono times; delete a meal (with a confirm); dashed "NEXT" row → Coach.
- Edge states: no meals yet, no profile yet (asks to set it up), over target (terracotta bar).
- New components: `CalorieRing`, `MacroCard`, `MealRow`, `BottomNav`.

### C.5 Bottom nav
White floating bar: Home · Coach · (raised green **+**) · Progress · Profile. The "+" goes to a dish
search. Coach and Progress show a "coming soon" screen until phases E and F.

### C.6 Verification
- Unit tests (C.2).
- A browser run against the real Supabase project with a test user: log a meal from the dish page, see it
  on Home, delete it, check totals, check that **another user cannot see it** (row-level security), then
  delete the test data.
- Lint, production build, README and this file updated.

### C.7 Order of work (one commit each)
1. C.1 migration + C.2 logic and tests
2. C.3 Log button
3. C.4 Home + C.5 nav
4. C.6 verification and docs

### C.8 Out of scope for C (on purpose)
Editing a logged meal (delete and re-log instead), favorites, photos, notes, sharing.

### C.9 Decisions (answered)
1. Meals are stored in Supabase, written from the app.
2. Slots: breakfast / lunch / dinner / snack are enough (the nav and the log button use them; a snack sits between lunch and dinner).
3. "Today" ends at midnight (local).

---

## Phase D — Logged-in Bite check
`design/screens/Analyze.dc.html`: the same estimate as the guest page plus **"Where's it from?"** chips,
**"Tweak it"** chips (less oil, no egg, half rice…) that change the numbers, a favorite button, "Log to …".
- **Needs backend work first.** The backend has no notion of "restaurant vs home" or "less oil".
  Proposal: structured modifiers (e.g. oil ×0.5 on foods that carry an oil note, rice ×0.5) applied by
  deterministic code; no LLM involved. Needs a design decision per chip.
- Favorites: a small table in Supabase.
- Depends on phase C (the Log button already exists).

## Phase E — Progress
`design/screens/Progress.dc.html`: weekly calorie bars vs target (green on target, terracotta > 5 % over),
streak, weight trend, protein average, a "Buddy's note".
- Needs phase C data. Weight needs a weight log (new table + a way to enter it).
- "Buddy's note" must come from rules in code, not from an LLM writing numbers (core rule of the project).

## Phase F — Coach
`design/screens/Coach.dc.html`: "Room left today", suggestions (near me / 7-Eleven / cook at home), "Smart swap".
- Least defined: we have **no data source** for places or 7-Eleven products yet.
- Suggestions and their numbers must come from our food database and the person's remaining budget.
- Decide the data source before starting; may use the backend (and then the meals-via-FastAPI option).

---

## Backlog (no phase yet)
- **Sodium and fibre** in totals: the Thai table has no sodium; needs a "partial data" display, not silent gaps.
- **Friendlier match notes:** the "How we estimated this" list still shows technical wording.
- **Go-live for accounts:** turn "Confirm email" back on, set a real email sender, add the site URL in Supabase.
- **Responsive layouts:** today big screens show a fixed phone frame.
- **Thai names in the food table** are mostly unverified (see `backend/ROADMAP.md`); permission to publish the data.
- **Saving edits** made on the dish page for guests (today they vanish on reload).
- **Housekeeping:** delete the test user `munchy-test-1793713114@example.com` in Supabase (Authentication → Users).

## Decisions log
- Phase D: "where's it from" = fixed rules (restaurant +6% oil, home-cooked oil x0.7); tweak chips are built from the
  dish's real ingredients and only change amounts. No sodium anywhere (we cannot measure it).
- Phase E: last 7 days (rolling), weight kept one per day and smoothed (moving average); Buddy's note from rules.
- Custom dishes: one serving, calories required, macros optional, ingredients optional (they sum into the fields).
- Meals live in Supabase (table `meals`, row-level security); the backend never sees them. Revisit if Coach needs them.
- "Today" is the person's local day, so today's meals are loaded in the browser (the server cannot know the timezone).
- Hybrid pipeline: the LLM only parses or names parts of a dish; nutrition numbers come from our database + code.
- Accounts: Supabase (email + password); the estimation engine and food database stay in `backend/` (SQLite).
- Profile is saved from the sign-up metadata by a database trigger (works with or without email confirmation).
- Design: V2 "Forest & Bronze" (`design/DESIGN.md`); V1 kept in `design/v1/`.
- Daily target: Mifflin-St Jeor × activity, goal adjustment, never below resting needs or 1,200 kcal.
