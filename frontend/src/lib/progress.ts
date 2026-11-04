// The Progress screen's numbers: the last 7 days against the target, the streak, the protein average,
// the weight trend and the "Buddy's note". Pure functions over logged meals and weigh-ins. The note is
// rules in code (never an LLM), so every number in it can be traced.

import { localDate, type Meal, type TargetLike } from "./meals";

const dateKey = (d: Date) => localDate(d);
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const WEEK = 7;

/** The 7 local days ending today, oldest first ("2026-10-26" ... "2026-11-01"). */
export function lastDays(now: Date, count = WEEK): string[] {
  return Array.from({ length: count }, (_, i) => dateKey(addDays(now, i - (count - 1))));
}

/** A day's meals as stored: the date it belongs to (eaten_on) with its totals. */
export type DayMeal = Pick<Meal, "kcal" | "protein"> & { eatenOn: string };

export type DayBar = {
  date: string;
  /** Mon / Tue ... first letter is shown under the bar. */
  weekday: string;
  kcal: number;
  protein: number;
  logged: boolean;
  today: boolean;
  /** More than 5% over the target (DESIGN.md: terracotta), not for today (the day is not over). */
  over: boolean;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const parseDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** One bar per day. */
export function dayBars(meals: DayMeal[], days: string[], today: string, target: TargetLike | null): DayBar[] {
  return days.map((date) => {
    const mine = meals.filter((m) => m.eatenOn === date);
    const kcal = Math.round(mine.reduce((s, m) => s + m.kcal, 0));
    const protein = Math.round(mine.reduce((s, m) => s + m.protein, 0));
    return {
      date,
      weekday: WEEKDAYS[parseDate(date).getDay()],
      kcal,
      protein,
      logged: mine.length > 0,
      today: date === today,
      over: !!target && date !== today && kcal > target.kcal * 1.05,
    };
  });
}

/** Days in a row with at least one meal, counting back from today. If nothing is logged yet today the
 *  streak still counts through yesterday (the day is not over), so it does not show 0 every morning. */
export function streak(loggedDates: Iterable<string>, now: Date): number {
  const set = new Set(loggedDates);
  let day = now;
  if (!set.has(dateKey(day))) day = addDays(day, -1);
  let n = 0;
  while (set.has(dateKey(day))) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export type WeekStats = {
  /** Average over the finished days that had meals logged (today is left out: it is still going on),
   *  or null if there are none. */
  avgKcal: number | null;
  avgProtein: number | null;
  daysLogged: number;
  daysOver: number;
};

export function weekStats(bars: DayBar[]): WeekStats {
  const done = bars.filter((b) => b.logged && !b.today);
  const avg = (f: (b: DayBar) => number) => (done.length ? Math.round(done.reduce((s, b) => s + f(b), 0) / done.length) : null);
  return {
    avgKcal: avg((b) => b.kcal),
    avgProtein: avg((b) => b.protein),
    daysLogged: bars.filter((b) => b.logged).length,
    daysOver: bars.filter((b) => b.over).length,
  };
}

export type Weigh = { loggedOn: string; kg: number };

const SMOOTHING = 0.3; // weight of each new weigh-in: day-to-day water swings count less than the trend

/** The smoothed weight after each weigh-in (exponential moving average), oldest first. */
export function smoothed(weighs: Weigh[]): Weigh[] {
  const sorted = [...weighs].sort((a, b) => a.loggedOn.localeCompare(b.loggedOn));
  const out: Weigh[] = [];
  for (const w of sorted) {
    const prev = out.at(-1)?.kg;
    out.push({ loggedOn: w.loggedOn, kg: prev === undefined ? w.kg : prev + SMOOTHING * (w.kg - prev) });
  }
  return out;
}

export type WeightTrend = {
  /** Trend now, to one decimal. */
  kg: number;
  /** Change over the last 14 days of weigh-ins (or since the first one if that is newer), to one decimal; null with one weigh-in. */
  change: number | null;
  days: number;
};

const dayDiff = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);

export function weightTrend(weighs: Weigh[]): WeightTrend | null {
  const s = smoothed(weighs);
  if (s.length === 0) return null;
  const last = s[s.length - 1];
  const kg = Math.round(last.kg * 10) / 10;
  if (s.length === 1) return { kg, change: null, days: 0 };
  // the latest point at least 14 days before the last one, else the first point
  const base = [...s].reverse().find((p) => dayDiff(p.loggedOn, last.loggedOn) >= 14) ?? s[0];
  return {
    kg,
    change: Math.round((last.kg - base.kg) * 10) / 10,
    days: dayDiff(base.loggedOn, last.loggedOn),
  };
}

/** "Buddy's note": one or two plain sentences from rules, in order of what matters most. */
export function buddyNote(stats: WeekStats, streakDays: number, target: TargetLike | null): string {
  if (stats.daysLogged === 0) return "Log a few meals and I'll show how your week is going.";
  const parts: string[] = [];
  if (stats.daysOver >= 2) {
    parts.push(`You went over your target on ${stats.daysOver} of the last 7 days. A little lighter dinners would even it out.`);
  } else if (stats.daysOver === 1) {
    parts.push("One day ran over your target this week. That's fine, a week is what counts.");
  } else if (stats.avgKcal !== null) {
    parts.push("Every finished day this week stayed within your target.");
  }
  if (target && stats.avgProtein !== null) {
    const pct = stats.avgProtein / target.proteinG;
    if (pct < 0.8) {
      parts.push(`Protein averaged ${stats.avgProtein} g against your ${target.proteinG} g, so an egg or some chicken per meal would help.`);
    } else if (pct >= 1) {
      parts.push(`Protein is on point at ${stats.avgProtein} g a day.`);
    }
  }
  if (streakDays >= 3) parts.push(`${streakDays} days in a row, nice.`);
  return parts.length ? parts.join(" ") : "Keep logging. A few more days and I can tell you more.";
}

/** The weigh-in row to save for a typed weight, or null if it is not a sensible number (30-250 kg). */
export function weighToInsert(text: string, now: Date): { logged_on: string; kg: number } | null {
  const kg = Number(text.trim().replace(",", "."));
  if (!Number.isFinite(kg) || kg < 30 || kg > 250) return null;
  return { logged_on: localDate(now), kg: Math.round(kg * 10) / 10 };
}

