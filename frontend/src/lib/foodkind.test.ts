import { describe, expect, it } from "vitest";
import { dotOf, foodKind } from "./foodkind";

const m = (kcal: number, protein: number, carbs: number, fat: number) => ({ kcal, protein, carbs, fat });

describe("foodKind", () => {
  it("calls meat, fish, egg and tofu protein", () => {
    expect(foodKind(m(143, 12.6, 0.7, 9.5))).toBe("protein"); // egg
    expect(foodKind(m(165, 31, 0, 3.6))).toBe("protein"); // chicken breast
    expect(foodKind(m(144, 15, 3, 8))).toBe("protein"); // firm tofu
  });
  it("calls grains, noodles, bread and sugar carbs", () => {
    expect(foodKind(m(130, 2.7, 28, 0.3))).toBe("carbs"); // rice
    expect(foodKind(m(304, 0, 82, 0))).toBe("carbs"); // honey
    expect(foodKind(m(250, 8, 48, 3))).toBe("carbs"); // bread
  });
  it("calls oil, butter and nuts fat", () => {
    expect(foodKind(m(884, 0, 0, 100))).toBe("fat");
    expect(foodKind(m(717, 0.9, 0.1, 81))).toBe("fat"); // butter
    expect(foodKind(m(567, 26, 16, 49))).toBe("fat"); // peanuts: fat share beats protein share
  });
  it("calls light foods veg, fruit and drinks, even if their protein share is high", () => {
    expect(foodKind(m(23, 2.9, 3.6, 0.4))).toBe("fresh"); // spinach
    expect(foodKind(m(61, 3.2, 4.8, 3.3))).toBe("fresh"); // whole milk
    expect(foodKind(m(15, 1.4, 2.9, 0.2))).toBe("fresh"); // lettuce
  });
  it("copes with a food of no calories", () => {
    expect(foodKind(m(0, 0, 0, 0))).toBe("fresh");
  });
  it("gives a CSS colour", () => {
    expect(dotOf(m(130, 2.7, 28, 0.3))).toMatch(/^var\(--color-/);
  });
});
