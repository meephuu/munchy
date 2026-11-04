import { describe, expect, it } from "vitest";
import { buddyNote, dayBars, lastDays, smoothed, streak, weekStats, weighToInsert, weightTrend } from "./progress";

const now = new Date(2026, 10, 1, 20); // Sun 1 Nov 2026
const target = { kcal: 2000, proteinG: 100, carbsG: 250, fatG: 60 };
const m = (eatenOn: string, kcal: number, protein = 80) => ({ eatenOn, kcal, protein });

describe("lastDays", () => {
  it("is 7 local days ending today, across a month change", () => {
    expect(lastDays(now)).toEqual([
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01",
    ]);
  });
});

describe("the 2 am day change", () => {
  it("at 1 am it is still yesterday: the last 7 days end yesterday and the streak counts from it", () => {
    const night = new Date(2026, 10, 2, 1, 0);
    expect(lastDays(night).at(-1)).toBe("2026-11-01");
    expect(streak(["2026-11-01", "2026-10-31"], night)).toBe(2);
  });
  it("from 2 am it is the next day", () => {
    expect(lastDays(new Date(2026, 10, 2, 2, 0)).at(-1)).toBe("2026-11-02");
  });
  it("a weigh-in at 1 am goes to the day before", () => {
    expect(weighToInsert("68", new Date(2026, 10, 2, 1, 0))?.logged_on).toBe("2026-11-01");
  });
});

describe("dayBars", () => {
  const days = lastDays(now);
  const bars = dayBars([m("2026-10-26", 1900), m("2026-10-27", 2300), m("2026-10-27", 100), m("2026-11-01", 3000)], days, "2026-11-01", target);
  it("sums a day's meals and names the weekday", () => {
    expect(bars[1]).toMatchObject({ weekday: "Tue", kcal: 2400, logged: true });
    expect(bars[2]).toMatchObject({ kcal: 0, logged: false });
  });
  it("marks over only when 5% above the target, and never today", () => {
    expect(bars[0].over).toBe(false);
    expect(bars[1].over).toBe(true);
    expect(bars[6]).toMatchObject({ today: true, over: false });
  });
  it("marks nothing over without a target", () => {
    expect(dayBars([m("2026-10-27", 9000)], days, "2026-11-01", null).some((b) => b.over)).toBe(false);
  });
});

describe("weekStats", () => {
  it("averages finished logged days only", () => {
    const bars = dayBars([m("2026-10-26", 1800, 60), m("2026-10-27", 2200, 100), m("2026-11-01", 500, 10)], lastDays(now), "2026-11-01", target);
    expect(weekStats(bars)).toEqual({ avgKcal: 2000, avgProtein: 80, daysLogged: 3, daysOver: 1 });
  });
  it("is null with nothing finished", () => {
    const s = weekStats(dayBars([], lastDays(now), "2026-11-01", target));
    expect(s).toEqual({ avgKcal: null, avgProtein: null, daysLogged: 0, daysOver: 0 });
  });
});

describe("streak", () => {
  it("counts consecutive days through today", () => {
    expect(streak(["2026-11-01", "2026-10-31", "2026-10-30", "2026-10-28"], now)).toBe(3);
  });
  it("keeps the streak alive when today is still empty", () => {
    expect(streak(["2026-10-31", "2026-10-30"], now)).toBe(2);
  });
  it("is 0 after a gap or with nothing", () => {
    expect(streak(["2026-10-29"], now)).toBe(0);
    expect(streak([], now)).toBe(0);
  });
});

describe("weight trend", () => {
  it("smooths: a one-day spike moves the trend only part of the way", () => {
    const s = smoothed([{ loggedOn: "2026-10-01", kg: 70 }, { loggedOn: "2026-10-02", kg: 72 }]);
    expect(s[1].kg).toBeCloseTo(70.6);
  });
  it("is null with no weigh-ins, and has no change with one", () => {
    expect(weightTrend([])).toBeNull();
    expect(weightTrend([{ loggedOn: "2026-11-01", kg: 68 }])).toEqual({ kg: 68, change: null, days: 0 });
  });
  it("reports the change against ~14 days ago", () => {
    const t = weightTrend([
      { loggedOn: "2026-10-01", kg: 70 },
      { loggedOn: "2026-10-18", kg: 69 },
      { loggedOn: "2026-11-01", kg: 68 },
    ])!;
    expect(t.change).toBeLessThan(0);
    expect(t.days).toBe(14);
  });
});

describe("buddyNote", () => {
  const stats = (o: Partial<ReturnType<typeof weekStats>>) => ({ avgKcal: 2000, avgProtein: 100, daysLogged: 5, daysOver: 0, ...o });
  it("asks for meals when nothing is logged", () => {
    expect(buddyNote(stats({ daysLogged: 0 }), 0, target)).toContain("Log a few meals");
  });
  it("mentions days over and low protein, with real numbers", () => {
    const note = buddyNote(stats({ daysOver: 3, avgProtein: 60 }), 0, target);
    expect(note).toContain("3 of the last 7");
    expect(note).toContain("60 g");
    expect(note).toContain("100 g");
  });
  it("praises a streak", () => {
    expect(buddyNote(stats({}), 4, target)).toContain("4 days in a row");
  });
});

describe("weighToInsert", () => {
  it("accepts a number with a comma and rounds to one decimal", () => {
    expect(weighToInsert(" 67,84 ", now)).toEqual({ logged_on: "2026-11-01", kg: 67.8 });
  });
  it("rejects nonsense", () => {
    expect(weighToInsert("abc", now)).toBeNull();
    expect(weighToInsert("20", now)).toBeNull();
    expect(weighToInsert("", now)).toBeNull();
  });
});
