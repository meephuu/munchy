import { describe, expect, it } from "vitest";
import { ideasFor, roomLeft, type CatalogDish } from "./coach";

const dish = (title: string, kcal: number, protein: number): CatalogDish => ({ title, kcal, protein, carbs: 30, fat: 10 });
const catalog = [
  dish("Salad", 180, 25),
  dish("Chicken rice", 600, 35),
  dish("Burger", 800, 40),
  dish("Soup", 120, 8),
  dish("Steak", 520, 50),
  dish("Omelette", 400, 22),
];

describe("roomLeft", () => {
  const target = { kcal: 2000, proteinG: 100, carbsG: 250, fatG: 60 };
  it("subtracts what was eaten", () => {
    expect(roomLeft(target, { kcal: 1400, protein: 60 })).toEqual({ kcal: 600, protein: 40 });
  });
  it("lets calories go negative (over target) but protein stop at 0", () => {
    expect(roomLeft(target, { kcal: 2300, protein: 130 })).toEqual({ kcal: -300, protein: 0 });
  });
});

describe("ideasFor", () => {
  it("only suggests dishes that fit the calories left", () => {
    const titles = ideasFor(catalog, { kcal: 450 }, [], "fit", 10).map((d) => d.title);
    expect(titles).not.toContain("Burger");
    expect(titles).not.toContain("Chicken rice");
    expect(titles).not.toContain("Steak");
  });
  it("best fit puts a meal-sized dish first, not a snack", () => {
    expect(ideasFor(catalog, { kcal: 700 }, [], "fit")[0].title).toBe("Chicken rice");
  });
  it("high protein ranks by protein per calorie", () => {
    expect(ideasFor(catalog, { kcal: 900 }, [], "protein")[0].title).toBe("Salad");
  });
  it("lighter starts at the least calories above a floor", () => {
    const titles = ideasFor(catalog, { kcal: 900 }, [], "light").map((d) => d.title);
    expect(titles[0]).toBe("Salad");
    expect(titles).not.toContain("Soup");
  });
  it("leaves out what was eaten today, however it was typed", () => {
    expect(ideasFor(catalog, { kcal: 900 }, ["  chicken   RICE"], "fit", 10).map((d) => d.title)).not.toContain("Chicken rice");
  });
  it("has no ideas when the day is already over target", () => {
    expect(ideasFor(catalog, { kcal: 0 }, [], "fit")).toEqual([]);
    expect(ideasFor(catalog, { kcal: -50 }, [], "fit")).toEqual([]);
  });
  it("respects the limit", () => {
    expect(ideasFor(catalog, { kcal: 900 }, [], "fit", 2)).toHaveLength(2);
  });
});
