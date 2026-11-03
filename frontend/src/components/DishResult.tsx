"use client";

import Link from "next/link";
import { useState } from "react";
import { AmountEditor } from "@/components/AmountEditor";
import { DishHeader } from "@/components/DishHeader";
import { DishEcho } from "@/components/DishStates";
import { ArrowRightIcon, EditIcon, LockIcon } from "@/components/Icons";
import { Screen } from "@/components/Screen";
import { summarize, type Dish } from "@/lib/estimate";

// Guest dish result (design/screens/GuestDish.dc.html), filled with the backend's estimate.
// Same content as the logged-in Bite check, but the bottom call to action sends the guest to
// sign up instead of logging. Tap an ingredient to change its amount; totals follow.
// The design's place and tweak chips are left out until the backend can really answer them.

export function DishResult({ query, dish }: { query: string; dish: Dish }) {
  const estimated = dish.ingredients.map((i) => i.grams);
  const [grams, setGrams] = useState(estimated);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const view = summarize(dish, grams);

  const setAmount = (i: number, g: number) => setGrams((all) => all.map((v, j) => (j === i ? g : v)));

  return (
    <Screen>
      <div className="flex flex-col gap-3.5">
        <DishHeader />
        <DishEcho text={query} />

        <section className="flex flex-col gap-3.5 rounded-hero bg-olive p-[18px]">
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs">{view.edited ? "Estimated · your amounts" : "Estimated"}</span>
              <div className="flex items-baseline gap-1.5">
                <span
                  aria-live="polite"
                  className="font-display text-[44px] leading-none text-ink-strong"
                >
                  {view.kcal}
                </span>
                <span className="text-sm">kcal</span>
              </div>
              <span className="text-xs">
                Range {view.low}–{view.high}
              </span>
            </div>
            <span className="rounded-full bg-teal px-2.5 py-1.5 text-xs text-cream">
              {dish.confidence} confidence
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <MacroTile label="Protein" value={`${view.protein}g`} valueClass="text-teal" />
            <MacroTile label="Carbs" value={`${view.carbs}g`} valueClass="text-carbs-ink" />
            <MacroTile label="Fat" value={`${view.fat}g`} valueClass="text-fat-ink" />
            <MacroTile label="Weight" value={`${view.weight}g`} />
          </div>
        </section>

        {dish.warnings.length > 0 && (
          <section role="note" className="rounded-card bg-swap-bg px-3.5 py-3">
            <ul className="flex flex-col gap-1 text-[13px]">
              {dish.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col rounded-card bg-white px-3.5 pt-1.5">
          <p className="pt-1 pb-0.5 text-xs text-ink-muted">Tap an ingredient to change its amount</p>
          {view.rows.map((row, i) => (
            <div key={i} className="border-b border-divider last:border-b-0">
              <button
                type="button"
                aria-expanded={openRow === i}
                aria-controls={`amount-${i}`}
                onClick={() => setOpenRow(openRow === i ? null : i)}
                className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 py-2 text-left"
              >
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: row.dot }}
                />
                <span className="flex-1 text-sm first-letter:uppercase">{row.name}</span>
                <span
                  className={`flex items-center gap-1 text-xs ${row.edited ? "font-semibold text-teal" : "text-ink-muted"}`}
                >
                  {row.grams} g
                  <EditIcon size={12} aria-hidden />
                </span>
                <span className="w-11 text-right text-sm font-medium">{row.kcal}</span>
              </button>
              {openRow === i && (
                <AmountEditor
                  id={`amount-${i}`}
                  name={row.name}
                  grams={row.grams}
                  estimated={estimated[i]}
                  onChange={(g) => setAmount(i, g)}
                />
              )}
            </div>
          ))}
          {view.edited && (
            <button
              type="button"
              onClick={() => {
                setGrams(estimated);
                setOpenRow(null);
              }}
              className="min-h-11 cursor-pointer text-left text-[13px] font-semibold text-teal"
            >
              Reset to the estimate
            </button>
          )}
        </section>

        {dish.assumptions.length > 0 && (
          <details className="rounded-card bg-white px-3.5 py-3">
            <summary className="cursor-pointer text-[13px] text-ink-muted">
              How we estimated this · {dish.assumptions.length}{" "}
              {dish.assumptions.length === 1 ? "assumption" : "assumptions"}
            </summary>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-xs text-ink-muted">
              {dish.assumptions.map((a) => (
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
