"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalorieRing } from "@/components/CalorieRing";
import { ArrowRightIcon, TrashIcon } from "@/components/Icons";
import { Eyebrow, Title } from "@/components/Type";
import {
  dayLabel,
  dayTotals,
  friendlyMealError,
  localDate,
  mealFromRow,
  nextSlot,
  slotLabel,
  timeLabel,
  type Meal,
  type TargetLike,
} from "@/lib/meals";
import { createClient } from "@/lib/supabase/client";

// Today on Home (design/screens/Main.dc.html): calories left with the ring, the three macros, and the meals
// logged today. It loads in the browser because "today" is the person's own local day, which the server
// cannot know (a server clock in another timezone would show the wrong day).

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; meals: Meal[]; now: Date };

const roundTo10 = (n: number) => Math.round(n / 10) * 10;
const n0 = (n: number) => n.toLocaleString("en-US");

export function HomeToday({ target }: { target: TargetLike | null }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [confirming, setConfirming] = useState<string | null>(null); // id of the meal asking "delete?"
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (!supabase) return setState({ kind: "error", message: "Accounts aren't switched on." });
      const { data, error } = await supabase
        .from("meals")
        .select("*")
        .eq("eaten_on", localDate(new Date()))
        .order("eaten_at", { ascending: true });
      if (cancelled) return;
      if (error) return setState({ kind: "error", message: friendlyMealError(error) });
      const meals = (data ?? []).map(mealFromRow).filter((m): m is Meal => m !== null);
      setState({ kind: "ready", meals, now: new Date() });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(id: string) {
    if (state.kind !== "ready") return;
    const before = state;
    setConfirming(null);
    setNotice(null);
    setState({ ...before, meals: before.meals.filter((m) => m.id !== id) }); // gone at once; back if it fails
    const { error } = await (createClient()?.from("meals").delete().eq("id", id) ?? { error: { message: "off" } });
    if (error) {
      setState(before);
      setNotice(friendlyMealError(error));
    }
  }

  if (state.kind === "loading") {
    return (
      <div role="status" aria-label="Loading today" className="flex flex-col gap-4">
        <div className="h-[196px] animate-pulse rounded-hero bg-sand" />
        <div className="grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-row bg-sand/70" />
          ))}
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <section role="alert" className="rounded-hero bg-terracotta-tint p-[18px] text-sm">
        {state.message}
      </section>
    );
  }

  const { meals, now } = state;
  const totals = dayTotals(meals, target);
  const next = nextSlot(now, meals);
  const left = totals.left;

  return (
    <>
      <section className="flex flex-col gap-3.5 rounded-hero bg-surface p-[18px] shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <Eyebrow>{dayLabel(now)}</Eyebrow>
            <span
              className={`font-brand text-[42px] leading-none ${totals.over ? "text-terracotta" : "text-green"}`}
            >
              {n0(left === null ? totals.eaten.kcal : Math.abs(left))}
            </span>
            <span className="text-[13px]">
              {target && left !== null ? (
                <>
                  kcal {left >= 0 ? "left of" : "over your"} <b>{n0(target.kcal)}</b>
                </>
              ) : (
                "kcal eaten today"
              )}
            </span>
          </div>
          <CalorieRing
            pct={totals.pct ?? 0}
            over={totals.over}
            label={totals.pct === null ? "Calories eaten today" : `${totals.pct}% of daily calories eaten`}
          />
        </div>
        {totals.pct !== null && (
          <div className="h-2.5 overflow-hidden rounded-[5px] bg-sand">
            <div
              className="h-2.5 rounded-[5px]"
              style={{
                width: `${Math.min(100, totals.pct)}%`,
                background: totals.over ? "var(--color-terracotta)" : "linear-gradient(90deg, #1D5C3A, #B7893A)",
              }}
            />
          </div>
        )}
        <span className="text-xs text-ink-muted">
          {n0(totals.eaten.kcal)} eaten · {totals.count} {totals.count === 1 ? "meal" : "meals"}
          {totals.pct !== null && (
            <>
              {" "}
              · <b className="text-ink">{totals.pct} %</b> of your day
            </>
          )}
        </span>
      </section>

      <div className="grid grid-cols-3 gap-2.5">
        <MacroCard label="Protein" eaten={totals.eaten.protein} progress={totals.macros?.protein} text="text-green" bar="bg-green" />
        <MacroCard label="Carbs" eaten={totals.eaten.carbs} progress={totals.macros?.carbs} text="text-bronze" bar="bg-bronze-light" />
        <MacroCard label="Fat" eaten={totals.eaten.fat} progress={totals.macros?.fat} text="text-terracotta-text" bar="bg-terracotta" />
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Title as="h2" lead="Today's bites" className="text-lg" />
          <Link href="/progress" className="text-xs font-semibold">
            See week
          </Link>
        </div>

        {notice && (
          <p role="alert" className="rounded-card bg-terracotta-tint px-3.5 py-2.5 text-[13px]">
            {notice}
          </p>
        )}

        {meals.length === 0 ? (
          <Link
            href="/add"
            className="flex items-center gap-3 rounded-row border-[1.5px] border-dashed border-dash px-3.5 py-2.5 text-ink"
          >
            <span className="w-10 font-mono text-[11px] text-bronze">TODAY</span>
            <span className="flex-1 text-sm">Nothing logged yet. Log your first bite.</span>
            <ArrowRightIcon size={18} className="text-green" />
          </Link>
        ) : (
          <ul className="flex flex-col gap-2">
            {meals.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-row bg-surface px-3.5 py-2.5 shadow-row">
                <span className="w-10 shrink-0 font-mono text-[11px] text-bronze">{timeLabel(m.eatenAt)}</span>
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block truncate first-letter:uppercase">{m.title}</span>
                  <span className="font-mono text-[9px] tracking-[1px] text-ink-muted uppercase">{slotLabel(m.slot)}</span>
                </span>
                {confirming === m.id ? (
                  <span className="flex items-center gap-1 text-[13px] font-semibold">
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      className="min-h-9 cursor-pointer px-2 text-terracotta-text"
                    >
                      Delete
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className="min-h-9 cursor-pointer px-2 text-ink-muted">
                      Keep
                    </button>
                  </span>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-green">{Math.round(m.kcal)}</span>
                    <button
                      type="button"
                      aria-label={`Delete ${m.title}`}
                      onClick={() => setConfirming(m.id)}
                      className="-mr-1.5 flex size-9 shrink-0 cursor-pointer items-center justify-center text-ink-muted"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {left !== null && left > 0 && next && meals.length > 0 && (
          <Link
            href="/coach"
            className="flex items-center gap-3 rounded-row border-[1.5px] border-dashed border-dash px-3.5 py-2.5 text-ink"
          >
            <span className="w-10 font-mono text-[11px] text-bronze">NEXT</span>
            <span className="flex-1 text-sm">
              {slotLabel(next)} — need ideas? <span className="text-ink-muted">~{n0(roundTo10(left))} kcal left</span>
            </span>
            <ArrowRightIcon size={18} className="text-green" />
          </Link>
        )}
      </section>
    </>
  );
}

function MacroCard({
  label,
  eaten,
  progress,
  text,
  bar,
}: {
  label: string;
  eaten: number;
  progress: { goal: number; pct: number } | undefined;
  text: string;
  bar: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-row bg-surface p-3 shadow-row">
      <span className="font-mono text-[9px] font-bold tracking-[1px] text-bronze uppercase">{label}</span>
      <span className={`text-lg font-semibold ${text}`}>
        {eaten}
        {progress && <span className="text-xs font-normal text-ink-muted"> / {progress.goal} g</span>}
        {!progress && <span className="text-xs font-normal text-ink-muted"> g</span>}
      </span>
      {progress && (
        <div className="h-1.5 overflow-hidden rounded-[3px] bg-sand">
          <div className={`h-1.5 ${bar}`} style={{ width: `${progress.pct}%` }} />
        </div>
      )}
    </div>
  );
}
