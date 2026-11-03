# Munchy — Design Spec (for implementation)

**Munchy — Your Bite Buddy.** A mobile-first web app (PWA) that estimates calories and
nutrients from a dish name, and coaches users toward personal daily targets.

The files in `screens/` are the **source of truth for layout, spacing, copy and colors**.
They are design-tool markup (`.dc.html`): plain HTML with inline styles, plus a small
template syntax (`{{value}}`, `<sc-for>`, `<sc-if>`) and a `class Component` block that
holds sample data. **Do not ship these files.** Rebuild each screen as real components,
using the tokens below and the sample data as fixtures.

Design frame: 390 × 844 (phone). The app must also work on wider screens (center a
max-width ~480px column on desktop).

---

## Design tokens

### Colors
| Token            | Hex       | Use |
|------------------|-----------|-----|
| `cream`          | `#F2F3D3` | App background, inner tiles |
| `olive`          | `#BCBE7B` | Hero cards (calorie summary, dish result, daily target) |
| `olive-logo`     | `#8E9045` | "Munchy" wordmark |
| `ink`            | `#2F3212` | Primary text |
| `ink-strong`     | `#1F2209` | Big numbers on olive |
| `ink-muted`      | `#5E6128` | Secondary text, labels |
| `teal`           | `#0E4A43` | Primary buttons, nav bar, selected chips, protein |
| `orange`         | `#E05A1C` | Accent / log (+) button, calorie ring, fat, "over target" |
| `yolk`           | `#F5B41C` | Active nav item, carbs, "today" |
| `white`          | `#FFFFFF` | Cards, inputs |
| `border`         | `#DADBAE` | Unselected chip / input border |
| `track`          | `#E6E7C2` | Progress bar & ring tracks |
| `swap-bg`        | `#FCE6B0` | "Smart swap" card |
| `nav-inactive`   | `#DCDDB4` | Inactive nav items on teal |

Macro color mapping (keep consistent everywhere): **Protein = teal, Carbs = yolk, Fat = orange**.

### Typography
- **Display / titles / big numbers:** `Climate Crisis` (Google Fonts), weight 400.
  Sizes used: 44 (dish kcal), 40 (kcal left), 30–36 (wordmark), 20–24 (screen titles), 15–16 (section titles).
- **Body:** `Figtree` 400/500/600, with `Anuphan` as fallback for Thai glyphs:
  `font-family: 'Figtree', 'Anuphan', sans-serif;`
  Sizes: 15 (inputs, list titles), 13–14 (body), 12 (labels), 10–11 (meta, nav labels).
- Google Fonts URL:
  `https://fonts.googleapis.com/css2?family=Climate+Crisis&family=Figtree:wght@400;500;600&family=Anuphan:wght@400;500&display=swap`

### Shape & spacing
- Screen padding: 20px sides. Vertical gap between blocks: 14–18px.
- Radius: hero cards 20, cards 16, list rows 14–16, inputs 16 (search) / 12 (form), buttons 18, chips 999 (pill), nav bar 22.
- Chips (pill toggles): **34px visible height**, padding 0 14px, 13px text. Selected = teal bg + cream text; unselected = white bg + `border`. Keep a ≥44px tap target via padding/hit area.
- Primary button: 56px tall, teal, radius 18.
- Bottom nav: floating teal bar, 68px tall, 12px from sides, 16px from bottom; center orange "+" button (52px circle, raised, 4px cream border).
- Icons: simple 24px stroke icons (stroke 1.8–2, round caps). Any icon set like Lucide fits.
- Asset: `assets/bowl.png` — ramen bowl illustration used as hero / ring center.

---

## Screens

| File | Screen | Auth |
|------|--------|------|
| `Guest.dc.html` | **Guest home** — logo + "Log in", bowl hero, "What's on your plate?", search bar, "Try:" chips, "Unlock your Bite Buddy" card → Create account | Public |
| `GuestDish.dc.html` | **Guest dish result** — same as Bite check, but bottom CTA is "See how this fits your day" → sign up | Public |
| `Onboarding.dc.html` | **Onboarding / profile** — goal (4 options), age/height/weight, activity (3 options), live daily target + macros, "Let's munch" | Sign-up |
| `Main.dc.html` | **Home** — header, search (+ camera button), calorie card (kcal left, ring, macro bars), "Today's bites" list, "Dinner — need ideas?" → Coach, bottom nav | Logged in |
| `Analyze.dc.html` | **Bite check (dish analysis)** — dish echo, follow-up question chips (Street stall / Restaurant / Home-cooked), kcal estimate + range + confidence, 4 macro tiles, "Tweak it" modifier chips, ingredient breakdown, favorite + "Log to lunch" | Logged in |
| `Coach.dc.html` | **Coach** — remaining budget card, source tabs (Near me / 7-Eleven / Cook at home), 3 suggestion cards with + to log, Smart swap card, coach chat bubble | Logged in |
| `Progress.dc.html` | **Progress** — streak pill, weekly calories bar chart vs target line (on/over/today colors), weight trend card, "Buddy's notes" insights | Logged in |

### Access rules
- **Guests** (not logged in) can search any dish and see the full nutrition result
  (estimate, range, macros, follow-up question, tweaks, ingredient breakdown).
- **Accounts** unlock: personal daily target, meal logging, favorites, Coach, Progress.
- Any "log" / personal action from a guest → route to sign-up (Onboarding).

### Behavior notes (from the prototypes)
- Dish analysis: the follow-up chip and modifier chips **recalculate kcal and macros live**.
  Range shown is roughly ±14% of the estimate. Show a confidence label (Low / Medium / High).
- Onboarding: target updates live when goal or activity changes. Formula in production:
  Mifflin-St Jeor BMR × activity factor, ± goal adjustment; protein by body weight.
- Progress: bars colored teal (on target), orange (>5% over), yellow (today). Weight is shown as a smoothed trend.
- Always show the "Not medical advice" note on onboarding; never suggest extreme deficits.

---

## Suggested stack
- Frontend: Next.js (App Router) + Tailwind CSS, installable PWA. Map the tokens above into `tailwind.config` (colors, fontFamily, borderRadius).
- Backend: FastAPI (Python) for the dish-estimation pipeline.
- DB / auth: Supabase (Postgres + Auth), pgvector for dish-name matching.
