# Munchy frontend

Next.js (App Router) + Tailwind v4. The UI follows `../design/DESIGN.md`; the `.dc.html` files in
`../design/screens/` are the visual reference (rebuilt as components, never shipped).

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
- `src/app/globals.css` – design tokens (colors, radii, font families) as Tailwind `@theme` variables
- `src/app/layout.tsx` – fonts via `next/font` (Climate Crisis, Figtree, Anuphan with Thai)
- `src/app/page.tsx` – Guest home (`/`)
- `src/app/dish/page.tsx` – Guest dish result (`/dish?q=...`): asks the backend, shows loading / error / empty states
- `src/lib/estimate.ts` – `POST /estimate` client (run on the server, so no CORS needed) and the mapping to what the screen shows
- `src/components/` – `DishResult`, `AmountEditor`, `IngredientSearch`, `DishStates`, `DishHeader`, `Chip`, icons
- `src/app/api/foods/route.ts` + `src/lib/foods.ts` – ingredient search proxy and client
- `src/app/onboarding/` – placeholder until the Onboarding screen is built

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
range of about ±14%, protein / carbs / fat, total weight, the ingredient list, every warning, and the
assumptions behind a "How we estimated this" fold. Confidence is derived from what the backend had to
guess: **Low** if part of the input could not be matched, **Medium** if there were uncertain matches or
assumed amounts, **High** if neither.

## Not built yet
- The design's place chips (Street stall / Restaurant / Home-cooked) and tweak chips (Less oil, …) are
  left out: the backend cannot answer them yet.
- Sodium: the database has none, so the fourth tile shows total weight instead.
