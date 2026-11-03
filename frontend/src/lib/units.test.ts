import { describe, expect, it } from "vitest";
import { bestUnit, formatQty, stepOf, toGrams, toQty, type UnitOption } from "./units";

const egg: UnitOption = { label: "egg", grams: 50 };
const tbsp: UnitOption = { label: "tbsp", grams: 14.7 };
const cup: UnitOption = { label: "cup", grams: 235 };

describe("toQty / toGrams", () => {
  it("convert between grams and a unit, and leave grams alone for no unit", () => {
    expect(toQty(100, egg)).toBe(2);
    expect(toQty(75, egg)).toBe(1.5);
    expect(toGrams(2, egg)).toBe(100);
    expect(toQty(120, null)).toBe(120);
    expect(toGrams(120, null)).toBe(120);
  });

  it("round the count to two decimals", () => {
    expect(toQty(10, { label: "slice", grams: 3 })).toBe(3.33);
  });
});

describe("stepOf and formatQty", () => {
  it("steps 10 g, half a spoon or cup, or one piece", () => {
    expect(stepOf(null)).toBe(10);
    expect(stepOf(tbsp)).toBe(0.5);
    expect(stepOf(cup)).toBe(0.5);
    expect(stepOf(egg)).toBe(1);
  });

  it("prints counts without trailing zeros", () => {
    expect([1, 0.5, 2.25, 3.1, 10].map(formatQty)).toEqual(["1", "0.5", "2.25", "3.1", "10"]);
  });
});

describe("bestUnit", () => {
  it("picks the unit that makes the amount a whole count", () => {
    expect(bestUnit(50, [egg])).toBe(egg);
    expect(bestUnit(14.7, [cup, tbsp])).toBe(tbsp);
  });

  it("accepts half counts but prefers whole ones", () => {
    expect(bestUnit(75, [egg])).toBe(egg);                                    // 1.5 eggs
    expect(bestUnit(235, [tbsp, cup])).toBe(cup);                             // 1 cup (16 tbsp is not a whole/half count anyway)
    expect(bestUnit(100, [{ label: "a", grams: 40 }, { label: "b", grams: 50 }])?.label).toBe("b");  // 2 b beats 2.5 a
  });

  it("prefers the larger unit when two give whole counts", () => {
    expect(bestUnit(100, [{ label: "small", grams: 25 }, { label: "big", grams: 50 }])?.label).toBe("big");
  });

  it("falls back to grams when no unit gives a tidy count, or the amount is 0", () => {
    expect(bestUnit(47, [egg])).toBeNull();
    expect(bestUnit(10, [egg])).toBeNull();                                   // less than half an egg
    expect(bestUnit(0, [egg])).toBeNull();
    expect(bestUnit(50, [])).toBeNull();
  });

  it("ignores huge counts", () => {
    expect(bestUnit(3100, [{ label: "pinch", grams: 100 }])).toBeNull();     // 31 pinches
  });
});
