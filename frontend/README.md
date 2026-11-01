# Munchy frontend

Next.js (App Router) + Tailwind v4. The UI follows `../design/DESIGN.md`; the `.dc.html` files in
`../design/screens/` are the visual reference (rebuilt as components, never shipped).

```powershell
cd frontend
npm install
npm run dev        # http://localhost:3000
npm run build      # production build + type check
npm run lint
```

## Where things are
- `src/app/globals.css` – design tokens (colors, radii, font families) as Tailwind `@theme` variables
- `src/app/layout.tsx` – fonts via `next/font` (Climate Crisis, Figtree, Anuphan with Thai)
- `src/app/page.tsx` – Guest home (`/`)
- `src/app/dish/page.tsx` + `src/components/DishResult.tsx` – Guest dish result (`/dish?q=...`)
- `src/lib/dish.ts` – dish data and the live recalculation for the place / tweak chips
- `src/app/onboarding/` – placeholder until the Onboarding screen is built

## Status
The dish result shows the design's sample dish (pad kra pao) whatever you search for; it is not
connected to the backend's `POST /estimate` yet.
