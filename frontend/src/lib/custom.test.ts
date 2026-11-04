import { describe, expect, it } from "vitest";
import type { Ingredient } from "./estimate";
import { dishFromRow, dishToMeal, EMPTY_FORM, favoriteKey, itemsOf, parseCustom, totalsOf } from "./custom";

const form = (o: Partial<typeof EMPTY_FORM>) => ({ ...EMPTY_FORM, ...o });
const ing = (name: string, kcal: number, protein: number): Ingredient => ({
  name,
  grams: 100,
  per100: { kcal, protein, carbs: 10, fat: 5 },
  units: [],
  dot: "x",
});

describe("parseCustom", () => {
  it("needs a name and calories", () => {
    expect(parseCustom(form({ kcal: "300" }), []).ok).toBe(false);
    expect(parseCustom(form({ name: "Curry" }), []).ok).toBe(false);
  });
  it("takes calories only: macros count as 0", () => {
    const r = parseCustom(form({ name: " Curry ", kcal: "450" }), []);
    expect(r).toEqual({ ok: true, value: { title: "Curry", kcal: 450, protein_g: 0, carbs_g: 0, fat_g: 0, items: [] } });
  });
  it("accepts commas and rounds to one decimal", () => {
    const r = parseCustom(form({ name: "x", kcal: "450,55", protein: "12.34" }), []);
    expect(r).toMatchObject({ ok: true, value: { kcal: 450.6, protein_g: 12.3 } });
  });
  it("rejects negatives, huge values and text", () => {
    expect(parseCustom(form({ name: "x", kcal: "-5" }), []).ok).toBe(false);
    expect(parseCustom(form({ name: "x", kcal: "99999" }), []).ok).toBe(false);
    expect(parseCustom(form({ name: "x", kcal: "100", fat: "lots" }), []).ok).toBe(false);
  });
});

describe("ingredients", () => {
  it("scales per-100 g values by the amount and skips 0 g", () => {
    const items = itemsOf([ing("Chicken", 165, 31), ing("Rice", 130, 2.7)], [200, 0]);
    expect(items).toEqual([{ name: "Chicken", grams: 200, kcal: 330, protein: 62, carbs: 20, fat: 10 }]);
  });
  it("adds items up into form text", () => {
    const items = itemsOf([ing("A", 100, 10), ing("B", 50, 5)], [100, 100]);
    expect(totalsOf(items)).toEqual({ kcal: "150", protein: "15", carbs: "20", fat: "10" });
  });
});

describe("rows", () => {
  it("logs a saved dish as a meal for the local day", () => {
    const now = new Date(2026, 10, 1, 12);
    const meal = dishToMeal({ title: "T", kcal: 1, protein: 2, carbs: 3, fat: 4, items: [] }, "lunch", now);
    expect(meal).toMatchObject({ eaten_on: "2026-11-01", slot: "lunch", kcal: 1, protein_g: 2 });
  });
  it("reads a row with string numerics, and refuses a bad one", () => {
    const row = { id: "a", title: "T", kcal: "10.5", protein_g: "1", carbs_g: "2", fat_g: "3", items: [] };
    expect(dishFromRow(row)).toMatchObject({ kcal: 10.5 });
    expect(dishFromRow({ id: "a", title: "T", kcal: "x" })).toBeNull();
    expect(dishFromRow(null)).toBeNull();
  });
  it("makes one favorite key whatever the case or spacing", () => {
    expect(favoriteKey("  Pad  Thai ")).toBe(favoriteKey("pad thai"));
  });
});
