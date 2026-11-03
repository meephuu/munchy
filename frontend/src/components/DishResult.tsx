"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { AmountEditor } from "@/components/AmountEditor";
import { Chip } from "@/components/Chip";
import { DishHeader } from "@/components/DishHeader";
import { ArrowRightIcon, EditIcon, LockIcon, PlusIcon } from "@/components/Icons";
import { IngredientSearch } from "@/components/IngredientSearch";
import { Screen } from "@/components/Screen";
import { Eyebrow } from "@/components/Type";
import { summarize, type Dish, type Ingredient } from "@/lib/estimate";
import { toIngredient, type FoodHit } from "@/lib/foods";
import { defaultSlot, friendlyMealError, mealToInsert, SLOTS, slotLabel, type MealSlot } from "@/lib/meals";
import { createClient } from "@/lib/supabase/client";

// Guest dish result (design/screens/GuestDish.dc.html), filled with the backend's estimate.
// Same content as the logged-in Bite check, but the bottom call to action sends the guest to
// sign up; for a logged-in person it logs the meal (with the amounts as edited) instead. Tap an ingredient to change its amount, or add one from the food
// search; totals follow.
// The design's "Where's it from?" and "Tweak it" chips are left out until the backend can really answer them.

// The slot for the person's own clock. The server cannot know it, so it renders "lunch" and the browser
// swaps in the real one after hydration (that is what useSyncExternalStore's server snapshot is for).
const noSubscribe = () => () => {};
const clientSlot = (): MealSlot => defaultSlot(new Date());
const serverSlot = (): MealSlot => "lunch";

export function DishResult({ query, dish, member }: { query: string; dish: Dish; member: boolean }) {
  const router = useRouter();
  const aiGrams = dish.ingredients.map((i) => i.grams);
  const [extra, setExtra] = useState<Ingredient[]>([]); // foods the user added
  const [grams, setGrams] = useState(aiGrams); // one amount per ingredient, AI's first
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [slotChoice, setSlotChoice] = useState<MealSlot | null>(null);
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const timeSlot = useSyncExternalStore(noSubscribe, clientSlot, serverSlot);
  const slot = slotChoice ?? timeSlot;

  const ingredients = [...dish.ingredients, ...extra];
  const view = summarize({ ...dish, ingredients }, grams);
  const assumptions = [
    ...dish.assumptions,
    ...extra.map((e) => `Added by you: ${e.name}, starting from a typical serving of ${e.grams} g`),
  ];

  const setAmount = (i: number, g: number) => setGrams((all) => all.map((v, j) => (j === i ? g : v)));

  const addFood = (hit: FoodHit) => {
    setAdding(false);
    const same = ingredients.findIndex((i) => i.name.toLowerCase() === hit.name.toLowerCase());
    if (same >= 0) {
      setOpenRow(same); // already in the meal: just edit it
      return;
    }
    const ingredient = toIngredient(hit, ingredients.length);
    setExtra((all) => [...all, ingredient]);
    setGrams((all) => [...all, ingredient.grams]);
    setOpenRow(ingredients.length); // open its amount editor
  };

  const logMeal = async () => {
    if (logging) return; // a second tap while saving
    setLogging(true);
    setLogError(null);
    const supabase = createClient();
    if (!supabase) {
      setLogging(false);
      return setLogError("Accounts aren't switched on, so meals can't be logged.");
    }
    const { error } = await supabase.from("meals").insert(mealToInsert(query, view, slot, new Date()));
    if (error) {
      setLogging(false);
      return setLogError(friendlyMealError(error));
    }
    router.push("/home");
    router.refresh();
  };

  const nothingToLog = view.rows.every((r) => r.grams === 0);

  const removeAdded = (i: number) => {
    setExtra((all) => all.filter((_, j) => j !== i - dish.ingredients.length));
    setGrams((all) => all.filter((_, j) => j !== i));
    setOpenRow(null);
  };

  return (
    <Screen>
      <div className="flex flex-col gap-3.5">
        <DishHeader dish={query} />

        <section className="flex flex-col gap-3 rounded-hero bg-surface p-[18px] shadow-card">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>{view.edited ? "Estimated · your amounts" : "Estimated"}</Eyebrow>
            <span className="shrink-0 rounded-badge bg-green-tint px-2 py-1 font-mono text-[10px] tracking-[1px] text-green uppercase">
              {dish.confidence} confidence
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span aria-live="polite" className="font-brand text-[46px] leading-none text-green">
              {view.kcal}
            </span>
            <span className="text-[15px] font-semibold">kcal</span>
          </div>
          <span className="text-[13px] text-ink-muted">
            Range{" "}
            <b className="text-ink">
              {view.low}–{view.high}
            </b>{" "}
            kcal
          </span>

          <div className="grid grid-cols-4 gap-2">
            <MacroTile label="Protein" value={`${view.protein}g`} valueClass="text-green" />
            <MacroTile label="Carbs" value={`${view.carbs}g`} valueClass="text-bronze" />
            <MacroTile label="Fat" value={`${view.fat}g`} valueClass="text-terracotta-text" />
            <MacroTile label="Weight" value={`${view.weight}g`} />
          </div>
        </section>

        {dish.notices.length > 0 && (
          <section role="note" className="rounded-card bg-terracotta-tint px-3.5 py-3">
            <ul className="flex flex-col gap-1 text-[13px]">
              {dish.notices.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-col gap-2">
          <Eyebrow tone="muted">Ingredients · tap to change</Eyebrow>
          <section className="flex flex-col rounded-card bg-surface px-3.5 py-1 shadow-row">
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
                  <span className="flex-1 text-[13px] first-letter:uppercase">
                    {row.name}{" "}
                    {row.added && (
                      <span className="font-mono text-[9px] tracking-[1px] text-bronze uppercase">added</span>
                    )}
                  </span>
                  <span
                    className={`flex items-center gap-1 font-mono text-[11px] ${row.edited ? "font-bold text-green" : "text-ink-muted"}`}
                  >
                    {row.grams} g
                    <EditIcon size={12} aria-hidden />
                  </span>
                  <span className="w-10 text-right text-[13px] font-semibold">{row.kcal}</span>
                </button>
                {openRow === i && (
                  <AmountEditor
                    id={`amount-${i}`}
                    name={row.name}
                    grams={row.grams}
                    units={ingredients[i].units}
                    estimated={ingredients[i].grams}
                    baseLabel={row.added ? "Typical serving" : "As estimated"}
                    onChange={(g) => setAmount(i, g)}
                    onRemove={row.added ? () => removeAdded(i) : undefined}
                  />
                )}
              </div>
            ))}
            {adding ? (
              <IngredientSearch onPick={addFood} onClose={() => setAdding(false)} />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAdding(true);
                  setOpenRow(null);
                }}
                className="flex min-h-11 cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-green"
              >
                <PlusIcon size={16} />
                Add an ingredient
              </button>
            )}
            {view.edited && (
              <button
                type="button"
                onClick={() => {
                  setExtra([]);
                  setGrams(aiGrams);
                  setOpenRow(null);
                  setAdding(false);
                }}
                className="min-h-11 cursor-pointer text-left text-[13px] font-semibold text-green"
              >
                Reset to the estimate
              </button>
            )}
          </section>
        </div>

        {assumptions.length > 0 && (
          <details className="rounded-card bg-surface px-3.5 py-3 shadow-row">
            <summary className="cursor-pointer text-[13px] text-ink-muted">
              How we estimated this · {assumptions.length} {assumptions.length === 1 ? "note" : "notes"}
            </summary>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-xs text-ink-muted">
              {assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </details>
        )}

        {member && (
          <div className="flex flex-col gap-2">
            <Eyebrow tone="muted">Log as</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {SLOTS.map((o) => (
                <Chip key={o.id} selected={slot === o.id} onClick={() => setSlotChoice(o.id)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>

      {member ? (
        <div className="sticky bottom-5 mt-6 flex flex-col gap-2">
          {logError && (
            <p role="alert" className="rounded-card bg-terracotta-tint px-3.5 py-2.5 text-[13px]">
              {logError}
            </p>
          )}
          <button
            type="button"
            onClick={logMeal}
            disabled={logging || nothingToLog}
            className="flex h-14 w-full cursor-pointer items-center justify-center rounded-btn bg-green text-[15px] font-semibold text-bg hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {logging ? "Logging…" : `Log to ${slotLabel(slot).toLowerCase()} · ${view.kcal} kcal`}
          </button>
        </div>
      ) : (
        <Link
          href="/onboarding"
          className="sticky bottom-5 mt-6 flex h-16 items-center gap-3 rounded-btn bg-green px-[18px] text-bg hover:bg-green-dark"
        >
          <LockIcon size={22} className="shrink-0 text-gold" />
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold">See how this fits your day</span>
            <span className="text-xs text-green-soft">Free account · log meals &amp; get coached</span>
          </span>
          <ArrowRightIcon size={20} />
        </Link>
      )}
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
    <div className="flex flex-col gap-0.5 rounded-field bg-bg p-2">
      <span className="font-mono text-[9px] text-ink-muted uppercase">{label}</span>
      <span className={`text-base font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}
