import type { Ingredient } from "@/lib/estimate";
import { dotOf } from "@/lib/foodkind";
import type { UnitOption } from "@/lib/units";

/** One suggestion from GET /foods/search (FoodOut in backend/src/api.py). */
export type FoodHit = {
  id: number;
  name: string;
  per_100g: { kcal: number; protein_g: number; fat_g: number; carbs_g: number };
  default_serving_g: number;
  units: UnitOption[];
};

/** Search the food database through our own /api/foods route. Throws if the search fails. */
export async function searchFoods(q: string, signal?: AbortSignal): Promise<FoodHit[]> {
  const res = await fetch(`/api/foods?q=${encodeURIComponent(q)}`, { signal });
  if (!res.ok) throw new Error("food search failed");
  return (await res.json()) as FoodHit[];
}

/** A search hit as an ingredient of the meal, starting from the food's typical serving. */
export function toIngredient(hit: FoodHit): Ingredient {
  const per100 = {
    kcal: hit.per_100g.kcal,
    protein: hit.per_100g.protein_g,
    carbs: hit.per_100g.carbs_g,
    fat: hit.per_100g.fat_g,
  };
  return {
    name: hit.name,
    grams: hit.default_serving_g,
    per100,
    units: hit.units,
    dot: dotOf(per100),
    added: true,
  };
}
