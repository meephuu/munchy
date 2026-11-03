import { afterEach, describe, expect, it, vi } from "vitest";
import { summarize, toDish, type EstimateResponse } from "./estimate";
import { searchFoods, toIngredient, type FoodHit } from "./foods";

const egg: FoodHit = {
  id: 7,
  name: "boiled egg",
  per_100g: { kcal: 155, protein_g: 12.6, fat_g: 10.6, carbs_g: 1.1 },
  default_serving_g: 50,
  units: [{ label: "egg", grams: 50 }],
};

const response: EstimateResponse = {
  input: "x",
  totals: { kcal: 230, protein_g: 4.2, fat_g: 0.5, carbs_g: 51.8 },
  lines: [{ name: "rice", grams: 100, kcal: 230, per_100g: { kcal: 230, protein_g: 4.2, fat_g: 0.5, carbs_g: 51.8 }, units: [] }],
  assumptions: [],
  warnings: [],
  unmatched: [],
  complete: true,
};

describe("toIngredient", () => {
  it("starts from the food's typical serving and is marked as added", () => {
    const ing = toIngredient(egg, 3);
    expect(ing).toMatchObject({
      name: "boiled egg",
      grams: 50,
      added: true,
      units: [{ label: "egg", grams: 50 }],
      per100: { kcal: 155, protein: 12.6, fat: 10.6, carbs: 1.1 },
    });
    expect(ing.dot).toMatch(/^var\(--color-/);
  });
});

describe("a meal with an added food", () => {
  const dish = toDish(response);
  const withEgg = { ...dish, ingredients: [...dish.ingredients, toIngredient(egg, 1)] };

  it("adds the food's nutrients at its serving to the totals", () => {
    const s = summarize(withEgg, [100, 50]);
    expect(s.kcal).toBe(Math.round(230 + 155 * 0.5));
    expect(s.weight).toBe(150);
    expect(s.rows[1]).toMatchObject({ name: "boiled egg", grams: 50, kcal: 78, added: true, edited: false });
  });

  it("counts the meal as edited as soon as a food is added, even at its serving", () => {
    expect(summarize(dish, [100]).edited).toBe(false);
    expect(summarize(withEgg, [100, 50]).edited).toBe(true);
  });

  it("lets the added food's amount change like any other", () => {
    expect(summarize(withEgg, [100, 100]).kcal).toBe(Math.round(230 + 155));
  });
});

describe("searchFoods", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks our own /api/foods route with the query encoded", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([egg]))));
    expect(await searchFoods("fried egg & rice")).toEqual([egg]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/foods?q=fried%20egg%20%26%20rice");
  });

  it("throws when the route fails so the UI can say so", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 502 })));
    await expect(searchFoods("egg")).rejects.toThrow();
  });
});
