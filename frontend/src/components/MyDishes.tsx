"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AmountEditor } from "@/components/AmountEditor";
import { Chip } from "@/components/Chip";
import { PlusIcon, TrashIcon } from "@/components/Icons";
import { IngredientSearch } from "@/components/IngredientSearch";
import { Field } from "@/components/Field";
import { Eyebrow, Title } from "@/components/Type";
import {
  dishFromRow,
  dishToMeal,
  EMPTY_FORM,
  itemsOf,
  parseCustom,
  totalsOf,
  type CustomDish,
  type CustomForm,
} from "@/lib/custom";
import type { Ingredient } from "@/lib/estimate";
import { toIngredient, type FoodHit } from "@/lib/foods";
import {
  defaultSlot,
  friendlyMealError,
  SLOTS,
  slotLabel,
  type MealSlot,
} from "@/lib/meals";
import { createClient } from "@/lib/supabase/client";

// "My dishes" on the Log screen: dishes the person made up. They type the nutrition for one serving, or
// add ingredients (optional) and let the numbers add up, then fix any of them by hand. Saved in the
// Supabase `custom_dishes` table, and loggable in one tap.

const noSubscribe = () => () => {};
const clientSlot = (): MealSlot => defaultSlot(new Date());
const serverSlot = (): MealSlot => "lunch";

export function MyDishes({ favorites }: { favorites?: ReactNode }) {
  const router = useRouter();
  const [dishes, setDishes] = useState<CustomDish[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formKey, setFormKey] = useState(0); // a new key = an empty form (after saving or cancelling)
  const [slotChoice, setSlotChoice] = useState<MealSlot | null>(null);
  const timeSlot = useSyncExternalStore(noSubscribe, clientSlot, serverSlot);
  const slot = slotChoice ?? timeSlot;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      if (!supabase) return setDishes([]);
      const { data, error } = await supabase
        .from("custom_dishes")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        setError(friendlyMealError(error));
        return setDishes([]);
      }
      setDishes(
        (data ?? [])
          .map(dishFromRow)
          .filter((d): d is CustomDish => d !== null),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function log(
    dish: Pick<
      CustomDish,
      "title" | "kcal" | "protein" | "carbs" | "fat" | "items"
    >,
  ) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error } = (await createClient()
      ?.from("meals")
      .insert(dishToMeal(dish, slot, new Date()))) ?? {
      error: { message: "off" },
    };
    if (error) {
      setBusy(false);
      return setError(friendlyMealError(error));
    }
    router.push("/home");
    router.refresh();
  }

  async function remove(id: string) {
    const before = dishes;
    setDishes((all) => all?.filter((d) => d.id !== id) ?? null);
    const { error } = (await createClient()
      ?.from("custom_dishes")
      .delete()
      .eq("id", id)) ?? { error: { message: "off" } };
    if (error) {
      setDishes(before);
      setError(friendlyMealError(error));
    }
  }

  const finishForm = () => {
    setCreating(false);
    setFormKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col gap-4 desk:flex-row desk:flex-wrap desk:items-start desk:gap-6">
      <div className="flex min-w-0 flex-col gap-4 desk:flex-[1_1_320px] desk:gap-6">
        {favorites}

        {/* on a phone the form opens from a button; on desktop it is always there (design/screens/desktop/Add) */}
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex cursor-pointer items-center gap-1 self-start text-sm font-semibold text-green desk:hidden"
          >
            <PlusIcon size={16} />
            Create a dish
          </button>
        )}
        <div className={creating ? "" : "hidden desk:block"}>
          <CustomDishForm
            key={formKey}
            slot={slot}
            onCancel={finishForm}
            onSaved={(dish, andLog) => {
              setDishes((all) => [dish, ...(all ?? [])]);
              finishForm();
              if (andLog) void log(dish);
            }}
          />
        </div>
      </div>

      <section className="flex flex-col gap-3 desk:min-w-0 desk:flex-[1.4_1_420px] desk:gap-3.5 desk:rounded-hero desk:bg-surface desk:p-6 desk:shadow-card">
        <div className="flex items-baseline justify-between">
          <Title
            as="h2"
            lead="My"
            accent="dishes"
            className="text-lg desk:text-[22px]"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-card bg-terracotta-tint px-3.5 py-2.5 text-[13px]"
          >
            {error}
          </p>
        )}

        {dishes && dishes.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Eyebrow tone="muted">Log as</Eyebrow>
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
            <ul className="flex flex-col gap-2 desk:gap-0">
              {dishes.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-row bg-surface px-3.5 py-2.5 shadow-row desk:min-h-[60px] desk:rounded-none desk:border-b desk:border-divider desk:bg-transparent desk:px-0 desk:shadow-none"
                >
                  <span className="min-w-0 flex-1 text-sm desk:text-[15px]">
                    <span className="block truncate first-letter:uppercase">
                      {d.title}
                    </span>
                    <span className="font-mono text-[10px] text-ink-muted">
                      {Math.round(d.kcal)} kcal · P {Math.round(d.protein)} · C{" "}
                      {Math.round(d.carbs)} · F {Math.round(d.fat)}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => log(d)}
                    className="min-h-9 cursor-pointer rounded-btn bg-green px-3 text-[13px] font-semibold text-bg hover:bg-green-dark disabled:opacity-50"
                  >
                    Log to {slotLabel(slot).toLowerCase()}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${d.title}`}
                    onClick={() => remove(d.id)}
                    className="-mr-1.5 flex size-9 shrink-0 cursor-pointer items-center justify-center text-ink-muted"
                  >
                    <TrashIcon size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {dishes && dishes.length === 0 && (
          <p className="text-sm text-ink-muted">
            Cook something we don&apos;t know? Create your own dish: type its
            calories and macros, or add ingredients and let them add up.
          </p>
        )}
      </section>
    </div>
  );
}

function CustomDishForm({
  slot,
  onCancel,
  onSaved,
}: {
  slot: MealSlot;
  onCancel: () => void;
  onSaved: (dish: CustomDish, andLog: boolean) => void;
}) {
  const [form, setForm] = useState<CustomForm>(EMPTY_FORM);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [grams, setGrams] = useState<number[]>([]);
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set =
    (key: keyof CustomForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  // Ingredients add up into the number fields; typing in a field afterwards simply overrides them.
  function setIngredientState(nextIng: Ingredient[], nextGrams: number[]) {
    setIngredients(nextIng);
    setGrams(nextGrams);
    if (nextIng.length > 0)
      setForm((f) => ({ ...f, ...totalsOf(itemsOf(nextIng, nextGrams)) }));
  }

  const addFood = (hit: FoodHit) => {
    setAdding(false);
    const ing = toIngredient(hit);
    setIngredientState([...ingredients, ing], [...grams, ing.grams]);
    setOpenRow(ingredients.length);
  };

  async function save(andLog: boolean) {
    if (saving) return;
    const parsed = parseCustom(form, itemsOf(ingredients, grams));
    if (!parsed.ok) return setError(parsed.error);
    setSaving(true);
    setError(null);
    const { data, error } = (await createClient()
      ?.from("custom_dishes")
      .insert(parsed.value)
      .select("*")
      .single()) ?? {
      data: null,
      error: { message: "off" },
    };
    const dish = dishFromRow(data);
    if (error || !dish) {
      setSaving(false);
      return setError(
        error
          ? friendlyMealError(error)
          : "We couldn't save that. Please try again.",
      );
    }
    onSaved(dish, andLog);
  }

  return (
    <div className="flex flex-col gap-3 rounded-hero bg-surface p-[18px] shadow-card desk:gap-3.5 desk:p-6">
      <Eyebrow>New dish · one serving</Eyebrow>
      <Field
        id="dish-name"
        label="Name"
        value={form.name}
        onChange={set("name")}
        maxLength={200}
        placeholder="e.g. Mom's green curry"
      />

      <div className="flex flex-col gap-1">
        <Eyebrow tone="muted">Ingredients · optional</Eyebrow>
        {ingredients.length > 0 && (
          <ul className="flex flex-col">
            {ingredients.map((ing, i) => (
              <li key={i} className="border-b border-divider last:border-b-0">
                <button
                  type="button"
                  aria-expanded={openRow === i}
                  onClick={() => setOpenRow(openRow === i ? null : i)}
                  className="flex min-h-11 w-full cursor-pointer items-center gap-2 py-2 text-left text-[13px]"
                >
                  <span className="flex-1 first-letter:uppercase">
                    {ing.name}
                  </span>
                  <span className="font-mono text-[11px] text-ink-muted">
                    {grams[i]} g
                  </span>
                  <span className="w-10 text-right font-semibold">
                    {Math.round((ing.per100.kcal * grams[i]) / 100)}
                  </span>
                </button>
                {openRow === i && (
                  <AmountEditor
                    id={`custom-amount-${i}`}
                    name={ing.name}
                    grams={grams[i]}
                    units={ing.units}
                    estimated={ing.grams}
                    baseLabel="Typical serving"
                    onChange={(g) =>
                      setIngredientState(
                        ingredients,
                        grams.map((v, j) => (j === i ? g : v)),
                      )
                    }
                    onRemove={() => {
                      setOpenRow(null);
                      setIngredientState(
                        ingredients.filter((_, j) => j !== i),
                        grams.filter((_, j) => j !== i),
                      );
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
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
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field
          id="dish-kcal"
          label="Calories (kcal)"
          inputMode="decimal"
          value={form.kcal}
          onChange={set("kcal")}
        />
        <Field
          id="dish-protein"
          label="Protein (g)"
          inputMode="decimal"
          value={form.protein}
          onChange={set("protein")}
        />
        <Field
          id="dish-carbs"
          label="Carbs (g)"
          inputMode="decimal"
          value={form.carbs}
          onChange={set("carbs")}
        />
        <Field
          id="dish-fat"
          label="Fat (g)"
          inputMode="decimal"
          value={form.fat}
          onChange={set("fat")}
        />
      </div>
      <p className="text-xs text-ink-muted">
        {ingredients.length > 0
          ? "These add up from your ingredients. You can change any number."
          : "Calories are required. Leave a macro empty if you don't know it."}
      </p>

      {error && (
        <p
          role="alert"
          className="rounded-card bg-terracotta-tint px-3.5 py-2.5 text-[13px]"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => save(true)}
          className="flex h-12 w-full cursor-pointer items-center justify-center rounded-btn bg-green text-[15px] font-semibold text-bg hover:bg-green-dark disabled:opacity-50"
        >
          {saving
            ? "Saving…"
            : `Save & log to ${slotLabel(slot).toLowerCase()}`}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => save(false)}
            className="h-11 flex-1 cursor-pointer rounded-btn border border-border text-sm font-semibold text-green disabled:opacity-50"
          >
            Save only
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
    </div>
  );
}
