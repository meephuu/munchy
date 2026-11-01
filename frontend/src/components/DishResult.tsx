"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Chip } from "@/components/Chip";
import { ArrowLeftIcon, ArrowRightIcon, LockIcon } from "@/components/Icons";
import { Screen } from "@/components/Screen";
import {
  computeDish,
  DEFAULT_SELECTION,
  DISH,
  MODS,
  PLACES,
  type ModId,
  type PlaceId,
  type Selection,
} from "@/lib/dish";

// Guest dish result (design/screens/GuestDish.dc.html). Same content as the logged-in Bite
// check, but the bottom call to action sends the guest to sign up instead of logging.

export function DishResult() {
  const [selection, setSelection] = useState<Selection>(DEFAULT_SELECTION);
  const view = computeDish(selection);

  const pickPlace = (place: PlaceId) => setSelection((s) => ({ ...s, place }));
  const toggleMod = (id: ModId) =>
    setSelection((s) => ({ ...s, mods: { ...s.mods, [id]: !s.mods[id] } }));

  return (
    <Screen>
      <div className="flex flex-col gap-3.5">
        <header className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to search"
              className="flex size-11 items-center justify-center rounded-row bg-white text-ink"
            >
              <ArrowLeftIcon size={20} />
            </Link>
            <h1 className="font-display text-xl font-normal text-ink">Bite check</h1>
          </div>
          <Link href="/onboarding" className="text-sm font-semibold">
            Log in
          </Link>
        </header>

        <div className="flex items-center gap-2.5 rounded-card border border-line-soft bg-white px-3.5 py-3">
          <Image src="/bowl.png" alt="" width={36} height={36} />
          <span className="flex-1 text-[15px]">{DISH.title}</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-ink-muted">Quick question — where&apos;s it from?</span>
          <div className="flex flex-wrap gap-2">
            {PLACES.map((p) => (
              <Chip key={p.id} selected={selection.place === p.id} onClick={() => pickPlace(p.id)}>
                {p.label}
              </Chip>
            ))}
          </div>
        </div>

        <section className="flex flex-col gap-3.5 rounded-hero bg-olive p-[18px]">
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs">Estimated</span>
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
              {DISH.confidence} confidence
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <MacroTile label="Protein" value={`${view.protein}g`} valueClass="text-teal" />
            <MacroTile label="Carbs" value={`${view.carbs}g`} valueClass="text-carbs-ink" />
            <MacroTile label="Fat" value={`${view.fat}g`} valueClass="text-fat-ink" />
            <MacroTile label="Sodium" value={`${DISH.sodiumG}g`} />
          </div>
        </section>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-ink-muted">Tweak it</span>
          <div className="flex flex-wrap gap-2">
            {MODS.map((m) => (
              <Chip key={m.id} selected={!!selection.mods[m.id]} onClick={() => toggleMod(m.id)}>
                {m.label}
              </Chip>
            ))}
          </div>
        </div>

        <section className="flex flex-col rounded-card bg-white px-3.5 py-1.5">
          {view.parts.map((part) => (
            <div
              key={part.name}
              className="flex items-center gap-2.5 border-b border-divider py-2"
            >
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ background: part.dot }}
              />
              <span className="flex-1 text-sm">{part.name}</span>
              <span className="text-xs text-ink-muted">{part.amount}</span>
              <span className="w-11 text-right text-sm font-medium">{part.kcal}</span>
            </div>
          ))}
        </section>
      </div>

      <Link
        href="/onboarding"
        className="sticky bottom-5 mt-auto flex h-16 items-center gap-3 rounded-btn bg-teal px-[18px] text-cream"
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
