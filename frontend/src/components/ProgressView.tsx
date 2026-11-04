"use client";

import { useCallback, useEffect, useState } from "react";
import { Eyebrow } from "@/components/Type";
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
  type DayMeal,
  type Weigh,
} from "@/lib/progress";
import { createClient } from "@/lib/supabase/client";

// Progress (design/screens/Progress.dc.html): the last 7 days against the target, the streak, the weight
// trend, the protein average and a note from rules in code. Loaded in the browser because "a day" is the
// person's own local day.

type Data = { meals: DayMeal[]; weighs: Weigh[]; logged: string[]; now: Date };
type State = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; data: Data };

const n0 = (n: number) => n.toLocaleString("en-US");
const BAR_AREA = 96; // px, the height of a bar at 100% of the target

export function ProgressView({ target }: { target: TargetLike | null }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return setState({ kind: "error", message: "Accounts aren't switched on." });
    const now = new Date();
    const since = lastDays(now, 60)[0]; // 60 days of dates: enough for the streak and the weight trend
    const [meals, weights] = await Promise.all([
      supabase.from("meals").select("eaten_on,kcal,protein_g").gte("eaten_on", since).limit(2000),
      supabase.from("weights").select("logged_on,kg").gte("logged_on", since).order("logged_on", { ascending: true }),
    ]);
    const error = meals.error ?? weights.error;
    if (error) return setState({ kind: "error", message: friendlyProgressError(error) });
    const rows = (meals.data ?? []).map((r) => ({ eatenOn: String(r.eaten_on), kcal: Number(r.kcal), protein: Number(r.protein_g) }));
    setState({
      kind: "ready",
      data: {
        meals: rows,
        logged: rows.map((r) => r.eatenOn),
        weighs: (weights.data ?? []).map((r) => ({ loggedOn: String(r.logged_on), kg: Number(r.kg) })),
        now,
      },
    });
  }, []);

  useEffect(() => {
    // load() is async: it only sets state after the request returns
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (state.kind === "loading") {
    return (
      <div role="status" aria-label="Loading progress" className="flex flex-col gap-4">
        <div className="h-[220px] animate-pulse rounded-hero bg-sand" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="h-[110px] animate-pulse rounded-row bg-sand/70" />
          <div className="h-[110px] animate-pulse rounded-row bg-sand/70" />
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

  const { data } = state;
  const today = localDate(data.now);
  const days = lastDays(data.now);
  const bars = dayBars(data.meals, days, today, target);
  const stats = weekStats(bars);
  const run = streak(data.logged, data.now);
  const trend = weightTrend(data.weighs);

  return (
    <>
      {run > 0 && (
        <span className="w-fit rounded-badge bg-green-tint px-2.5 py-1 font-mono text-[10px] tracking-[1px] text-green uppercase">
          {run}-day streak
        </span>
      )}

      <section className="flex flex-col gap-3 rounded-hero bg-surface p-[18px] shadow-card">
        <div className="flex items-baseline justify-between gap-2">
          <Eyebrow>Calories vs target</Eyebrow>
          {stats.avgKcal !== null && (
            <span className="font-mono text-[10px] text-ink-muted">
              avg {n0(stats.avgKcal)}
              {target ? ` / ${n0(target.kcal)}` : ""}
            </span>
          )}
        </div>
        <Bars bars={bars} target={target} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
          <Legend color="bg-green" label="On target" />
          <Legend color="bg-terracotta" label="Over" />
          <Legend color="bg-sand-dark" label="Today" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <WeightCard trend={trend} onSaved={load} now={data.now} />
        <div className="flex flex-col gap-1.5 rounded-row bg-surface p-3 shadow-row">
          <Eyebrow>Protein avg</Eyebrow>
          <span className="font-brand text-[28px] leading-none text-green">
            {stats.avgProtein === null ? "–" : `${stats.avgProtein}`}
            <span className="font-sans text-xs font-normal text-ink-muted"> g / day</span>
          </span>
          <span className="text-xs text-ink-muted">{target ? `target ${target.proteinG} g` : "set your profile for a target"}</span>
        </div>
      </div>

      <section className="flex flex-col gap-1.5 rounded-hero bg-green-tint p-[18px]">
        <Eyebrow>Buddy&apos;s note</Eyebrow>
        <p className="text-sm">{buddyNote(stats, run, target)}</p>
      </section>
    </>
  );
}

function friendlyProgressError(err: { code?: string; message?: string; status?: number }) {
  const text = (err.message ?? "").toLowerCase();
  if (err.code === "42P01" || err.code === "PGRST205" || text.includes("could not find the table")) {
    return "Progress isn't set up yet: a table is missing from the database (run the latest migration).";
  }
  return friendlyMealError(err);
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={`size-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function Bars({ bars, target }: { bars: DayBar[]; target: TargetLike | null }) {
  // The scale: the target (dashed line) at 96 px; a bigger day grows past it, up to 1.5x.
  const scale = (kcal: number) => (target ? Math.min(1.5, kcal / target.kcal) * BAR_AREA : 0);
  const none = bars.every((b) => !b.logged);
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="img"
        aria-label={bars.map((b) => `${b.weekday} ${b.logged ? `${b.kcal} kcal` : "nothing logged"}`).join(", ")}
        className="relative flex items-end gap-2"
        style={{ height: BAR_AREA * 1.5 }}
      >
        {target && (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-dashed border-dash"
            style={{ bottom: BAR_AREA }}
          />
        )}
        {bars.map((b) => (
          <div key={b.date} className="flex flex-1 items-end justify-center" style={{ height: "100%" }}>
            <div
              className={`w-full max-w-7 rounded-t-md ${b.today ? "bg-sand-dark" : b.over ? "bg-terracotta" : "bg-green"}`}
              style={{ height: b.logged ? Math.max(4, scale(b.kcal)) : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {bars.map((b) => (
          <span
            key={b.date}
            className={`flex-1 text-center font-mono text-[10px] uppercase ${b.today ? "font-bold text-ink" : "text-ink-muted"}`}
          >
            {b.weekday.charAt(0)}
          </span>
        ))}
      </div>
      {none && <p className="text-xs text-ink-muted">Nothing logged in the last 7 days yet.</p>}
    </div>
  );
}

function WeightCard({ trend, onSaved, now }: { trend: ReturnType<typeof weightTrend>; onSaved: () => void; now: Date }) {
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
    const { error } = (await createClient()?.from("weights").upsert(row, { onConflict: "user_id,logged_on" })) ?? {
      error: { message: "off" },
    };
    setSaving(false);
    if (error) return setError(friendlyProgressError(error));
    setText("");
    onSaved();
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-row bg-surface p-3 shadow-row">
      <Eyebrow>Weight trend</Eyebrow>
      <span className="font-brand text-[28px] leading-none text-green">
        {trend ? trend.kg : "–"}
        <span className="font-sans text-xs font-normal text-ink-muted"> kg</span>
      </span>
      <span className="text-xs text-ink-muted">
        {!trend
          ? "Log your weight to see a trend."
          : trend.change === null
            ? "Log again to see the change."
            : `${trend.change > 0 ? "+" : trend.change < 0 ? "−" : ""}${Math.abs(trend.change)} kg in ${trend.days} days`}
      </span>
      <form onSubmit={save} className="mt-1 flex gap-1.5">
        <input
          aria-label="Today's weight in kg"
          inputMode="decimal"
          placeholder="kg today"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-field border border-border bg-bg px-2 text-[13px] outline-none focus:border-green"
        />
        <button
          type="submit"
          disabled={saving || text.trim() === ""}
          className="h-9 cursor-pointer rounded-field bg-green px-2.5 text-[13px] font-semibold text-bg disabled:opacity-50"
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
