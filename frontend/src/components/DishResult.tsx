import Link from "next/link";
import { DishEcho } from "@/components/DishStates";
import { DishHeader } from "@/components/DishHeader";
import { ArrowRightIcon, LockIcon } from "@/components/Icons";
import { Screen } from "@/components/Screen";
import type { DishView } from "@/lib/estimate";

// Guest dish result (design/screens/GuestDish.dc.html), filled with the backend's estimate.
// Same content as the logged-in Bite check, but the bottom call to action sends the guest to
// sign up instead of logging. The place and tweak chips of the design are left out until the
// backend can really answer them.

export function DishResult({ query, view }: { query: string; view: DishView }) {
  return (
    <Screen>
      <div className="flex flex-col gap-3.5">
        <DishHeader />
        <DishEcho text={query} />

        <section className="flex flex-col gap-3.5 rounded-hero bg-olive p-[18px]">
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs">Estimated</span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-[44px] leading-none text-ink-strong">
                  {view.kcal}
                </span>
                <span className="text-sm">kcal</span>
              </div>
              <span className="text-xs">
                Range {view.low}–{view.high}
              </span>
            </div>
            <span className="rounded-full bg-teal px-2.5 py-1.5 text-xs text-cream">
              {view.confidence} confidence
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <MacroTile label="Protein" value={`${view.protein}g`} valueClass="text-teal" />
            <MacroTile label="Carbs" value={`${view.carbs}g`} valueClass="text-carbs-ink" />
            <MacroTile label="Fat" value={`${view.fat}g`} valueClass="text-fat-ink" />
            <MacroTile label="Weight" value={`${view.grams}g`} />
          </div>
        </section>

        {view.warnings.length > 0 && (
          <section role="note" className="rounded-card bg-swap-bg px-3.5 py-3">
            <ul className="flex flex-col gap-1 text-[13px]">
              {view.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col rounded-card bg-white px-3.5 py-1.5">
          {view.parts.map((part, i) => (
            <div key={i} className="flex items-center gap-2.5 border-b border-divider py-2">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ background: part.dot }}
              />
              <span className="flex-1 text-sm first-letter:uppercase">{part.name}</span>
              <span className="text-xs text-ink-muted">{part.amount}</span>
              <span className="w-11 text-right text-sm font-medium">{part.kcal}</span>
            </div>
          ))}
        </section>

        {view.assumptions.length > 0 && (
          <details className="rounded-card bg-white px-3.5 py-3">
            <summary className="cursor-pointer text-[13px] text-ink-muted">
              How we estimated this · {view.assumptions.length}{" "}
              {view.assumptions.length === 1 ? "assumption" : "assumptions"}
            </summary>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-xs text-ink-muted">
              {view.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <Link
        href="/onboarding"
        className="sticky bottom-5 mt-6 flex h-16 items-center gap-3 rounded-btn bg-teal px-[18px] text-cream"
      >
        <LockIcon size={22} className="shrink-0 text-yolk" />
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold">See how this fits your day</span>
          <span className="text-xs text-nav-inactive">Free account · log meals &amp; get coached</span>
        </span>
        <ArrowRightIcon size={20} />
      </Link>
    </Screen>
  );
}

function MacroTile({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-field bg-cream p-2">
      <span className="text-[11px] text-ink-muted">{label}</span>
      <span className={`text-[15px] font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}
