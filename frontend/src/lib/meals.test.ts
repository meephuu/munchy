import { describe, expect, it } from "vitest";
import type { Summary } from "./estimate";
import {
  dayLabel,
  dayTotals,
  friendlyMealError,
  defaultSlot,
  greetingPart,
  localDate,
  mealFromRow,
  mealToInsert,
  nextSlot,
  slotLabel,
  timeLabel,
  scaleItem,
  withTime,
  mealUpdate,
  type Meal,
} from "./meals";

// Dates are built from local parts (not ISO strings), so these tests pass in any timezone.
const at = (h: number, m = 0) => new Date(2026, 10, 1, h, m); // Sun 1 Nov 2026

const meal = (slot: Meal["slot"], kcal: number, over: Partial<Meal> = {}): Meal => ({
  id: `${slot}-${kcal}`,
  eatenAt: at(12),
  slot,
  title: slot,
  kcal,
  protein: kcal / 10,
  carbs: kcal / 8,
  fat: kcal / 30,
  items: [],
  ...over,
});

const target = { kcal: 2000, proteinG: 100, carbsG: 250, fatG: 60 };

describe("defaultSlot", () => {
  it.each([
    [5, "breakfast"], [10, "breakfast"], [11, "lunch"], [14, "lunch"],
    [15, "snack"], [17, "snack"], [18, "dinner"], [23, "dinner"], [0, "snack"], [4, "snack"],
  ])("at %i:00 -> %s", (hour, slot) => {
    expect(defaultSlot(at(hour))).toBe(slot);
  });
});

describe("dates and labels", () => {
  it("localDate is the local calendar day, so a late-evening meal still belongs to that day", () => {
    expect(localDate(at(23, 59))).toBe("2026-11-01");
    expect(localDate(new Date(2026, 10, 2, 0, 1))).toBe("2026-11-02");
    expect(localDate(new Date(2026, 0, 5, 9))).toBe("2026-01-05"); // zero-padded
  });
  it("formats the time, the day line and the greeting", () => {
    expect(timeLabel(at(8, 5))).toBe("08:05");
    expect(dayLabel(at(12))).toBe("Today · Sun 1 Nov");
    expect([at(7), at(12), at(13), at(17, 59), at(18)].map(greetingPart)).toEqual([
      "morning", "afternoon", "afternoon", "afternoon", "evening",
    ]);
  });
  it("slotLabel", () => {
    expect(slotLabel("dinner")).toBe("Dinner");
  });
});

describe("mealToInsert", () => {
  const summary = {
    kcal: 392, protein: 30, carbs: 21, fat: 21, weight: 220, low: 340, high: 450, edited: true,
    rows: [
      { name: "Lettuce", grams: 47, kcal: 8, protein: 0.6, carbs: 1.5, fat: 0.1, dot: "x", edited: false, added: false },
      { name: "Croutons", grams: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, dot: "x", edited: true, added: false },
      { name: "Boiled egg", grams: 50, kcal: 78, protein: 6.3, carbs: 0.6, fat: 5.3, dot: "x", edited: false, added: true },
    ],
  } as Summary;

  it("saves the totals, the day, the slot and the title as logged", () => {
    const row = mealToInsert("  caesar salad  ", summary, "dinner", at(19, 30));
    expect(row).toMatchObject({
      eaten_on: "2026-11-01", slot: "dinner", title: "caesar salad",
      kcal: 392, protein_g: 30, carbs_g: 21, fat_g: 21,
    });
    expect(new Date(row.eaten_at).getTime()).toBe(at(19, 30).getTime());
  });

  it("keeps the ingredients with their amounts and macros, and leaves out foods taken out (0 g)", () => {
    const { items } = mealToInsert("x", summary, "lunch", at(12));
    expect(items.map((i) => i.name)).toEqual(["Lettuce", "Boiled egg"]);
    expect(items[1]).toEqual({ name: "Boiled egg", grams: 50, kcal: 78, protein: 6.3, carbs: 0.6, fat: 5.3 });
  });

  it("cuts an absurdly long title to the 500 characters the table allows", () => {
    expect(mealToInsert("a".repeat(900), summary, "lunch", at(12)).title).toHaveLength(500);
  });
});

describe("mealFromRow", () => {
  const row = {
    id: "abc", eaten_at: at(12, 30).toISOString(), eaten_on: "2026-11-01", slot: "lunch", title: "Khao man gai",
    kcal: "596.0", protein_g: "30.5", carbs_g: "70", fat_g: "20.2",
    items: [{ name: "Rice", grams: 200, kcal: 260, protein: 5, carbs: 57, fat: 0.5 }, { nope: true }],
  };

  it("reads a row (numerics arrive as strings) and skips malformed items", () => {
    const m = mealFromRow(row)!;
    expect(m).toMatchObject({ id: "abc", slot: "lunch", title: "Khao man gai", kcal: 596, protein: 30.5, carbs: 70, fat: 20.2 });
    expect(m.eatenAt.getTime()).toBe(at(12, 30).getTime());
    expect(m.items).toHaveLength(1);
  });

  it.each([
    ["null", null],
    ["no id", { ...row, id: undefined }],
    ["an unknown slot", { ...row, slot: "brunch" }],
    ["a bad date", { ...row, eaten_at: "yesterday-ish" }],
    ["a non-numeric total", { ...row, kcal: "lots" }],
  ])("rejects a row with %s", (_, bad) => {
    expect(mealFromRow(bad)).toBeNull();
  });

  it("copes with items missing", () => {
    expect(mealFromRow({ ...row, items: null })!.items).toEqual([]);
  });
});

describe("dayTotals", () => {
  it("is empty and not over for a day with no meals", () => {
    const t = dayTotals([], target);
    expect(t).toMatchObject({ count: 0, pct: 0, left: 2000, over: false });
    expect(t.eaten).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(t.macros!.protein).toEqual({ eaten: 0, goal: 100, pct: 0 });
  });

  it("adds the meals up and measures them against the target", () => {
    const t = dayTotals([meal("breakfast", 314), meal("lunch", 596)], target);
    expect(t.eaten.kcal).toBe(910);
    expect(t).toMatchObject({ count: 2, pct: 46, left: 1090, over: false });
    expect(t.macros!.protein.pct).toBe(Math.round(((31.4 + 59.6) / 100) * 100));
  });

  it("is only 'over' when more than 5% above the target (the design's rule)", () => {
    expect(dayTotals([meal("dinner", 2100)], target).over).toBe(false); // exactly +5%
    expect(dayTotals([meal("dinner", 2101)], target).over).toBe(true);
    expect(dayTotals([meal("dinner", 2400)], target)).toMatchObject({ pct: 120, left: -400, over: true });
  });

  it("caps a macro bar at 100% while still reporting what was eaten", () => {
    const t = dayTotals([meal("dinner", 3000)], target);
    expect(t.macros!.protein.pct).toBe(100);
    expect(t.macros!.protein.eaten).toBe(300);
  });

  it("without a target (no profile yet) still totals what was eaten, with no percentages", () => {
    const t = dayTotals([meal("lunch", 500)], null);
    expect(t).toMatchObject({ pct: null, left: null, over: false, macros: null, count: 1 });
    expect(t.eaten.kcal).toBe(500);
  });
});

describe("nextSlot", () => {
  it("suggests the slot for this time of day when nothing is logged for it", () => {
    expect(nextSlot(at(19), [meal("breakfast", 300), meal("lunch", 600)])).toBe("dinner");
    expect(nextSlot(at(8), [])).toBe("breakfast");
  });
  it("moves on to the next free slot once the current one is logged", () => {
    expect(nextSlot(at(12), [meal("lunch", 600)])).toBe("snack");
    expect(nextSlot(at(16), [meal("snack", 100)])).toBe("dinner");
  });
  it("is null when this slot and every later one are covered", () => {
    expect(nextSlot(at(19), [meal("dinner", 700)])).toBeNull();
  });
  it("skips earlier slots that were never logged (no nagging about breakfast at 7pm)", () => {
    expect(nextSlot(at(19), [])).toBe("dinner");
  });
});

describe("friendlyMealError", () => {
  it("explains a missing table, an expired login and a network failure in plain words", () => {
    expect(friendlyMealError({ code: "42P01" })).toMatch(/meals table is missing/);
    expect(friendlyMealError({ code: "PGRST205", message: "Could not find the table 'public.meals'" })).toMatch(/meals table/);
    expect(friendlyMealError({ code: "PGRST301" })).toMatch(/log in again/);
    expect(friendlyMealError({ status: 401 })).toMatch(/log in again/);
    expect(friendlyMealError({ message: "Failed to fetch" })).toMatch(/Can't reach/);
  });
  it("never shows raw error text it does not recognise", () => {
    expect(friendlyMealError({ code: "23514", message: 'violates check constraint "meals_kcal_check"' })).toBe(
      "We couldn't save that. Please try again.",
    );
  });
});

describe("editing a logged meal", () => {
  const item = { name: "Egg", grams: 50, kcal: 78, protein: 6.5, carbs: 0.4, fat: 5.3 };
  const base = meal("lunch", 156, { eatenAt: at(12, 30), items: [item, { ...item, name: "Rice", kcal: 100 }] });

  it("moves a meal to a typed time on the same day", () => {
    const d = withTime(at(12, 30), "7:05")!;
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([1, 7, 5]);
    expect(withTime(at(12), "25:00")).toBeNull();
    expect(withTime(at(12), "noon")).toBeNull();
  });
  it("scales an item with its amount", () => {
    expect(scaleItem(item, 100)).toEqual({ name: "Egg", grams: 100, kcal: 156, protein: 13, carbs: 0.8, fat: 10.6 });
    expect(scaleItem({ ...item, grams: 0 }, 100).kcal).toBe(0);
  });
  it("adds the ingredients up and drops 0 g ones", () => {
    const u = mealUpdate(base, { time: "08:00", slot: "breakfast", items: [item, scaleItem(base.items[1], 0)], totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 } })!;
    expect(u.kcal).toBe(78);
    expect(u.items).toHaveLength(1);
    expect(u.slot).toBe("breakfast");
    expect(new Date(u.eaten_at).getHours()).toBe(8);
  });
  it("uses the typed totals when there are no ingredients", () => {
    const u = mealUpdate(meal("snack", 300), { time: "16:00", slot: "snack", items: [], totals: { kcal: 320, protein: 5, carbs: 40, fat: 9 } })!;
    expect([u.kcal, u.protein_g, u.carbs_g, u.fat_g]).toEqual([320, 5, 40, 9]);
  });
  it("refuses a bad time", () => {
    expect(mealUpdate(base, { time: "99:99", slot: "lunch", items: [], totals: { kcal: 1, protein: 0, carbs: 0, fat: 0 } })).toBeNull();
  });
});
