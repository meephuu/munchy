// A person's own dish: a name and the nutrition for one serving, typed in by hand or added up from
// ingredients they pick (optional). Saved in `custom_dishes` so it can be logged again later.
// Pure: parsing the form and building rows; the screens do the saving.

import type { Ingredient } from "./estimate";
import { localDate, type MealInsert, type MealItem, type MealSlot } from "./meals";

export type CustomForm = { name: string; kcal: string; protein: string; carbs: string; fat: string };

export const EMPTY_FORM: CustomForm = { name: "", kcal: "", protein: "", carbs: "", fat: "" };

export type CustomDishInsert = {
  title: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  items: MealItem[];
};

export type CustomDish = {
  id: string;
  title: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  items: MealItem[];
};

// Matches the table's checks (supabase/migrations/20261105000000_favorites_weights_dishes.sql).
const MAX = { kcal: 20000, protein: 2000, carbs: 5000, fat: 2000 };

const num = (text: string): number | null => {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Ingredients with their amounts, as the items stored with the dish. */
export function itemsOf(ingredients: Ingredient[], grams: number[]): MealItem[] {
  return ingredients
    .map((ing, i) => {
      const g = grams[i] ?? ing.grams;
      const k = g / 100;
      return {
        name: ing.name,
        grams: round1(g),
        kcal: Math.round(ing.per100.kcal * k),
        protein: round1(ing.per100.protein * k),
        carbs: round1(ing.per100.carbs * k),
        fat: round1(ing.per100.fat * k),
      };
    })
    .filter((it) => it.grams > 0);
}

/** What the ingredients add up to, as the form's text fields (so they can be fixed by hand afterwards). */
export function totalsOf(items: MealItem[]): Pick<CustomForm, "kcal" | "protein" | "carbs" | "fat"> {
  const sum = (f: (i: MealItem) => number) => String(Math.round(items.reduce((s, i) => s + f(i), 0) * 10) / 10);
  return { kcal: sum((i) => i.kcal), protein: sum((i) => i.protein), carbs: sum((i) => i.carbs), fat: sum((i) => i.fat) };
}

/** The row to save, or the message to show. Calories are required; the macros may be left empty (counted as 0). */
export function parseCustom(form: CustomForm, items: MealItem[]): { ok: true; value: CustomDishInsert } | { ok: false; error: string } {
  const name = form.name.trim();
  if (!name) return { ok: false, error: "Give your dish a name." };
  if (name.length > 200) return { ok: false, error: "That name is too long." };
  const kcal = num(form.kcal);
  if (kcal === null) return { ok: false, error: "Enter the calories (kcal) for one serving." };
  const fields = [
    ["Calories", kcal, MAX.kcal],
    ["Protein", num(form.protein) ?? 0, MAX.protein],
    ["Carbs", num(form.carbs) ?? 0, MAX.carbs],
    ["Fat", num(form.fat) ?? 0, MAX.fat],
  ] as const;
  for (const [label, v, max] of fields) {
    if (v < 0 || v > max) return { ok: false, error: `${label} must be between 0 and ${max}.` };
  }
  for (const key of ["protein", "carbs", "fat"] as const) {
    if (form[key].trim() !== "" && num(form[key]) === null) return { ok: false, error: "Nutrition values must be numbers." };
  }
  return {
    ok: true,
    value: {
      title: name,
      kcal: round1(kcal),
      protein_g: round1(num(form.protein) ?? 0),
      carbs_g: round1(num(form.carbs) ?? 0),
      fat_g: round1(num(form.fat) ?? 0),
      items,
    },
  };
}

/** A saved dish eaten now, as a meal row. */
export function dishToMeal(d: Pick<CustomDish, "title" | "kcal" | "protein" | "carbs" | "fat" | "items">, slot: MealSlot, now: Date): MealInsert {
  return {
    eaten_at: now.toISOString(),
    eaten_on: localDate(now),
    slot,
    title: d.title,
    kcal: d.kcal,
    protein_g: d.protein,
    carbs_g: d.carbs,
    fat_g: d.fat,
    items: d.items,
  };
}

/** A custom_dishes row (numerics may arrive as strings), or null if it is off. */
export function dishFromRow(row: unknown): CustomDish | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  const nums = [r.kcal, r.protein_g, r.carbs_g, r.fat_g].map(Number);
  if (typeof r.id !== "string" || typeof r.title !== "string" || nums.some((n) => !Number.isFinite(n))) return null;
  const items = Array.isArray(r.items)
    ? r.items.filter((i): i is MealItem => typeof i === "object" && i !== null && typeof (i as MealItem).name === "string")
    : [];
  const [kcal, protein, carbs, fat] = nums;
  return { id: r.id, title: r.title, kcal, protein, carbs, fat, items };
}

/** The key a favorite is stored under: the same dish typed in different case or spacing is one favorite. */
export const favoriteKey = (title: string) => title.trim().replace(/\s+/g, " ").toLowerCase();
