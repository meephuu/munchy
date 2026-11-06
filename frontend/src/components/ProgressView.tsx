"use client";

import Image from "next/image";
import { useState } from "react";
import { CountUp } from "@/components/CountUp";
import { Eyebrow, Title } from "@/components/Type";
import { useWeek } from "@/components/useWeek";
import { friendlyMealError, localDate, type TargetLike } from "@/lib/meals";
import {
  buddyNote,
  dayBars,
  lastDays,
  streak,
  weekStats,
  weighToInsert,
  weightTrend,
  type DayBar,
} from "@/lib/progress";
import { createClient } from "@/lib/supabase/client";

// Progress (design/screens/Progress.dc.html, desktop/Progress.dc.html): the last 7 days against the target, the
// streak, the weight trend, the protein average and a note from rules in code. Loaded in the browser because
// "a day" is the person's own local day.

const n0 = (n: number) => n.toLocaleString("en-US");
const TARGET_AT = 60; // the target line sits this far up the chart (percent); a bigger day grows past it, up to 1.5x

export function ProgressView({ target }: { target: TargetLike | null }) {
  const { state, reload } = useWeek();

  const header = (run: number) => (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1 desk:gap-2">
        <Eyebrow>Progress · last 7 days</Eyebrow>
        <Title
          lead="Your week,"
          accent="at a glance"
          className="text-[26px] desk:text-4xl"
        />
      </div>
      {run > 0 && (
        <span className="rounded-badge bg-green-tint px-2.5 py-1 font-mono text-[10px] tracking-[1px] text-green uppercase desk:rounded-[8px] desk:px-3.5 desk:py-2 desk:text-xs desk:font-bold">
          {run}-day streak
        </span>
      )}
    </div>
  );

  if (state.kind === "loading") {
    return (
      <>
        {header(0)}
        <div
          role="status"
          aria-label="Loading progress"
          className="flex flex-col gap-4"
        >
          <div className="h-[220px] animate-pulse rounded-hero bg-sand desk:h-[400px]" />
          <div className="grid grid-cols-2 gap-2.5">
            <div className="h-[110px] animate-pulse rounded-row bg-sand/70" />
            <div className="h-[110px] animate-pulse rounded-row bg-sand/70" />
          </div>
        </div>
      </>
    );
  }
  if (state.kind === "error") {
    return (
      <>
        {header(0)}
        <section
          role="alert"
          className="rounded-hero bg-terracotta-tint p-[18px] text-sm"
        >
          {friendlyProgressError(state.error)}
        </section>
      </>
    );
  }

  const { data } = state;
  const today = localDate(data.now);
  const bars = dayBars(data.meals, lastDays(data.now), today, target);
  const stats = weekStats(bars);
  const run = streak(data.logged, data.now);
  const trend = weightTrend(data.weighs);

  return (
    <>
      {header(run)}

      <div className="flex flex-col gap-4 desk:flex-row desk:flex-wrap desk:items-stretch desk:gap-6">
        <section className="flex min-w-0 flex-col gap-3 rounded-hero bg-surface p-[18px] shadow-card desk:flex-[2_1_560px] desk:gap-[18px] desk:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2 desk:gap-3">
            <Eyebrow>Calories vs target</Eyebrow>
            {stats.avgKcal !== null && (
              <span className="font-mono text-[10px] text-ink-muted desk:font-sans desk:text-sm">
                avg{" "}
                <b className="text-ink">
                  <CountUp value={stats.avgKcal} />
                </b>
                {target ? ` / ${n0(target.kcal)}` : ""}
                <span className="hidden desk:inline"> kcal</span>
              </span>
            )}
          </div>
          <Bars bars={bars} target={target} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted desk:gap-x-5 desk:text-[13px]">
            <Legend color="bg-green" label="On target" />
            <Legend color="bg-terracotta" label="Over" />
            <Legend color="bg-sand-dark" label="Today" />
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2.5 desk:flex desk:min-w-0 desk:flex-[1_1_280px] desk:flex-col desk:gap-5">
          <WeightCard trend={trend} onSaved={reload} now={data.now} />
          <div className="flex flex-col gap-1.5 rounded-row bg-surface p-3 shadow-row desk:gap-2 desk:rounded-hero desk:p-[22px] desk:shadow-card">
            <Eyebrow>Protein avg</Eyebrow>
            <span className="font-brand text-[28px] leading-none text-green desk:text-[40px]">
              {stats.avgProtein === null ? (
                "–"
              ) : (
                <CountUp value={stats.avgProtein} />
              )}
              <span className="font-sans text-xs font-normal text-ink-muted desk:text-sm">
                {" "}
                g / day
              </span>
            </span>
            <span className="text-xs text-ink-muted desk:text-[13px]">
              {target
                ? `target ${target.proteinG} g`
                : "set your profile for a target"}
            </span>
          </div>
        </div>
      </div>

      <section className="flex items-center gap-5 rounded-hero bg-green-tint p-[18px] desk:px-7 desk:py-6">
        <Image
          src="/bowl.png"
          alt=""
          width={72}
          height={72}
          className="hidden shrink-0 desk:block"
        />
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Buddy&apos;s note</Eyebrow>
          <p className="text-sm desk:text-base desk:leading-normal">
            {buddyNote(stats, run, target)}
          </p>
        </div>
      </section>
    </>
  );
}

function friendlyProgressError(err: {
  code?: string;
  message?: string;
  status?: number;
}) {
  const text = (err.message ?? "").toLowerCase();
  if (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    text.includes("could not find the table")
  ) {
    return "Progress isn't set up yet: a table is missing from the database (run the latest migration).";
  }
  return err.message === "Accounts aren't switched on."
    ? err.message
    : friendlyMealError(err);
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={`size-2 rounded-full desk:size-2.5 ${color}`}
      />
      {label}
    </span>
  );
}

function Bars({ bars, target }: { bars: DayBar[]; target: TargetLike | null }) {
  // Heights are percentages of the chart, so one layout serves the phone (144 px) and the desktop (270 px).
  const heightOf = (kcal: number) =>
    target ? Math.min(1.5, kcal / target.kcal) * TARGET_AT : 0;
  const none = bars.every((b) => !b.logged);
  return (
    <div className="flex flex-col gap-1.5 desk:gap-2.5">
      <div
        role="img"
        aria-label={bars
          .map(
            (b) =>
              `${b.weekday} ${b.logged ? `${b.kcal} kcal` : "nothing logged"}`,
          )
          .join(", ")}
        className="relative flex h-36 items-end gap-2 desk:h-[270px] desk:gap-4"
      >
        {target && (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-x-0 border-t border-dashed border-dash"
              style={{ bottom: `${TARGET_AT}%` }}
            />
            <span
              aria-hidden="true"
              className="absolute right-0 hidden bg-surface pl-1.5 font-mono text-[10px] text-bronze desk:block"
              style={{ bottom: `calc(${TARGET_AT}% + 6px)` }}
            >
              TARGET {n0(target.kcal)}
            </span>
          </>
        )}
        {bars.map((b, i) => (
          <div
            key={b.date}
            className="flex h-full flex-1 flex-col items-center justify-end gap-2"
          >
            {b.logged && (
              <span
                className={`hidden font-mono text-[11px] desk:block ${b.over ? "text-terracotta-text" : "text-ink-muted"}`}
              >
                <CountUp value={b.kcal} />
              </span>
            )}
            <div
              className={`origin-bottom animate-[bar-rise_0.8s_cubic-bezier(0.2,0.8,0.2,1)_both] w-full max-w-7 rounded-t-md desk:max-w-14 desk:rounded-t-[10px] ${
                b.today ? "bg-sand-dark" : b.over ? "bg-terracotta" : "bg-green"
              }`}
              style={{
                height: b.logged ? `max(4px, ${heightOf(b.kcal)}%)` : 0,
                animationDelay: `${i * 70}ms`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 desk:gap-4">
        {bars.map((b) => (
          <span
            key={b.date}
            className={`flex-1 text-center font-mono text-[10px] uppercase desk:text-[11px] ${b.today ? "font-bold text-ink" : "text-ink-muted"}`}
          >
            <span className="desk:hidden">{b.weekday.charAt(0)}</span>
            <span className="hidden desk:inline">
              {b.today ? "Today" : b.weekday}
            </span>
          </span>
        ))}
      </div>
      {none && (
        <p className="text-xs text-ink-muted">
          Nothing logged in the last 7 days yet.
        </p>
      )}
    </div>
  );
}

function WeightCard({
  trend,
  onSaved,
  now,
}: {
  trend: ReturnType<typeof weightTrend>;
  onSaved: () => void;
  now: Date;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const row = weighToInsert(text, now);
    if (!row) return setError("Enter your weight in kg (30 to 250).");
    setSaving(true);
    setError(null);
    // one weigh-in per day: weighing again today replaces it
    const { error } = (await createClient()
      ?.from("weights")
      .upsert(row, { onConflict: "user_id,logged_on" })) ?? {
      error: { message: "off" },
    };
    setSaving(false);
    if (error) return setError(friendlyProgressError(error));
    setText("");
    onSaved();
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-row bg-surface p-3 shadow-row desk:gap-2 desk:rounded-hero desk:p-[22px] desk:shadow-card">
      <Eyebrow>Weight trend</Eyebrow>
      <span className="font-brand text-[28px] leading-none text-green desk:text-[40px]">
        {trend ? (
          <CountUp
            value={Math.round(trend.kg * 10)}
            format={(n) => (n / 10).toFixed(1)}
          />
        ) : (
          "–"
        )}
        <span className="font-sans text-xs font-normal text-ink-muted desk:text-sm">
          {" "}
          kg
        </span>
      </span>
      <span className="text-xs text-ink-muted desk:text-[13px]">
        {!trend
          ? "Log your weight to see a trend."
          : trend.change === null
            ? "Log again to see the change."
            : `${trend.change > 0 ? "+" : trend.change < 0 ? "−" : ""}${Math.abs(trend.change)} kg in ${trend.days} days`}
      </span>
      <form
        onSubmit={save}
        className="mt-1 flex gap-1.5 desk:mt-1.5 desk:gap-2"
      >
        <input
          aria-label="Today's weight in kg"
          inputMode="decimal"
          placeholder="kg today"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-field border border-border bg-bg px-2 text-[13px] outline-none focus:border-green desk:h-[42px] desk:px-3 desk:text-sm"
        />
        <button
          type="submit"
          disabled={saving || text.trim() === ""}
          className="h-9 cursor-pointer rounded-field bg-green px-2.5 text-[13px] font-semibold text-bg disabled:opacity-50 desk:h-[42px] desk:px-[18px] desk:text-sm"
        >
          Log
        </button>
      </form>
      {error && (
        <p role="alert" className="text-xs text-terracotta-text">
          {error}
        </p>
      )}
    </div>
  );
}
