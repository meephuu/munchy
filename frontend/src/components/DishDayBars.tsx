"use client";

import { useEffect, useState } from "react";
import {
  dayTotals,
  localDate,
  mealFromRow,
  type Meal,
  type TargetLike,
} from "@/lib/meals";
import { createClient } from "@/lib/supabase/client";

type Dish = { kcal: number; protein: number; carbs: number; fat: number };

const ROWS = [
  { key: "kcal", label: "Calories", unit: "kcal", goal: "kcal", text: "text-green", bar: "bg-green" },
  { key: "protein", label: "Protein", unit: "g", goal: "proteinG", text: "text-green", bar: "bg-green" },
  { key: "carbs", label: "Carbs", unit: "g", goal: "carbsG", text: "text-bronze", bar: "bg-bronze" },
  { key: "fat", label: "Fat", unit: "g", goal: "fatG", text: "text-terracotta-text", bar: "bg-terracotta" },
] as const;

/** Desktop bite check, for a member: for calories and each macro, a bar of the day's target with what is already
 *  eaten today and what this dish adds on top. Today's meals are loaded in the browser (a day is the person's own). */
export function DishDayBars({ target, dish }: { target: TargetLike; dish: Dish }) {
  const [meals, setMeals] = useState<Meal[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (!supabase) return setMeals([]);
      const { data } = await supabase
        .from("meals")
        .select("*")
        .eq("eaten_on", localDate(new Date()));
      if (cancelled) return;
      setMeals(
        (data ?? []).map(mealFromRow).filter((m): m is Meal => m !== null),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const eaten = dayTotals(meals ?? [], target).eaten;

  return (
    <div
      className="flex flex-col gap-3.5"
      aria-busy={meals === null}
      aria-label="This dish against today's target"
    >
      {ROWS.map((r) => {
        const goal = target[r.goal];
        const before = eaten[r.key];
        const add = Math.round(dish[r.key]);
        const total = before + add;
        const over = total > goal;
        const scale = Math.max(goal, total) || 1;
        const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`;
        return (
          <div key={r.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[10px] tracking-[0.5px] text-ink-muted uppercase">
                {r.label}
              </span>
              <span className={`text-xl font-semibold ${r.text}`}>
                +{add}
                <span className="text-xs">{r.unit === "g" ? "g" : " kcal"}</span>
              </span>
            </div>
            <div className="relative flex h-2.5 overflow-hidden rounded-[5px] bg-sand">
              <div
                className={`h-full ${r.bar} opacity-45`}
                style={{ width: pct(before) }}
              />
              <div
                className={`h-full ${over ? "bg-terracotta" : r.bar}`}
                style={{ width: pct(add) }}
              />
              {over && (
                <div
                  aria-hidden="true"
                  className="absolute inset-y-0 w-0.5 bg-ink"
                  style={{ left: pct(goal) }}
                />
              )}
            </div>
            <span className="font-mono text-[11px] text-ink-muted">
              {meals === null
                ? "…"
                : over
                  ? `${total - goal} ${r.unit} over · ${before} eaten + ${add} of ${goal}`
                  : `${before} eaten + ${add} → ${goal - total} ${r.unit} left of ${goal}`}
            </span>
          </div>
        );
      })}
      <div className="flex items-center gap-3 font-mono text-[10px] text-ink-muted uppercase">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-green opacity-45" /> Eaten today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-green" /> This dish
        </span>
      </div>
    </div>
  );
}
