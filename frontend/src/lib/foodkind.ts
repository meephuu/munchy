// The four kinds of food the dot in the ingredient list tells apart. The kind is worked out from the food's own
// nutrients per 100 g (how its calories split between protein, carbs and fat, and how dense they are), so it also works
// for foods the AI found and foods the person added, with no extra data in the food table.

import type { Macros } from "./estimate";

export type FoodKindId = "protein" | "carbs" | "fat" | "fresh";

export const FOOD_KINDS: { id: FoodKindId; label: string; hint: string; color: string }[] = [
  { id: "protein", label: "Protein", hint: "meat, fish, egg, tofu, beans", color: "var(--color-green)" },
  { id: "carbs", label: "Carbs", hint: "rice, noodles, bread, sugar", color: "var(--color-bronze-light)" },
  { id: "fat", label: "Fat", hint: "oil, butter, nuts, coconut", color: "var(--color-terracotta)" },
  { id: "fresh", label: "Veg, fruit & drinks", hint: "light foods, under 70 kcal per 100 g", color: "var(--color-leaf)" },
];

const LIGHT_KCAL = 70; // per 100 g and below: vegetables, most fruit, broth, milk, sauces
const PROTEIN_SHARE = 0.3; // of the calories (and at least PROTEIN_MIN_G per 100 g, so a leafy green is not "protein")
const PROTEIN_MIN_G = 7;
const FAT_SHARE = 0.5;

/** The kind of a food from its nutrients per 100 g.
 *  Protein first (a real source: at least 30% of its calories and 7 g per 100 g), then light foods, then fat (half or
 *  more of its calories), and carbs for the rest (rice, noodles, bread, sugar, a starchy dish). */
export function foodKind(per100: Macros): FoodKindId {
  const { kcal, protein, fat } = per100;
  if (kcal <= 0) return "fresh";
  if (protein >= PROTEIN_MIN_G && (protein * 4) / kcal >= PROTEIN_SHARE) return "protein";
  if (kcal <= LIGHT_KCAL) return "fresh";
  if ((fat * 9) / kcal >= FAT_SHARE) return "fat";
  return "carbs";
}

/** The dot colour (a CSS value) for a food. */
export function dotOf(per100: Macros): string {
  const id = foodKind(per100);
  return FOOD_KINDS.find((k) => k.id === id)!.color;
}
