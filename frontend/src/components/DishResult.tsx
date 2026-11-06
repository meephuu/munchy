"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { AmountEditor } from "@/components/AmountEditor";
import { Chip } from "@/components/Chip";
import { CountUp } from "@/components/CountUp";
import { TimePicker } from "@/components/TimePicker";
import { DishDayBars } from "@/components/DishDayBars";
import { DishHeader } from "@/components/DishHeader";
import {
  ArrowRightIcon,
  EditIcon,
  LockIcon,
  PlusIcon,
} from "@/components/Icons";
import { MacroLine } from "@/components/MacroLine";
import { IngredientSearch } from "@/components/IngredientSearch";
import { Screen } from "@/components/Screen";
import { DishSearchBar } from "@/components/DishSearchBar";
import { Eyebrow } from "@/components/Type";
import { summarize, type Dish, type Ingredient } from "@/lib/estimate";
import { toIngredient, type FoodHit } from "@/lib/foods";
import { FOOD_KINDS } from "@/lib/foodkind";
import {
  adjustmentNotes,
  availableTweaks,
  multipliers,
  PLACES,
  placeExtra,
  type Place,
  type TweakId,
} from "@/lib/tweaks";
import {
  defaultSlot,
  friendlyMealError,
  mealToInsert,
  SLOTS,
  slotLabel,
  type MealSlot,
  withTime,
} from "@/lib/meals";
import { formatTime, parseTime } from "@/lib/time";
import type { MemberShell } from "@/lib/shell";
import { createClient } from "@/lib/supabase/client";

// Guest dish result (design/screens/GuestDish.dc.html), filled with the backend's estimate.
// Same content as the logged-in Bite check, but the bottom call to action sends the guest to
// sign up; for a logged-in person it logs the meal (with the amounts as edited) instead. Tap an ingredient to change its amount, or add one from the food
// search; totals follow.
// "Where's it from?" and "Tweak it" are plain rules in lib/tweaks.ts (amount multipliers), not backend data.

// The slot for the person's own clock. The server cannot know it, so it renders "lunch" and the browser
// swaps in the real one after hydration (that is what useSyncExternalStore's server snapshot is for).
const noSubscribe = () => () => {};
// the time on the person's own clock ("HH:MM"); the server renders noon first
const clientTime = () => {
  const d = new Date();
  return formatTime(d.getHours(), d.getMinutes());
};
const serverTime = () => "12:00";

/** The meal slot a time of day most likely is ("13:30" is lunch). */
const slotAt = (time: string): MealSlot =>
  defaultSlot(new Date(2000, 0, 1, ...(parseTime(time) ?? [12, 0])));

/** The moment to log for a time picked now. withTime works out the person's day itself (see dayOf), so it is given
 *  the current moment, not a day start: 01:30 after midnight is tonight's, and 08:45 at 4 pm is this morning. */
function mealMoment(time: string): Date {
  return withTime(new Date(), time) ?? new Date();
}

export function DishResult({
  query,
  dish,
  member: memberInfo,
}: {
  query: string;
  dish: Dish;
  /** What the sidebar shows when the person is logged in; null for a guest. */
  member: MemberShell | null;
}) {
  const router = useRouter();
  const member = memberInfo !== null;
  const aiGrams = dish.ingredients.map((i) => i.grams);
  const [extra, setExtra] = useState<Ingredient[]>([]); // foods the user added
  const [grams, setGrams] = useState(aiGrams); // one amount per ingredient, AI's first
  const [removed, setRemoved] = useState<number[]>([]); // AI-found ingredients the user deleted
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [slotChoice, setSlotChoice] = useState<MealSlot | null>(null);
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const nowTime = useSyncExternalStore(noSubscribe, clientTime, serverTime);
  const [timeChoice, setTimeChoice] = useState<string | null>(null);
  const time = timeChoice ?? nowTime;
  // until a slot is picked it follows the time (08:00 is breakfast, 19:00 dinner)
  const slot = slotChoice ?? slotAt(time);
  const [place, setPlace] = useState<Place>("stall");
  const [active, setActive] = useState<TweakId[]>([]);

  const ingredients = [...dish.ingredients, ...extra];
  const names = ingredients.map((i) => i.name);
  const tweaks = availableTweaks(names.filter((_, i) => !removed.includes(i)));
  const mult = multipliers(names, place, active);
  // what is really eaten: the amount the person set, times what the tweaks and the place do to it
  const eaten = ingredients.map(
    (ing, i) =>
      Math.round(
        (removed.includes(i) ? 0 : (grams[i] ?? ing.grams) * mult[i]) * 10,
      ) / 10,
  );
  const placeRow = placeExtra(
    place,
    summarize({ ...dish, ingredients }, eaten).kcal,
  );
  const view = placeRow
    ? summarize({ ...dish, ingredients: [...ingredients, placeRow] }, [
        ...eaten,
        placeRow.grams,
      ])
    : summarize({ ...dish, ingredients }, eaten);
  const adjusted = place !== "stall" || active.length > 0 || removed.length > 0;
  const assumptions = [
    ...dish.assumptions,
    ...adjustmentNotes(place, active, tweaks),
    ...extra.map(
      (e) =>
        `Added by you: ${e.name}, starting from a typical serving of ${e.grams} g`,
    ),
  ];

  const setAmount = (i: number, g: number) =>
    setGrams((all) =>
      all.map((v, j) =>
        j === i && mult[i] > 0 ? Math.round((g / mult[i]) * 10) / 10 : v,
      ),
    );

  const addFood = (hit: FoodHit) => {
    setAdding(false);
    const same = ingredients.findIndex(
      (i) => i.name.toLowerCase() === hit.name.toLowerCase(),
    );
    if (same >= 0) {
      setOpenRow(same); // already in the meal: just edit it
      return;
    }
    const ingredient = toIngredient(hit);
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
      return setLogError(
        "Accounts aren't switched on, so meals can't be logged.",
      );
    }
    const { error } = await supabase
      .from("meals")
      .insert(mealToInsert(query, view, slot, mealMoment(time)));
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
    <Screen
      shell={
        memberInfo
          ? { kind: "member", member: memberInfo }
          : {
              kind: "guest",
              topBar: <DishSearchBar placeholder="Check another dish" />,
            }
      }
    >
      <div className="flex flex-col gap-3.5 desk:gap-6">
        <DishHeader dish={query} member={member} />

        {/* One column on a phone (the order-* classes keep the phone's order); two on desktop. The wrappers with
            `contents` do not exist on a phone, so the order-* items line up as one column there. */}
        <div className="flex flex-col gap-3.5 desk:flex-row desk:flex-wrap desk:items-start desk:gap-6">
          {/* ---- left column: the estimate and the log panel */}
          <div className="contents desk:flex desk:min-w-0 desk:flex-[1_1_340px] desk:flex-col desk:gap-5">
            <section className="order-2 flex flex-col gap-3 rounded-hero bg-surface p-[18px] shadow-card desk:order-none desk:gap-4 desk:p-[26px]">
              <div className="flex items-center justify-between gap-2">
                <Eyebrow>
                  {view.edited || adjusted ? "Estimated · edited" : "Estimated"}
                </Eyebrow>
                <span className="shrink-0 rounded-badge bg-green-tint px-2 py-1 font-mono text-[10px] tracking-[1px] text-green uppercase">
                  {dish.confidence} confidence
                </span>
              </div>
              <div className="flex items-center gap-[18px]">
                <div className="flex flex-1 flex-col gap-3 desk:gap-2">
                  <div className="flex items-baseline gap-2">
                    <span
                      aria-live="polite"
                      className="font-brand text-[46px] leading-none text-green desk:text-[64px]"
                    >
                      <CountUp value={view.kcal} />
                    </span>
                    <span className="text-[15px] font-semibold desk:text-[17px]">
                      kcal
                    </span>
                  </div>
                  <span className="text-[13px] text-ink-muted desk:text-sm">
                    Range{" "}
                    <b className="text-ink">
                      {view.low}–{view.high}
                    </b>{" "}
                    kcal
                  </span>
                </div>
                <Image
                  src="/bowl.png"
                  alt=""
                  width={96}
                  height={96}
                  className="hidden shrink-0 desk:block"
                />
              </div>
              <div
                className={`grid grid-cols-4 gap-2 desk:grid-cols-2 desk:gap-2.5 ${memberInfo?.target ? "desk:hidden" : ""}`}
              >
                <MacroTile
                  label="Protein"
                  value={`${view.protein}g`}
                  valueClass="text-green"
                />
                <MacroTile
                  label="Carbs"
                  value={`${view.carbs}g`}
                  valueClass="text-bronze"
                />
                <MacroTile
                  label="Fat"
                  value={`${view.fat}g`}
                  valueClass="text-terracotta-text"
                />
                <MacroTile label="Weight" value={`${view.weight}g`} />
              </div>
              {memberInfo?.target && (
                <div className="hidden flex-col gap-3 desk:flex">
                  <DishDayBars
                    weight={view.weight}
                    target={memberInfo.target}
                    dish={{
                      kcal: view.kcal,
                      protein: view.protein,
                      carbs: view.carbs,
                      fat: view.fat,
                    }}
                  />
                </div>
              )}
            </section>

            {dish.notices.length > 0 && (
              <section
                role="note"
                className="order-3 rounded-card bg-terracotta-tint px-3.5 py-3 desk:order-none"
              >
                <ul className="flex flex-col gap-1 text-[13px]">
                  {dish.notices.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </section>
            )}

            {member ? (
              <div className="contents desk:flex desk:flex-col desk:gap-3.5 desk:rounded-hero desk:bg-surface desk:p-[22px] desk:shadow-card">
                <div className="order-7 flex flex-col gap-2 desk:order-none desk:gap-3.5">
                  <Eyebrow tone="muted">Log as</Eyebrow>
                  <div className="flex flex-wrap gap-2">
                    {SLOTS.map((o) => (
                      <Chip
                        key={o.id}
                        selected={slot === o.id}
                        onClick={() => setSlotChoice(o.id)}
                      >
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 desk:flex-row desk:items-center desk:gap-3">
                    <Eyebrow tone="muted">Time</Eyebrow>
                    <TimePicker value={time} onChange={setTimeChoice} up />
                  </div>
                </div>
                <div className="order-8 mt-6 flex flex-col gap-2 desk:order-none desk:mt-0">
                  {logError && (
                    <p
                      role="alert"
                      className="rounded-card bg-terracotta-tint px-3.5 py-2.5 text-[13px]"
                    >
                      {logError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={logMeal}
                    disabled={logging || nothingToLog}
                    className="sticky bottom-5 flex h-14 w-full cursor-pointer items-center justify-center rounded-btn bg-green text-[15px] font-semibold text-bg hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-50 desk:static desk:h-14 desk:rounded-[18px] desk:text-base"
                  >
                    {logging
                      ? "Logging…"
                      : `Log to ${slotLabel(slot).toLowerCase()} · ${view.kcal} kcal`}
                  </button>
                </div>
              </div>
            ) : (
              <Link
                href="/onboarding"
                className="sticky bottom-5 order-8 mt-6 flex h-16 items-center gap-3 rounded-btn bg-green px-[18px] text-bg hover:bg-green-dark desk:static desk:order-none desk:mt-0 desk:h-auto desk:rounded-hero desk:p-[22px]"
              >
                <LockIcon size={22} className="shrink-0 text-gold" />
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold desk:text-base">
                    See how this fits your day
                  </span>
                  <span className="text-xs text-green-soft">
                    Free account · log meals &amp; get coached
                  </span>
                </span>
                <ArrowRightIcon size={20} />
              </Link>
            )}
          </div>

          {/* ---- right column: where it's from, tweaks, the ingredients table, how we estimated it */}
          <div className="contents desk:flex desk:min-w-0 desk:flex-[1.6_1_480px] desk:flex-col desk:gap-5">
            <div className="contents desk:flex desk:flex-wrap desk:gap-x-10 desk:gap-y-5 desk:rounded-hero desk:bg-surface desk:px-[26px] desk:py-[22px] desk:shadow-card">
              <div className="order-1 flex flex-col gap-2 desk:order-none desk:gap-2.5">
                <Eyebrow tone="muted">Where&apos;s it from?</Eyebrow>
                <div className="flex flex-wrap gap-2">
                  {PLACES.map((pl) => (
                    <Chip
                      key={pl.id}
                      selected={place === pl.id}
                      onClick={() => setPlace(pl.id)}
                    >
                      {pl.label}
                    </Chip>
                  ))}
                </div>
              </div>

              {tweaks.length > 0 && (
                <div className="order-4 flex flex-col gap-2 desk:order-none desk:gap-2.5">
                  <Eyebrow tone="muted">Tweak it</Eyebrow>
                  <div className="flex flex-wrap gap-2">
                    {tweaks.map((t) => (
                      <Chip
                        key={t.id}
                        selected={active.includes(t.id)}
                        onClick={() =>
                          setActive((all) =>
                            all.includes(t.id)
                              ? all.filter((x) => x !== t.id)
                              : [...all, t.id],
                          )
                        }
                      >
                        {t.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="order-5 flex flex-col gap-2 desk:order-none desk:gap-0 desk:rounded-hero desk:bg-surface desk:px-[26px] desk:pt-[18px] desk:pb-2.5 desk:shadow-card">
              <Eyebrow tone="muted" className="desk:hidden">
                Ingredients · tap to change
              </Eyebrow>
              <div className="hidden items-baseline justify-between pb-1.5 desk:flex">
                <h2 className="font-heading text-xl font-semibold">
                  Ingredients
                </h2>
                <span className="font-mono text-[10px] tracking-[1px] text-ink-muted uppercase">
                  Click a row to change it
                </span>
              </div>
              <div className="hidden gap-3.5 border-b border-divider py-2 font-mono text-[9px] tracking-[1px] text-ink-muted uppercase desk:flex">
                <span className="w-2.5" />
                <span className="flex-1">Ingredient</span>
                <span className="w-[170px]">Macros</span>
                <span className="w-[72px] text-right">Amount</span>
                <span className="w-[52px] text-right">kcal</span>
              </div>
              <section className="flex flex-col rounded-card bg-surface px-3.5 py-1 shadow-row desk:rounded-none desk:bg-transparent desk:p-0 desk:shadow-none">
                {view.rows.map((row, i) => {
                  if (removed.includes(i)) return null; // deleted by the user
                  const locked = i >= ingredients.length || mult[i] === 0; // the place's extra oil, or left out by a tweak
                  return (
                    <div
                      key={i}
                      className="border-b border-divider last:border-b-0 desk:last:border-b"
                    >
                      <button
                        type="button"
                        disabled={locked}
                        aria-expanded={openRow === i}
                        aria-controls={`amount-${i}`}
                        onClick={() => setOpenRow(openRow === i ? null : i)}
                        className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 py-2 text-left hover:bg-bg/60 disabled:cursor-default desk:min-h-14 desk:gap-3.5"
                      >
                        <span
                          aria-hidden="true"
                          className="size-2 shrink-0 rounded-full ring-1 ring-black/10 ring-inset desk:size-2.5"
                          style={{ background: row.dot }}
                        />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-[13px] first-letter:uppercase desk:text-[15px]">
                            {row.name}{" "}
                            {row.added && (
                              <span className="font-mono text-[9px] tracking-[1px] text-bronze uppercase">
                                added
                              </span>
                            )}
                          </span>
                          {mult[i] !== 0 && (
                            <span className="desk:hidden">
                              <MacroLine
                                protein={row.protein}
                                carbs={row.carbs}
                                fat={row.fat}
                              />
                            </span>
                          )}
                        </span>
                        <span className="hidden w-[170px] desk:block">
                          {mult[i] !== 0 && (
                            <MacroLine
                              protein={row.protein}
                              carbs={row.carbs}
                              fat={row.fat}
                              className="gap-x-2.5 text-[11px]"
                            />
                          )}
                        </span>
                        <span
                          className={`flex items-center gap-1 font-mono text-[11px] desk:w-[72px] desk:justify-end desk:text-xs ${row.edited ? "font-bold text-green" : "text-ink-muted"}`}
                        >
                          {mult[i] === 0 ? "left out" : `${row.grams} g`}
                          {!locked && <EditIcon size={12} aria-hidden />}
                        </span>
                        <span className="w-10 text-right text-[13px] font-semibold desk:w-[52px] desk:text-[15px]">
                          {row.kcal}
                        </span>
                      </button>
                      {openRow === i && !locked && (
                        <p className="pb-1 font-mono text-[10px] text-ink-muted">
                          Per 100 g · {Math.round(ingredients[i].per100.kcal)}{" "}
                          kcal · P{" "}
                          {Math.round(ingredients[i].per100.protein * 10) / 10}{" "}
                          · C{" "}
                          {Math.round(ingredients[i].per100.carbs * 10) / 10} ·
                          F {Math.round(ingredients[i].per100.fat * 10) / 10} g
                        </p>
                      )}
                      {openRow === i && !locked && (
                        <AmountEditor
                          id={`amount-${i}`}
                          name={row.name}
                          grams={row.grams}
                          units={ingredients[i].units}
                          estimated={
                            Math.round(ingredients[i].grams * mult[i] * 10) / 10
                          }
                          baseLabel={
                            row.added ? "Typical serving" : "As estimated"
                          }
                          onChange={(g) => setAmount(i, g)}
                          onRemove={
                            row.added
                              ? () => removeAdded(i)
                              : () => {
                                  setRemoved((all) => [...all, i]);
                                  setOpenRow(null);
                                }
                          }
                        />
                      )}
                    </div>
                  );
                })}
                {adding ? (
                  <IngredientSearch
                    onPick={addFood}
                    onClose={() => setAdding(false)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(true);
                      setOpenRow(null);
                    }}
                    className="flex min-h-11 cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-green desk:min-h-12 desk:text-sm"
                  >
                    <PlusIcon size={16} />
                    Add an ingredient
                  </button>
                )}
                {(view.edited || adjusted) && (
                  <button
                    type="button"
                    onClick={() => {
                      setExtra([]);
                      setGrams(aiGrams);
                      setRemoved([]);
                      setPlace("stall");
                      setActive([]);
                      setOpenRow(null);
                      setAdding(false);
                    }}
                    className="min-h-11 cursor-pointer text-left text-[13px] font-semibold text-green desk:text-sm"
                  >
                    Reset to the estimate
                  </button>
                )}
                <ul
                  aria-label="What the dot colours mean"
                  className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-divider py-3 font-mono text-[9px] tracking-[0.5px] text-ink-muted uppercase"
                >
                  {FOOD_KINDS.map((k) => (
                    <li key={k.id} title={k.hint} className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full ring-1 ring-black/10 ring-inset"
                        style={{ background: k.color }}
                      />
                      {k.label}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {assumptions.length > 0 && (
              <>
                <details className="order-6 rounded-card bg-surface px-3.5 py-3 shadow-row desk:hidden">
                  <summary className="cursor-pointer text-[13px] text-ink-muted">
                    How we estimated this · {assumptions.length}{" "}
                    {assumptions.length === 1 ? "note" : "notes"}
                  </summary>
                  <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-xs text-ink-muted">
                    {assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </details>
                <section className="hidden flex-col gap-2.5 rounded-hero bg-surface px-[26px] py-[22px] shadow-card desk:flex">
                  <Eyebrow tone="muted">
                    How we estimated this · {assumptions.length}{" "}
                    {assumptions.length === 1 ? "note" : "notes"}
                  </Eyebrow>
                  <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[13px] text-ink-muted">
                    {assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
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
    <div className="flex flex-col gap-0.5 rounded-field bg-bg p-2 desk:gap-1 desk:rounded-row desk:p-3">
      <span className="font-mono text-[9px] text-ink-muted uppercase">
        {label}
      </span>
      <span className={`text-base font-semibold desk:text-xl ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}
