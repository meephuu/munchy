"use client";

import Link from "next/link";
import { Eyebrow } from "@/components/Type";
import { useWeek } from "@/components/useWeek";
import { localDate, type TargetLike } from "@/lib/meals";
import { dayBars, lastDays, streak } from "@/lib/progress";

const AREA = 64; // px: a bar at 100% of the target

/** "This week" on the desktop Home side column: seven small bars against the target and the streak; links to Progress. */
export function WeekMini({ target }: { target: TargetLike | null }) {
  const { state } = useWeek();
  if (state.kind === "loading") {
    return (
      <div
        role="status"
        aria-label="Loading week"
        className="h-[170px] animate-pulse rounded-hero bg-sand"
      />
    );
  }
  if (state.kind === "error") return null;

  const { data } = state;
  const bars = dayBars(
    data.meals,
    lastDays(data.now),
    localDate(data.now),
    target,
  );
  const run = streak(data.logged, data.now);
  const scale = (kcal: number) =>
    target ? Math.min(1.5, kcal / target.kcal) * AREA : 0;

  return (
    <Link
      href="/progress"
      className="flex flex-col gap-3 rounded-hero bg-surface p-[22px] text-ink shadow-card hover:shadow-panel"
    >
      <div className="flex items-baseline justify-between gap-2">
        <Eyebrow>This week</Eyebrow>
        {run > 0 && (
          <span className="rounded-badge bg-green-tint px-2 py-0.5 font-mono text-[10px] tracking-[1px] text-green uppercase">
            {run}-day streak
          </span>
        )}
      </div>
      <div
        className="flex items-end gap-1.5"
        style={{ height: AREA * 1.5 }}
        role="img"
        aria-label="Calories for the last 7 days"
      >
        {bars.map((b) => (
          <div
            key={b.date}
            className="flex flex-1 items-end justify-center"
            style={{ height: "100%" }}
          >
            <div
              className={`w-full max-w-5 rounded-t ${b.today ? "bg-sand-dark" : b.over ? "bg-terracotta" : "bg-green"}`}
              style={{ height: b.logged ? Math.max(3, scale(b.kcal)) : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        {bars.map((b) => (
          <span
            key={b.date}
            className={`flex-1 text-center font-mono text-[10px] uppercase ${b.today ? "font-bold text-ink" : "text-ink-muted"}`}
          >
            {b.weekday.charAt(0)}
          </span>
        ))}
      </div>
      <span className="text-[13px] font-semibold text-green">See progress</span>
    </Link>
  );
}
