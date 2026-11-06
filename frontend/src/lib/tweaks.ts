// "Where's it from?" and "Tweak it" on the Bite check. Plain rules in code, never an LLM:
// a tweak multiplies the amount of the ingredients it applies to (less oil = oil x0.5), and the place
// is one fixed assumption. Both only change amounts, so the totals stay arithmetic on the database's
// per-100 g values and stay explainable.

import type { Ingredient, Macros } from "./estimate";
import { dotOf } from "./foodkind";

export type Place = "stall" | "restaurant" | "home";

export const PLACES: { id: Place; label: string }[] = [
  { id: "stall", label: "Street stall" },
  { id: "restaurant", label: "Restaurant" },
  { id: "home", label: "Home-cooked" },
];

// Restaurants cook with more oil and seasoning; home cooks use less.
const RESTAURANT_EXTRA = 0.06; // extra oil worth this share of the dish's calories
const HOME_OIL_FACTOR = 0.7;

export type TweakId = "oil" | "egg" | "carb" | "protein";

type TweakDef = { id: TweakId; pattern: RegExp; factor: number; label: (found: string) => string; note: string };

const OIL = /\b(oil|butter|lard|ghee|margarine|shortening|mayonnaise)\b/i;
const EGG = /\begg/i;
const CARB = /\b(rice|noodles?|pasta|spaghetti|bread|vermicelli)\b/i;
const PROTEIN = /\b(pork|chicken|beef|shrimp|prawn|fish|tofu|duck|squid|bacon|ham|sausage)\b/i;

// The last match names the food best ("Rice noodles" is noodles, "Pork, minced" is pork).
const word = (name: string, pattern: RegExp) => {
  const all = [...name.matchAll(new RegExp(pattern.source, "gi"))];
  return all.at(-1)?.[1]?.toLowerCase() ?? "";
};

const TWEAKS: TweakDef[] = [
  { id: "oil", pattern: OIL, factor: 0.5, label: () => "Less oil", note: "Less oil: oil and fat ingredients halved" },
  { id: "egg", pattern: EGG, factor: 0, label: () => "No egg", note: "No egg: egg left out" },
  {
    id: "carb",
    pattern: CARB,
    factor: 0.5,
    label: (f) => `Half ${f === "noodle" ? "noodles" : f}`,
    note: "Half the rice, noodles or pasta",
  },
  {
    id: "protein",
    pattern: PROTEIN,
    factor: 1.5,
    label: (f) => `Extra ${f}`,
    note: "Extra protein: the meat or fish amount x1.5",
  },
];

/** A tweak that applies to this dish. */
export type Tweak = { id: TweakId; label: string; note: string };

/** Egg and oil lines are their own tweaks, so "extra protein" does not also scale them. */
const matches = (def: TweakDef, name: string) =>
  def.pattern.test(name) && !(def.id === "protein" && (EGG.test(name) || OIL.test(name)));

/** Only the tweaks the dish has something to change for (no "No egg" on a dish without egg). */
export function availableTweaks(names: string[]): Tweak[] {
  const out: Tweak[] = [];
  for (const def of TWEAKS) {
    const found = names.find((n) => matches(def, n));
    if (found) out.push({ id: def.id, label: def.label(word(found, def.pattern)), note: def.note });
  }
  return out;
}

/** The factor for each ingredient: tweaks switched on, times the place's effect on oil. */
export function multipliers(names: string[], place: Place, active: TweakId[]): number[] {
  return names.map((name) => {
    let m = 1;
    for (const def of TWEAKS) if (active.includes(def.id) && matches(def, name)) m *= def.factor;
    if (place === "home" && OIL.test(name)) m *= HOME_OIL_FACTOR;
    return m;
  });
}

const OIL_KCAL_PER_100G = 884;

/** The extra oil a restaurant adds, as a food line worth ~6% of the dish's calories; null elsewhere. */
export function placeExtra(place: Place, kcal: number): Ingredient | null {
  if (place !== "restaurant" || kcal <= 0) return null;
  const per100: Macros = { kcal: OIL_KCAL_PER_100G, protein: 0, carbs: 0, fat: 100 };
  return {
    name: "Extra oil & seasoning (restaurant)",
    grams: Math.round(((kcal * RESTAURANT_EXTRA) / OIL_KCAL_PER_100G) * 1000) / 10,
    per100,
    units: [],
    dot: dotOf(per100),
  };
}

/** Notes for "How we estimated this". */
export function adjustmentNotes(place: Place, active: TweakId[], available: Tweak[]): string[] {
  const notes = available.filter((t) => active.includes(t.id)).map((t) => `Tweak · ${t.note}`);
  if (place === "restaurant") notes.push("Restaurant: about 6% extra calories from oil and seasoning (an assumption).");
  if (place === "home") notes.push("Home-cooked: oil and fat ingredients reduced by 30% (an assumption).");
  return notes;
}
