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

const MACROS = [
  { key: "protein", label: "Protein", goal: "proteinG", text: "text-green", bar: "bg-green" },
  { key: "carbs", label: "Carbs", goal: "carbsG", text: "text-bronze", bar: "bg-bronze" },
  { key: "fat", label: "Fat", goal: "fatG", text: "text-terracotta-text", bar: "bg-terracotta" },
] as const;

/** Desktop bite check, for a member: a calories bar, and the Protein / Carbs / Fat boxes each with a bar of the day's
 *  target: what is already eaten today (paler) and what this dish adds on top. Today's meals are loaded in the browser
 *  (a day is the person's own). The Weight box has no target, so no bar. */
export function DishDayBars({
  target,
  dish,
  weight,
}: {
  target: TargetLike;
  dish: Dish;
  weight: number;
}) {
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
    <div className="flex flex-col gap-3.5" aria-busy={meals === null}>
      <Bar
        label="Of today's calories"
        unit="kcal"
        before={eaten.kcal}
        add={Math.round(dish.kcal)}
        goal={target.kcal}
        bar="bg-green"
        loading={meals === null}
        thin
      />
      <div className="grid grid-cols-2 gap-2.5">
        {MACROS.map((m) => (
          <div
            key={m.key}
            className="flex flex-col gap-1.5 rounded-row bg-bg p-3"
          >
            <span className="font-mono text-[9px] text-ink-muted uppercase">
              {m.label}
            </span>
            <span className={`text-xl font-semibold ${m.text}`}>
              {dish[m.key]}g
            </span>
            <Bar
              unit="g"
              before={eaten[m.key]}
              add={Math.round(dish[m.key])}
              goal={target[m.goal]}
              bar={m.bar}
              loading={meals === null}
            />
          </div>
        ))}
        <div className="flex flex-col gap-0.5 rounded-row bg-bg p-3">
          <span className="font-mono text-[9px] text-ink-muted uppercase">
            Weight
          </span>
          <span className="text-xl font-semibold">{weight}g</span>
        </div>
      </div>
      <div className="flex items-center gap-3 font-mono text-[10px] text-ink-muted uppercase">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-green opacity-45" /> Eaten today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-green" /> This dish
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-0.5 bg-ink" /> Target
        </span>
      </div>
    </div>
  );
}

function Bar({
  label,
  unit,
  before,
  add,
  goal,
  bar,
  loading,
  thin = false,
}: {
  label?: string;
  unit: string;
  before: number;
  add: number;
  goal: number;
  bar: string;
  loading: boolean;
  thin?: boolean;
}) {
  const total = before + add;
  const over = total > goal;
  const scale = Math.max(goal, total) || 1;
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`;
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="img"
        aria-label={`${before} eaten plus ${add} of ${goal} ${unit}`}
        className={`relative flex overflow-hidden rounded-[5px] bg-sand ${thin ? "h-2" : "h-2.5"}`}
      >
        <div className="flex h-full w-full animate-[bar-reveal_0.9s_cubic-bezier(0.2,0.8,0.2,1)_both]">
          <div
            className={`h-full ${bar} opacity-45 transition-[width] duration-500`}
            style={{ width: pct(before) }}
          />
          <div
            className={`h-full ${over ? "bg-terracotta" : bar} transition-[width] duration-500`}
            style={{ width: pct(add) }}
          />
        </div>
        {over && (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 w-0.5 bg-ink"
            style={{ left: pct(goal) }}
          />
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 font-mono text-[10px] text-ink-muted">
        <span className="whitespace-nowrap">
          {label ?? `${total} / ${goal}${unit === "g" ? "g" : ""}`}
        </span>
        <span
          className={`whitespace-nowrap ${over ? "text-terracotta-text" : ""}`}
        >
          {loading
            ? "…"
            : over
              ? `${total - goal} ${unit} over`
              : `${goal - total} ${unit} left`}
        </span>
      </div>
    </div>
  );
}
