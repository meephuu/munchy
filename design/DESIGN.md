# Munchy — Design Spec (V2 · Forest & Bronze)

**Munchy — Your Bite Buddy.** A mobile-first web app (PWA) that estimates calories and
nutrients from a dish name, and coaches users toward personal daily targets.

The files in `screens/` are the **source of truth for layout, spacing, copy and colors**.
They are design-tool markup (`.dc.html`): plain HTML with inline styles, plus a small
template syntax (`{{value}}`, `<sc-for>`, `<sc-if>`) and a `class Component` block that
holds sample data. **Do not ship these files.** Rebuild each screen as real components,
using the tokens below and the sample data as fixtures.

Design frame: 390 × 844 (phone). From 1024 px wide the app uses the desktop layout in
"Desktop layout (V3)" below (`screens/desktop/`).

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

## Desktop layout (V3)

The phone screens above stay as they are. From **1024 px wide** the app switches to a desktop
layout. It drops the phone frame from `globals.css` (the dark page with a 390 × 844 phone in the
middle) and uses the full window. Between 600 and 1023 px, keep today's behavior.

`screens/desktop/*.dc.html` are the visual reference, drawn at 1440 px wide. As with the phone
screens, they are design-tool markup: rebuild them as real components and **do not ship them**.
Same tokens, fonts, copy and data as mobile. Desktop only rearranges content, it adds no new
features. Sample numbers in the files are fixtures; text in [brackets] is placeholder wording.

### Two shells

**Logged-in shell** (Home, Bite check, Log a dish, Coach, Progress, Me):
- A **sidebar** replaces the bottom nav: 240 px wide, a white panel (radius 22, card shadow) with
  20 px margin from the window edge, sticky so it stays put while the main column scrolls.
  Top to bottom:
  - the logo (`logo/logo-text.png`, 26 px tall) with "YOUR BITE BUDDY" under it
  - a green **"+ Log a dish"** button (48 px, radius 14), standing in for the raised "+" on mobile
  - nav items Home, Coach, Progress, Me (44 px rows, radius 12; active = `green-tint` background,
    `green` text, 600)
  - pinned to the bottom: a small "Daily target" tile (big number in Climate Crisis 24) and the
    account row (avatar + email)
- **Main column**: padding 36 px top, 40 px sides; content `max-width: 1120px`, centered; 24 px
  gap between blocks.
- Hide `BottomNav` at ≥ 1024 px and show the sidebar instead.

**Guest shell** (Guest home, Guest dish result, Get started, Log in):
- A **top bar** (max-width 1240, padding 24/40) with the logo + tagline on the left and actions on
  the right ("Log in" outline pill, "Create free account" green pill; the guest dish page also puts
  a compact dish search there).
- Main content max-width 1240, padding 40 px sides.
- Log in is the exception: a split screen, a green brand panel on the left (cream logo
  `logo/logo-text-cream.png`, a short pitch, the bowl) and the form (max-width 420) centered on the
  right.

### Columns
Use flex-wrap rows so each page folds back to one column on narrow windows without extra
breakpoints: main column `flex: 2 1 560px`, side column `flex: 1 1 300px`, `min-width: 0` on both,
`gap: 24px`. Card grids use `repeat(auto-fit / auto-fill, minmax(…, 1fr))`.

### Type scale on desktop
| Role | Mobile | Desktop |
|------|--------|---------|
| Page title (Fraunces) | 26–28 | 32–40 (guest hero 56) |
| Big number (Climate Crisis) | 30–46 | 56–64 (stat tiles 40) |
| Card title | 18–20 | 20–22 |
| Body | 13–15 | 14–16 |
| Labels / eyebrows | 9–10 | 10–11 |
Cards get more room: padding 22–28 px, radius stays 20.

### Screens
| File | Layout |
|------|--------|
| `desktop/Home.dc.html` | Greeting (left) + search bar (right) on one row. Main column: calorie card (64 px number, gradient bar, 168 px ring with bowl, the 3 macros inside the card), then "Today's bites" with P/C/F per meal and the dashed NEXT row. Side column: Coach preview (3 dishes that fit, + buttons, "All ideas"), Favorites chips, "This week" mini bar chart with the streak badge (links to Progress). |
| `desktop/BiteCheck.dc.html` | Header: back button, eyebrow, dish title (32), heart + "Saved" on the right. Left column: estimate card (64 px kcal, range, confidence, bowl, 2 × 2 macro tiles) and the **log panel** (Log as chips, time picker, "Log to dinner · 640 kcal"). Right column: "Where's it from?" and "Tweak it" in one card; ingredients as a **table** (dot, name, macros, amount with edit icon, kcal) with column headings and "Add an ingredient"; "How we estimated this" open by default. |
| `desktop/Add.dc.html` | Hero card: title (40), large search (64 px, "Check it" button) with suggestions open below, bowl on the right. Then My favorites + the "New dish" form (left) beside My dishes with Log-as chips and the list (right). |
| `desktop/Coach.dc.html` | Left: "Room left today" (56 px) with protein/carbs/fat left as bars, and "Eaten so far". Right: Best fit / High protein / Lighter tabs over a **grid of dish cards** (kcal in Climate Crisis, a bar showing the share of today's room it uses, P/C/F badges, "Leaves ~N kcal", + button). |
| `desktop/Progress.dc.html` | Title + streak badge on one row. Large chart card: 270 px tall, kcal printed above each bar, labelled dashed target line ("TARGET 2,150"), day names (today = "Today"). Side column: Weight trend (with the weigh-in field) and Protein avg as stat tiles. Buddy's note full width with the bowl. |
| `desktop/Account.dc.html` | Profile card (avatar 72, email, member since, Log out) beside the green target card (64 px number, macros, bowl). Below: "About you" as a 2–3 column grid with "Edit profile", and the shortcuts card. |
| `desktop/Guest.dc.html` | Hero: left = eyebrow, title (56, accent on its own line), intro, large search, Try chips; right = bowl on a sand circle with a floating sample estimate card. Then the "Unlock your Bite Buddy" card with 3 feature tiles (Daily target, Meal log & progress, Coach ideas) and the CTA. |
| `desktop/GuestDish.dc.html` | Same as BiteCheck under the guest top bar. The log panel is replaced by a green sign-up card ("See how this fits your day" → Create free account). No heart. |
| `desktop/Onboarding.dc.html` | Title across the top. Left: the form in one card (goal 4 across, sex 3 across, date of birth, height + weight, typical day 3 across; option buttons 48 px). Right: a green panel with the live daily target (64 px), macro badges, a one-line "how we work it out", "Let's munch" (cream button) and the not-medical-advice note. |
| `desktop/Login.dc.html` | Split screen as described above. |

### Behavior on desktop
- Rows, cards and dish ideas get a hover state (slightly darker shadow or `green-tint` background);
  keep the 44 px minimum hit size even though there is a mouse.
- The search suggestions panel, time picker and amount editor work the same as on mobile.
- The Bite check log panel and the Get started target panel may be `position: sticky` in the real app
  so the action stays visible while the right column scrolls (the design files draw them static).

---

## Suggested stack
- Frontend: Next.js (App Router) + Tailwind CSS, installable PWA. Map the tokens above into `tailwind.config` (colors, fontFamily: `brand`, `heading`, `mono`, `sans`; borderRadius; boxShadow).
- Backend: FastAPI (Python) for the dish-estimation pipeline.
- DB / auth: Supabase (Postgres + Auth), pgvector for dish-name matching.
