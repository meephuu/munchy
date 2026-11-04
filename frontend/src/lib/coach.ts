// The Coach screen: what to eat with the room left today. Plain rules over a catalog of dishes whose numbers
// come from our own estimator (backend/build_catalog.py): no language model, no invented figures, and no
// places (we have no restaurant or shop data), so suggestions are dishes to cook or order, not "near me".

import { favoriteKey } from "./custom";
import type { TargetLike } from "./meals";

export type CatalogDish = { title: string; kcal: number; protein: number; carbs: number; fat: number };

export type CoachTab = "fit" | "protein" | "light";

export const COACH_TABS: { id: CoachTab; label: string }[] = [
  { id: "fit", label: "Best fit" },
  { id: "protein", label: "High protein" },
  { id: "light", label: "Lighter" },
];

/** What is left of today: calories and protein (never negative), from the totals eaten so far. */
export function roomLeft(target: TargetLike, eaten: { kcal: number; protein: number }) {
  return {
    kcal: Math.round(target.kcal - eaten.kcal),
    protein: Math.max(0, Math.round(target.proteinG - eaten.protein)),
  };
}

const MAX_MEAL_KCAL = 750; // a meal this size is the most we aim a suggestion at, however much room is left
const LIGHT_FLOOR = 150; // "lighter" ideas are still a proper bite, not a garnish

/** Up to `limit` dishes that fit the calories left, for one tab. Dishes eaten today are left out. */
export function ideasFor(
  catalog: CatalogDish[],
  left: { kcal: number },
  eatenTitles: string[],
  tab: CoachTab,
  limit = 3,
): CatalogDish[] {
  if (left.kcal <= 0) return [];
  const eaten = new Set(eatenTitles.map(favoriteKey));
  const fits = catalog.filter((d) => d.kcal <= left.kcal && !eaten.has(favoriteKey(d.title)));
  const aim = Math.min(left.kcal, MAX_MEAL_KCAL) * 0.85;
  const sorted = {
    // closest to a good meal size for the room left, then more protein
    fit: [...fits].sort((a, b) => Math.abs(a.kcal - aim) - Math.abs(b.kcal - aim) || b.protein - a.protein),
    // most protein for the calories
    protein: [...fits].sort((a, b) => b.protein / b.kcal - a.protein / a.kcal),
    // least calories (above a floor)
    light: fits.filter((d) => d.kcal >= LIGHT_FLOOR).sort((a, b) => a.kcal - b.kcal),
  }[tab];
  return sorted.slice(0, limit);
}
