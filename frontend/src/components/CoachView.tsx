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
  const ideas = ideasFor(
    catalog,
    left,
    meals.map((m) => m.title),
    tab,
  );
  const next = nextSlot(now, meals);

  return (
    <>
      <div className="flex flex-col gap-1">
        <Eyebrow>
          Coach{next ? ` · ${slotLabel(next)}` : ""} · {timeLabel(now)}
        </Eyebrow>
        <Title
          lead="What should I eat,"
          accent="and how much?"
          className="text-[26px]"
        />
      </div>

      <section className="flex flex-col gap-1.5 rounded-hero bg-surface p-[18px] shadow-card">
        <Eyebrow>Room left today</Eyebrow>
        <div className="flex items-baseline gap-2">
          <span
            className={`font-brand text-[40px] leading-none ${left.kcal < 0 ? "text-terracotta" : "text-green"}`}
          >
            {n0(Math.abs(left.kcal))}
          </span>
          <span className="text-[15px] font-semibold">
            kcal {left.kcal < 0 ? "over" : "left"}
          </span>
        </div>
        <span className="text-[13px] text-ink-muted">
          {left.protein > 0
            ? `and ${left.protein} g protein to go`
            : "protein goal reached"}
        </span>
      </section>

      {left.kcal <= 0 ? (
        <section className="rounded-card bg-green-tint p-4 text-sm">
          You&apos;ve reached today&apos;s target, so there&apos;s nothing more
          to plan. Tomorrow starts at 2 am.
        </section>
      ) : (
        <>
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

          {ideas.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Nothing in our list fits {n0(left.kcal)} kcal right now. A small
              snack, or search any dish above.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {ideas.map((d) => (
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
          )}
          <p className="text-xs text-ink-muted">
            Ideas come from our own estimates and are approximate. Tap one to
            see the full breakdown and log it.
          </p>
        </>
      )}
    </>
  );
}
