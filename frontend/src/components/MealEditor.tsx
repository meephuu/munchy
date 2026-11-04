"use client";

import { useState } from "react";
import { AmountEditor } from "@/components/AmountEditor";
import { Chip } from "@/components/Chip";
import { PlusIcon } from "@/components/Icons";
import { TimePicker } from "@/components/TimePicker";
import { MacroLine } from "@/components/MacroLine";
import { IngredientSearch } from "@/components/IngredientSearch";
import { Eyebrow } from "@/components/Type";
import { itemsOf } from "@/lib/custom";
import { toIngredient, type FoodHit } from "@/lib/foods";
import {
  friendlyMealError,
  mealFromRow,
  mealUpdate,
  scaleItem,
  SLOTS,
  timeLabel,
  type Meal,
  type MealItem,
  type MealSlot,
} from "@/lib/meals";
import { createClient } from "@/lib/supabase/client";

/** Edit a logged meal from Home: the time, the slot and the amount of each ingredient (change, remove or add one).
 *  A dish typed in by hand has no ingredients, so its calories and macros are edited directly. Totals follow
 *  the ingredients, so the saved numbers always agree with them. */
export function MealEditor({
  meal,
  onSaved,
  onCancel,
}: {
  meal: Meal;
  onSaved: (meal: Meal) => void;
  onCancel: () => void;
}) {
  const [time, setTime] = useState(timeLabel(meal.eatenAt));
  const [slot, setSlot] = useState<MealSlot>(meal.slot);
  // each row remembers the item as logged, so "Half" / "Double" and the numbers scale from it
  const [rows, setRows] = useState(() =>
    meal.items.map((orig) => ({ orig, grams: orig.grams })),
  );
  const [totals, setTotals] = useState({
    kcal: String(Math.round(meal.kcal)),
    protein: String(meal.protein),
    carbs: String(meal.carbs),
    fat: String(meal.fat),
  });
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasItems = rows.length > 0;
  const items: MealItem[] = rows.map((r) => scaleItem(r.orig, r.grams));

  const addFood = (hit: FoodHit) => {
    setAdding(false);
    const [orig] = itemsOf(
      [toIngredient(hit, rows.length)],
      [hit.default_serving_g],
    );
    if (!orig) return;
    setRows((all) => [...all, { orig, grams: orig.grams }]);
    setOpenRow(rows.length);
  };

  async function save() {
    if (saving) return;
    const num = (t: string) => Number(t.trim().replace(",", "."));
    const typed = {
      kcal: num(totals.kcal),
      protein: num(totals.protein),
      carbs: num(totals.carbs),
      fat: num(totals.fat),
    };
    if (
      !hasItems &&
      Object.values(typed).some((n) => !Number.isFinite(n) || n < 0)
    ) {
      return setError("Calories and macros must be numbers, 0 or more.");
    }
    const update = mealUpdate(meal, { time, slot, items, totals: typed });
    if (!update) return setError("Enter the time like 13:30.");
    if (hasItems && update.items.length === 0)
      return setError("Keep at least one ingredient, or delete the meal.");
    setSaving(true);
    setError(null);
    const { data, error } = (await createClient()
      ?.from("meals")
      .update(update)
      .eq("id", meal.id)
      .select("*")
      .single()) ?? {
      data: null,
      error: { message: "off" },
    };
    const saved = mealFromRow(data);
    if (error || !saved) {
      setSaving(false);
      return setError(
        error
          ? friendlyMealError(error)
          : "We couldn't save that. Please try again.",
      );
    }
    onSaved(saved);
  }

  const field =
    "box-border h-10 w-full rounded-field border border-border bg-bg px-2.5 text-[14px] text-ink outline-none focus:border-green";

  return (
    <div className="flex flex-col gap-3 border-t border-divider pt-3">
      <div className="flex flex-col gap-1.5">
        <Eyebrow tone="muted">Time</Eyebrow>
        <TimePicker value={time} onChange={setTime} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Eyebrow tone="muted">Meal</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {SLOTS.map((o) => (
            <Chip
              key={o.id}
              selected={slot === o.id}
              onClick={() => setSlot(o.id)}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Eyebrow tone="muted">
          {hasItems ? "Ingredients · tap to change" : "Nutrition · one serving"}
        </Eyebrow>
        {hasItems ? (
          <ul className="flex flex-col">
            {rows.map((r, i) => {
              const now = scaleItem(r.orig, r.grams);
              return (
                <li key={i} className="border-b border-divider last:border-b-0">
                  <button
                    type="button"
                    aria-expanded={openRow === i}
                    onClick={() => setOpenRow(openRow === i ? null : i)}
                    className="flex min-h-11 w-full cursor-pointer items-center gap-2 py-2 text-left text-[13px]"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="first-letter:uppercase">
                        {r.orig.name}
                      </span>
                      <MacroLine
                        protein={now.protein}
                        carbs={now.carbs}
                        fat={now.fat}
                      />
                    </span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {r.grams} g
                    </span>
                    <span className="w-10 text-right font-semibold">
                      {now.kcal}
                    </span>
                  </button>
                  {openRow === i && (
                    <AmountEditor
                      id={`meal-${meal.id}-${i}`}
                      name={r.orig.name}
                      grams={r.grams}
                      units={[]}
                      estimated={r.orig.grams}
                      baseLabel="As logged"
                      onChange={(g) =>
                        setRows((all) =>
                          all.map((x, j) => (j === i ? { ...x, grams: g } : x)),
                        )
                      }
                      onRemove={() => {
                        setOpenRow(null);
                        setRows((all) => all.filter((_, j) => j !== i));
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {(["kcal", "protein", "carbs", "fat"] as const).map((k) => (
              <label
                key={k}
                className="flex flex-col gap-1 text-[11px] text-ink-muted"
              >
                {k === "kcal"
                  ? "Calories (kcal)"
                  : `${k[0].toUpperCase()}${k.slice(1)} (g)`}
                <input
                  inputMode="decimal"
                  value={totals[k]}
                  onChange={(e) =>
                    setTotals((t) => ({ ...t, [k]: e.target.value }))
                  }
                  className={field}
                />
              </label>
            ))}
          </div>
        )}
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
        {!hasItems && (
          <p className="text-xs text-ink-muted">
            Adding an ingredient replaces the typed numbers with what the
            ingredients add up to.
          </p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-card bg-terracotta-tint px-3.5 py-2.5 text-[13px]"
        >
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="h-11 flex-1 cursor-pointer rounded-btn bg-green text-sm font-semibold text-bg hover:bg-green-dark disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 cursor-pointer rounded-btn text-sm font-semibold text-ink-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
