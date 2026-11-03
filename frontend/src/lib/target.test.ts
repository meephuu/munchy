import { describe, expect, it } from "vitest";
import { bmrOf, dailyTarget, isValidBody, type Body } from "./target";

const person: Body = { sex: "unspecified", age: 21, heightCm: 174, weightKg: 68 }; // the design's sample person

describe("bmrOf (Mifflin-St Jeor)", () => {
  it("matches the formula for each sex", () => {
    expect(bmrOf({ ...person, sex: "male" })).toBeCloseTo(10 * 68 + 6.25 * 174 - 5 * 21 + 5);
    expect(bmrOf({ ...person, sex: "female" })).toBeCloseTo(10 * 68 + 6.25 * 174 - 5 * 21 - 161);
    expect(bmrOf(person)).toBeCloseTo(1584.5); // midpoint of the two
  });
  it("a man burns more than a woman of the same build", () => {
    expect(bmrOf({ ...person, sex: "male" })).toBeGreaterThan(bmrOf({ ...person, sex: "female" }));
  });
});

describe("dailyTarget", () => {
  it("stay balanced on a desk job = BMR x 1.2, protein by weight, 28% fat, carbs fill the rest", () => {
    const t = dailyTarget(person, "maintain", "desk")!;
    expect(t.kcal).toBe(1900); // 1584.5 x 1.2 = 1901 -> 1900
    expect(t.proteinG).toBe(102); // 1.5 g/kg x 68
    expect(t.fatG).toBe(59); // 28% of 1900 kcal / 9
    expect(t.carbsG).toBe(Math.round((1900 - 102 * 4 - 59 * 9) / 4));
    expect([t.bmr, t.maintenance, t.floored]).toEqual([1585, 1901, false]);
  });

  it("moves with the activity level", () => {
    const kcal = (a: "desk" | "feet" | "active") => dailyTarget(person, "maintain", a)!.kcal;
    expect(kcal("desk")).toBeLessThan(kcal("feet"));
    expect(kcal("feet")).toBeLessThan(kcal("active"));
  });

  it("orders the goals: lose < stay < build muscle < gain, with more protein for losing and building", () => {
    const t = (g: "lose" | "maintain" | "gain" | "muscle") => dailyTarget(person, g, "feet")!;
    expect(t("lose").kcal).toBeLessThan(t("maintain").kcal);
    expect(t("maintain").kcal).toBeLessThan(t("muscle").kcal);
    expect(t("muscle").kcal).toBeLessThan(t("gain").kcal);
    expect(t("muscle").proteinG).toBeGreaterThan(t("maintain").proteinG);
    expect(t("lose").proteinG).toBeGreaterThan(t("maintain").proteinG);
  });

  it("targets are rounded to the nearest 10 kcal", () => {
    for (const g of ["lose", "maintain", "gain", "muscle"] as const) {
      expect(dailyTarget(person, g, "feet")!.kcal % 10).toBe(0);
    }
  });

  it("never aims for an extreme deficit: losing weight is floored at the resting needs and 1,200 kcal", () => {
    const small: Body = { sex: "female", age: 60, heightCm: 150, weightKg: 40 }; // resting needs ~ 1,000
    const t = dailyTarget(small, "lose", "desk")!;
    expect(t.floored).toBe(true);
    expect(t.kcal).toBeGreaterThanOrEqual(1200);
    expect(t.kcal).toBeGreaterThanOrEqual(Math.round(t.bmr / 10) * 10);
    expect(dailyTarget(small, "maintain", "desk")!.floored).toBe(false);
  });

  it("does not floor a normal weight-loss target", () => {
    const t = dailyTarget(person, "lose", "feet")!;
    expect(t.floored).toBe(false);
    expect(t.kcal).toBe(Math.round((1584.5 * 1.4 * 0.85) / 10) * 10);
  });

  it("caps protein at 35% of calories so a very heavy person on a low target stays sensible", () => {
    const t = dailyTarget({ sex: "female", age: 60, heightCm: 130, weightKg: 250 }, "muscle", "desk")!;
    expect(t.proteinG * 4).toBeLessThanOrEqual(t.kcal * 0.35);
    expect(t.carbsG).toBeGreaterThanOrEqual(0);
  });

  it("macros always add up to about the calorie target", () => {
    for (const goal of ["lose", "maintain", "gain", "muscle"] as const) {
      const t = dailyTarget(person, goal, "active")!;
      expect(Math.abs(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9 - t.kcal)).toBeLessThanOrEqual(10);
    }
  });
});

describe("validation", () => {
  it("accepts ordinary bodies and rejects out-of-range or non-numeric values", () => {
    expect(isValidBody(person)).toBe(true);
    expect(isValidBody({ ...person, age: 13 })).toBe(false);
    expect(isValidBody({ ...person, age: 101 })).toBe(false);
    expect(isValidBody({ ...person, heightCm: 100 })).toBe(false);
    expect(isValidBody({ ...person, weightKg: 29 })).toBe(false);
    expect(isValidBody({ ...person, weightKg: NaN })).toBe(false);
  });
  it("gives no target for an invalid body", () => {
    expect(dailyTarget({ ...person, age: 5 }, "maintain", "desk")).toBeNull();
  });
});
