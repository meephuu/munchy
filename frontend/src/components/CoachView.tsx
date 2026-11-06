"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Chip } from "@/components/Chip";
import { PlusIcon } from "@/components/Icons";
import { Eyebrow, Title } from "@/components/Type";
import catalogJson from "@/lib/catalog.json";
import {
  COACH_TABS,
  ideasFor,
  roomLeft,
  type CatalogDish,
  type CoachTab,
} from "@/lib/coach";
import {
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

const catalog = catalogJson as CatalogDish[];

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; meals: Meal[]; now: Date };

const n0 = (n: number) => n.toLocaleString("en-US");

/** Coach (design/screens/Coach.dc.html): the room left today and dishes that fit it. Loaded in the browser because
 *  "today" is the person's own day. Ideas come from our own dish catalog; there is no place data, so no "near me". */
export function CoachView({ target }: { target: TargetLike | null }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [tab, setTab] = useState<CoachTab>("fit");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (!supabase)
        return setState({
          kind: "error",
          message: "Accounts aren't switched on.",
        });
      const { data, error } = await supabase
        .from("meals")
        .select("*")
        .eq("eaten_on", localDate(new Date()))
        .order("eaten_at", { ascending: true });
      if (cancelled) return;
      if (error)
        return setState({ kind: "error", message: friendlyMealError(error) });
      setState({
        kind: "ready",
        meals: (data ?? [])
          .map(mealFromRow)
          .filter((m): m is Meal => m !== null),
        now: new Date(),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <div
        role="status"
        aria-label="Loading"
        className="h-[150px] animate-pulse rounded-hero bg-sand"
      />
    );
  }
  if (state.kind === "error") {
    return (
      <section
        role="alert"
        className="rounded-hero bg-terracotta-tint p-[18px] text-sm"
      >
        {state.message}
      </section>
    );
  }
  if (!target) {
    return (
      <section className="flex flex-col gap-2 rounded-hero bg-terracotta-tint p-[18px]">
        <Eyebrow tone="terracotta">One more step</Eyebrow>
        <p className="text-sm">
          I need your daily target to suggest what fits. Set up your profile
          first.
        </p>
        <Link href="/onboarding" className="text-sm font-semibold">
          Set up my profile
        </Link>
      </section>
    );
  }

  const { meals, now } = state;
  const totals = dayTotals(meals, target);
  const left = roomLeft(target, totals.eaten);
  const all = ideasFor(
    catalog,
    left,
    meals.map((m) => m.title),
    tab,
    6,
  );
  const next = nextSlot(now, meals);
  const m = totals.macros;

  return (
    <>
      <div className="flex flex-col gap-1 desk:gap-2">
        <Eyebrow>
          Coach{next ? ` · ${slotLabel(next)}` : ""} · {timeLabel(now)}
        </Eyebrow>
        <Title
          lead="What should I eat,"
          accent="and how much?"
          className="text-[26px] desk:text-4xl"
        />
      </div>

      <div className="flex flex-col gap-4 desk:flex-row desk:flex-wrap desk:items-start desk:gap-6">
        <div className="flex min-w-0 flex-col gap-4 desk:flex-[1_1_300px] desk:gap-5">
          <section className="flex flex-col gap-1.5 rounded-hero bg-surface p-[18px] shadow-card desk:gap-3 desk:p-[26px]">
            <Eyebrow>Room left today</Eyebrow>
            <div className="flex items-baseline gap-2">
              <span
                className={`font-brand text-[40px] leading-none desk:text-[56px] ${left.kcal < 0 ? "text-terracotta" : "text-green"}`}
              >
                {n0(Math.abs(left.kcal))}
              </span>
              <span className="text-[15px] font-semibold desk:text-base">
                kcal {left.kcal < 0 ? "over" : "left"}
              </span>
            </div>
            <span className="text-[13px] text-ink-muted desk:text-sm">
              {left.protein > 0
                ? `and ${left.protein} g protein to go`
                : "protein goal reached"}
            </span>
            {m && (
              <div className="hidden flex-col gap-3 pt-2 desk:flex">
                <LeftBar
                  label="Protein"
                  eaten={m.protein.eaten}
                  goal={m.protein.goal}
                  pct={m.protein.pct}
                  bar="bg-green"
                />
                <LeftBar
                  label="Carbs"
                  eaten={m.carbs.eaten}
                  goal={m.carbs.goal}
                  pct={m.carbs.pct}
                  bar="bg-bronze-light"
                />
                <LeftBar
                  label="Fat"
                  eaten={m.fat.eaten}
                  goal={m.fat.goal}
                  pct={m.fat.pct}
                  bar="bg-terracotta"
                />
              </div>
            )}
          </section>

          {meals.length > 0 && (
            <section className="hidden flex-col rounded-hero bg-surface px-[26px] py-[22px] shadow-card desk:flex">
              <div className="flex items-baseline justify-between pb-2">
                <Eyebrow tone="muted">Eaten so far</Eyebrow>
                <Link href="/home" className="text-[13px] font-semibold">
                  Home
                </Link>
              </div>
              {meals.map((meal) => (
                <div
                  key={meal.id}
                  className="flex items-center gap-3 border-t border-divider py-2.5"
                >
                  <span className="w-[42px] font-mono text-[11px] text-bronze">
                    {timeLabel(meal.eatenAt)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {meal.title}
                  </span>
                  <span className="text-sm font-semibold text-green">
                    {Math.round(meal.kcal)}
                  </span>
                </div>
              ))}
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4 desk:flex-[2_1_520px] desk:gap-[18px]">
          {left.kcal <= 0 ? (
            <section className="rounded-card bg-green-tint p-4 text-sm">
              You&apos;ve reached today&apos;s target, so there&apos;s nothing
              more to plan. Tomorrow starts at 2 am.
            </section>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {COACH_TABS.map((t) => (
                    <Chip
                      key={t.id}
                      selected={tab === t.id}
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                    </Chip>
                  ))}
                </div>
                <span className="hidden font-mono text-[10px] tracking-[1px] text-ink-muted uppercase desk:block">
                  {all.length} {all.length === 1 ? "idea fits" : "ideas fit"}
                </span>
              </div>

              {all.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  Nothing in our list fits {n0(left.kcal)} kcal right now. A
                  small snack, or search any dish above.
                </p>
              ) : (
                <>
                  <ul className="flex flex-col gap-2.5 desk:hidden">
                    {all.slice(0, 3).map((d) => (
                      <li key={d.title}>
                        <Link
                          href={`/dish?q=${encodeURIComponent(d.title)}`}
                          className="flex items-center gap-3 rounded-row bg-surface px-3.5 py-3 text-ink shadow-row"
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="truncate text-[15px] font-semibold">
                              {d.title}
                            </span>
                            <span className="font-mono text-[10px] tracking-[1px] text-ink-muted uppercase">
                              1 serving · C {d.carbs} g · F {d.fat} g
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-sm font-semibold">
                              {d.kcal} kcal
                            </span>
                            <span className="rounded-badge bg-green-tint px-2 py-0.5 font-mono text-[10px] text-green">
                              P {d.protein} g
                            </span>
                          </span>
                          <span
                            aria-hidden="true"
                            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green text-bg"
                          >
                            <PlusIcon size={18} />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>

                  <ul className="hidden gap-4 desk:grid desk:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
                    {all.map((d) => (
                      <li key={d.title}>
                        <Link
                          href={`/dish?q=${encodeURIComponent(d.title)}`}
                          className="flex h-full flex-col gap-3.5 rounded-row bg-surface p-5 text-ink shadow-row hover:shadow-card"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-[17px] leading-[1.3] font-semibold">
                              {d.title}
                            </span>
                            <span
                              aria-hidden="true"
                              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green text-bg"
                            >
                              <PlusIcon size={18} />
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-brand text-[30px] leading-none text-green">
                              {d.kcal}
                            </span>
                            <span className="text-[13px] font-semibold">
                              kcal
                            </span>
                            <span className="ml-auto font-mono text-[10px] text-ink-muted">
                              1 serving
                            </span>
                          </div>
                          <div
                            className="h-1.5 overflow-hidden rounded-[3px] bg-sand"
                            aria-hidden="true"
                          >
                            <div
                              className="h-1.5 rounded-[3px]"
                              style={{
                                width: `${Math.min(100, Math.round((d.kcal / left.kcal) * 100))}%`,
                                background:
                                  "linear-gradient(90deg, #1D5C3A, #B7893A)",
                              }}
                            />
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="rounded-badge bg-green-tint px-2 py-[3px] font-mono text-[10px] text-green">
                              P {d.protein} g
                            </span>
                            <span className="rounded-badge bg-bronze-tint px-2 py-[3px] font-mono text-[10px] text-bronze">
                              C {d.carbs} g
                            </span>
                            <span className="rounded-badge bg-terracotta-tint px-2 py-[3px] font-mono text-[10px] text-terracotta-text">
                              F {d.fat} g
                            </span>
                          </div>
                          <span className="text-xs text-ink-muted">
                            Leaves ~
                            {n0(Math.round((left.kcal - d.kcal) / 10) * 10)}{" "}
                            kcal for the rest of today
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="text-xs text-ink-muted">
                Ideas come from our own estimates and are approximate. Tap one
                to see the full breakdown and log it.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function LeftBar({
  label,
  eaten,
  goal,
  pct,
  bar,
}: {
  label: string;
  eaten: number;
  goal: number;
  pct: number;
  bar: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[13px]">
        <span>{label}</span>
        <span className="font-mono text-[11px] text-ink-muted">
          {Math.max(0, goal - eaten)} g left of {goal}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-[3px] bg-sand">
        <div className={`h-1.5 ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
