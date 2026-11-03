// Logged meals and the day's totals. Pure functions: the screens fetch and save, this decides what the
// numbers mean (which day, which slot, how much of the target is eaten). Stored in the Supabase `meals`
// table (supabase/migrations/20261104000000_meals.sql).

import type { Summary } from "./estimate";

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

export const SLOTS: { id: MealSlot; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "snack", label: "Snack" },
  { id: "dinner", label: "Dinner" },
];

/** One ingredient of a logged meal, at the amount that was logged. */
export type MealItem = { name: string; grams: number; kcal: number; protein: number; carbs: number; fat: number };

/** What the app sends to Supabase to log a meal (user_id is filled in by the database from the login). */
export type MealInsert = {
  eaten_at: string;
  eaten_on: string;
  slot: MealSlot;
  title: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  items: MealItem[];
};

export type Meal = {
  id: string;
  eatenAt: Date;
  slot: MealSlot;
  title: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  items: MealItem[];
};

/** The slot a meal eaten at this time most likely is. Hours 0-4 count as a snack (late night). */
export function defaultSlot(now: Date): MealSlot {
  const h = now.getHours();
  if (h >= 5 && h < 11) return "breakfast";
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 15 && h < 18) return "snack";
  if (h >= 18) return "dinner";
  return "snack";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The person's local calendar day as YYYY-MM-DD ("today" ends at their midnight). */
export function localDate(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** "08:10" in the person's local time. */
export function timeLabel(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Today · Sun 1 Nov" */
export function dayLabel(now: Date): string {
  return `Today · ${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;
}

/** "morning" | "afternoon" | "evening", for "Good evening". */
export function greetingPart(now: Date): "morning" | "afternoon" | "evening" {
  const h = now.getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

/** The row to save for the dish screen's current numbers. Foods taken out (0 g) are not saved. */
export function mealToInsert(title: string, summary: Summary, slot: MealSlot, now: Date): MealInsert {
  return {
    eaten_at: now.toISOString(),
    eaten_on: localDate(now),
    slot,
    title: title.trim().slice(0, 500),
    kcal: summary.kcal,
    protein_g: summary.protein,
    carbs_g: summary.carbs,
    fat_g: summary.fat,
    items: summary.rows
      .filter((r) => r.grams > 0)
      .map((r) => ({ name: r.name, grams: r.grams, kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat })),
  };
}

const isSlot = (v: unknown): v is MealSlot => SLOTS.some((s) => s.id === v);

function toItem(raw: unknown): MealItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const nums = [r.grams, r.kcal, r.protein, r.carbs, r.fat].map(Number);
  if (typeof r.name !== "string" || nums.some((n) => !Number.isFinite(n))) return null;
  const [grams, kcal, protein, carbs, fat] = nums;
  return { name: r.name, grams, kcal, protein, carbs, fat };
}

/** A Meal from a row as Supabase returns it (numerics may arrive as strings), or null if the row is off. */
export function mealFromRow(row: unknown): Meal | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  const eatenAt = new Date(String(r.eaten_at));
  const nums = [r.kcal, r.protein_g, r.carbs_g, r.fat_g].map(Number);
  if (typeof r.id !== "string" || typeof r.title !== "string" || !isSlot(r.slot)) return null;
  if (Number.isNaN(eatenAt.getTime()) || nums.some((n) => !Number.isFinite(n))) return null;
  const [kcal, protein, carbs, fat] = nums;
  const items = Array.isArray(r.items) ? r.items.map(toItem).filter((i): i is MealItem => i !== null) : [];
  return { id: r.id, eatenAt, slot: r.slot, title: r.title, kcal, protein, carbs, fat, items };
}

export type MacroProgress = { eaten: number; goal: number; pct: number };

export type DayTotals = {
  eaten: { kcal: number; protein: number; carbs: number; fat: number };
  count: number;
  /** Whole percent of the calorie target eaten (can pass 100), or null with no target. */
  pct: number | null;
  /** Target minus eaten (negative when over), or null with no target. */
  left: number | null;
  /** More than 5% over the target (DESIGN.md: "over target" turns terracotta). */
  over: boolean;
  macros: { protein: MacroProgress; carbs: MacroProgress; fat: MacroProgress } | null;
};

export type TargetLike = { kcal: number; proteinG: number; carbsG: number; fatG: number };

const barPct = (eaten: number, goal: number) => (goal > 0 ? Math.min(100, Math.round((eaten / goal) * 100)) : 0);

/** What the day's meals add up to, and how that sits against the target (null target = person has no profile yet). */
export function dayTotals(meals: Meal[], target: TargetLike | null): DayTotals {
  const eaten = meals.reduce(
    (t, m) => ({ kcal: t.kcal + m.kcal, protein: t.protein + m.protein, carbs: t.carbs + m.carbs, fat: t.fat + m.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const rounded = {
    kcal: Math.round(eaten.kcal),
    protein: Math.round(eaten.protein),
    carbs: Math.round(eaten.carbs),
    fat: Math.round(eaten.fat),
  };
  if (!target) return { eaten: rounded, count: meals.length, pct: null, left: null, over: false, macros: null };
  return {
    eaten: rounded,
    count: meals.length,
    pct: Math.round((eaten.kcal / target.kcal) * 100),
    left: Math.round(target.kcal - eaten.kcal),
    over: eaten.kcal > target.kcal * 1.05,
    macros: {
      protein: { eaten: rounded.protein, goal: target.proteinG, pct: barPct(eaten.protein, target.proteinG) },
      carbs: { eaten: rounded.carbs, goal: target.carbsG, pct: barPct(eaten.carbs, target.carbsG) },
      fat: { eaten: rounded.fat, goal: target.fatG, pct: barPct(eaten.fat, target.fatG) },
    },
  };
}

// Slots in the order a day goes (the snack sits between lunch and dinner).
const DAY_ORDER: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];

/** The meal to suggest next ("Dinner — need ideas?"): the slot for this time of day if nothing is logged
 *  for it, else the next later slot with nothing logged, else null (the day is covered). */
export function nextSlot(now: Date, meals: Meal[]): MealSlot | null {
  const logged = new Set(meals.map((m) => m.slot));
  const start = DAY_ORDER.indexOf(defaultSlot(now));
  for (const slot of DAY_ORDER.slice(start)) if (!logged.has(slot)) return slot;
  return null;
}

export const slotLabel = (slot: MealSlot) => SLOTS.find((s) => s.id === slot)!.label;
