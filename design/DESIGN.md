# Munchy — Design Spec (V2 · Forest & Bronze)

**Munchy — Your Bite Buddy.** A mobile-first web app (PWA) that estimates calories and
nutrients from a dish name, and coaches users toward personal daily targets.

The files in `screens/` are the **source of truth for layout, spacing, copy and colors**.
They are design-tool markup (`.dc.html`): plain HTML with inline styles, plus a small
template syntax (`{{value}}`, `<sc-for>`, `<sc-if>`) and a `class Component` block that
holds sample data. **Do not ship these files.** Rebuild each screen as real components,
using the tokens below and the sample data as fixtures.

Design frame: 390 × 844 (phone). The app must also work on wider screens (center a
max-width ~480px column on desktop).

The previous design (V1, olive/teal/orange) is kept in `design/v1/` for reference only — **build V2**.

---

## Design tokens

### Colors
| Token          | Hex       | Use |
|----------------|-----------|-----|
| `bg`           | `#F7F2EA` | App background (warm off-white), inner tiles |
| `surface`      | `#FFFFFF` | Cards, inputs, bottom nav |
| `sand`         | `#EFE6D6` | Progress tracks, avatar, secondary icon buttons |
| `ink`          | `#1E1C18` | Primary text |
| `ink-muted`    | `#6B6457` | Secondary text, inactive nav, small labels |
| `placeholder`  | `#8A8272` | Input placeholder & search icon |
| `green`        | `#1D5C3A` | **Primary**: logo, big numbers, buttons, selected chips, active nav, protein, italic heading accent |
| `green-dark`   | `#164A2E` | Hover / pressed |
| `green-tint`   | `#E6EFE8` | Protein / confidence badges |
| `bronze`       | `#8A5F1A` | Mono labels (eyebrows), carbs text |
| `bronze-light` | `#B7893A` | Carbs bar, gradient end |
| `bronze-tint`  | `#F3ECDF` | kcal / carbs badges |
| `terracotta`   | `#B5532F` | Fat bar, "over target" bars |
| `terracotta-text` | `#A5452A` | Fat numbers, "Smart swap" / warning labels |
| `terracotta-tint` | `#F6E4DC` | Fat badge |
| `border`       | `#E2D8C6` | Unselected chips, inputs |
| `divider`      | `#F0EADF` | List row dividers |
| `dash`         | `#C9B48A` | Dashed "next meal" row |

- **Signature gradient** (progress bars, calorie ring): `linear-gradient(90deg, #1D5C3A, #B7893A)`.
- Macro mapping (everywhere): **Protein = green, Carbs = bronze, Fat = terracotta**.
- Shadows: cards `0 6px 20px rgba(70,50,20,0.08)`; small cards/rows `0 4px 14px rgba(70,50,20,0.06)`; bottom nav `0 8px 24px rgba(70,50,20,0.14)`. No borders on cards.

### Typography — 4 roles
| Role | Font | Where | Style |
|------|------|-------|-------|
| **Brand / big number** | `Climate Crisis` 400 | ONLY the "Munchy" logo and big numbers (kcal left, dish kcal, daily target, weight, averages) | color `green`, line-height 1 |
| **Heading** | `Fraunces` 600 (+ italic 600) | Screen titles, section titles, card titles | `ink`; second half of a title in *italic* `green` (e.g. "What's on your plate, *and what's in it?*") |
| **Label / eyebrow** | `Space Mono` 400/700 | Small uppercase labels above things ("TODAY · SUN 1 NOV", "ESTIMATED", "TWEAK IT"), times, amounts, meta | 9–10px, uppercase, letter-spacing 1–1.5px, `bronze` or `ink-muted` |
| **Body / UI** | `Figtree` 400/500/600 + `Anuphan` fallback for Thai | Everything else: body, buttons, chips, list items | `font-family: 'Figtree', 'Anuphan', sans-serif` |

Do **not** use Climate Crisis for headings, buttons or labels.

Sizes: logo 28–30 · big number 30–46 · page title (Fraunces) 26–28 · card title 18–20 · body 13–15 · label 9–10 · nav 10.

Google Fonts URL:
`https://fonts.googleapis.com/css2?family=Climate+Crisis&family=Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,600&family=Space+Mono:wght@400;700&family=Figtree:wght@400;500;600&family=Anuphan:wght@400;500&display=swap`

### Shape & spacing
- Screen padding 20px; vertical gap between blocks 14–18px.
- Radius: hero cards 20 · cards 14–16 · inputs 12 (form) / 16 (search) · buttons 16–18 · small badges 6 · chips 999 (pill) · bottom nav 22.
- **Chips** (pill toggles): 34px visible height, padding 0 14px, 13px/500. Selected = `green` bg + `bg` text; unselected = white + `border`. Keep a ≥44px tap target via padding/hit area. Onboarding option buttons are 44px tall, radius 12.
- **Primary button**: 56px tall, `green`, radius 18, Figtree 600 15–16px.
- **Bottom nav**: floating **white** bar, 68px tall, 12px from sides, 16px from bottom, shadow; active item `green` + 600; inactive `ink-muted`; center "+" = 52px `green` circle, raised 26px, 4px `bg` border.
- Icons: 24px stroke icons (stroke 1.8–2, round caps) — Lucide fits.
- Asset: `assets/bowl.png` (ramen bowl illustration, hero / ring center). Mascot TBD.

---

## Screens

| File | Screen | Auth |
|------|--------|------|
| `Guest.dc.html` | **Guest home** — logo + "Log in" pill, bowl hero, Fraunces title, search bar, "TRY" chips, bottom "Unlock your Bite Buddy" card → Create free account | Public |
| `GuestDish.dc.html` | **Guest dish result** — same as Bite check; bottom CTA "See how this fits your day" → sign-up | Public |
| `Onboarding.dc.html` | **Onboarding / profile** — logo, title, goal (4), age/height/weight, typical day (3), live daily target + macro badges, "Let's munch", not-medical-advice note | Sign-up |
| `Main.dc.html` | **Home** — header, greeting title, search (+ camera), calorie card (big kcal left, gradient ring with bowl, gradient bar), 3 macro cards, "Today's bites" list with mono times, dashed "NEXT" row → Coach, bottom nav | Logged in |
| `Analyze.dc.html` | **Bite check** — back + eyebrow + dish title, "Where's it from?" chips, estimate card (big kcal, gradient bar = % of day, range, confidence badge, 4 macro tiles), "Tweak it" chips, ingredient breakdown with source note, favorite + "Log to dinner" | Logged in |
| `Coach.dc.html` | **Coach** — eyebrow + title, "Room left today" card, source chips (Near me / 7-Eleven / Cook at home), 3 suggestion cards with kcal/protein badges and + to log, "Smart swap" card | Logged in |
| `Progress.dc.html` | **Progress** — eyebrow + title, streak badge, weekly calorie bars vs dashed target line (green on target, terracotta >5% over, sand today), weight-trend + protein-avg cards, "Buddy's note" | Logged in |

### Access rules
- **Guests** can search any dish and see the full nutrition result (estimate, range, macros, follow-up question, tweaks, ingredient breakdown).
- **Accounts** unlock: personal daily target, meal logging, favorites, Coach, Progress.
- Any "log" / personal action from a guest → sign-up (Onboarding).

### Behavior notes (from the prototypes)
- Dish analysis: follow-up and tweak chips **recalculate kcal and macros live**. Range ≈ ±14% of the estimate. Show confidence (Low / Medium / High).
- Onboarding: target updates live when goal or activity changes. Production formula: Mifflin-St Jeor BMR × activity factor ± goal adjustment; protein by body weight.
- Weight shown as a smoothed trend. Always show the "Not medical advice" note on onboarding; never suggest extreme deficits.

---

## Suggested stack
- Frontend: Next.js (App Router) + Tailwind CSS, installable PWA. Map the tokens above into `tailwind.config` (colors, fontFamily: `brand`, `heading`, `mono`, `sans`; borderRadius; boxShadow).
- Backend: FastAPI (Python) for the dish-estimation pipeline.
- DB / auth: Supabase (Postgres + Auth), pgvector for dish-name matching.
