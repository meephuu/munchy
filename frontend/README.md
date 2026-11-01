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
- `src/components/` – `DishResult`, `DishStates`, `DishHeader`, `Chip`, icons
- `src/app/onboarding/` – placeholder until the Onboarding screen is built

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
