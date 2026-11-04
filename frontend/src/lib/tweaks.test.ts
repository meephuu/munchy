import { describe, expect, it } from "vitest";
import { adjustmentNotes, availableTweaks, multipliers, placeExtra } from "./tweaks";

const names = ["Jasmine rice", "Pork, minced", "Egg, fried", "Vegetable oil"];

describe("availableTweaks", () => {
  it("offers only tweaks the dish has an ingredient for", () => {
    expect(availableTweaks(names).map((t) => t.id)).toEqual(["oil", "egg", "carb", "protein"]);
    expect(availableTweaks(["Cucumber"])).toEqual([]);
  });
  it("names the food in the label", () => {
    expect(availableTweaks(names).map((t) => t.label)).toEqual(["Less oil", "No egg", "Half rice", "Extra pork"]);
    expect(availableTweaks(["Rice noodles"]).map((t) => t.label)).toEqual(["Half noodles"]);
  });
});

describe("multipliers", () => {
  it("is all ones with nothing switched on", () => {
    expect(multipliers(names, "stall", [])).toEqual([1, 1, 1, 1]);
  });
  it("applies each tweak to its own ingredients only", () => {
    expect(multipliers(names, "stall", ["oil", "egg", "carb", "protein"])).toEqual([0.5, 1.5, 0, 0.5]);
  });
  it("does not scale egg or oil as protein", () => {
    expect(multipliers(["Egg, boiled", "Olive oil"], "stall", ["protein"])).toEqual([1, 1]);
  });
  it("home cooking reduces oil, and stacks with less oil", () => {
    expect(multipliers(names, "home", [])).toEqual([1, 1, 1, 0.7]);
    expect(multipliers(names, "home", ["oil"])[3]).toBeCloseTo(0.35);
  });
});

describe("placeExtra", () => {
  it("adds oil worth about 6% of the calories in a restaurant", () => {
    const extra = placeExtra("restaurant", 600)!;
    expect(Math.round((extra.grams * extra.per100.kcal) / 100)).toBe(36);
  });
  it("adds nothing elsewhere or with no calories", () => {
    expect(placeExtra("stall", 600)).toBeNull();
    expect(placeExtra("home", 600)).toBeNull();
    expect(placeExtra("restaurant", 0)).toBeNull();
  });
});

describe("adjustmentNotes", () => {
  it("lists switched-on tweaks and the place assumption", () => {
    const notes = adjustmentNotes("restaurant", ["egg"], availableTweaks(names));
    expect(notes).toHaveLength(2);
    expect(notes[0]).toContain("egg");
    expect(adjustmentNotes("stall", [], availableTweaks(names))).toEqual([]);
  });
});
