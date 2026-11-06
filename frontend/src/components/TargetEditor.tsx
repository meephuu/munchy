"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field } from "@/components/Field";
import { Eyebrow, Title } from "@/components/Type";
import { CUSTOM_LIMITS, toCustomTarget, type CustomTarget } from "@/lib/profile";
import { createClient } from "@/lib/supabase/client";

type Numbers = { kcal: number; proteinG: number; carbsG: number; fatG: number };

const macroKcal = (n: Pick<Numbers, "proteinG" | "carbsG" | "fatG">) =>
  n.proteinG * 4 + n.carbsG * 4 + n.fatG * 9;

const n0 = (n: number) => n.toLocaleString("en-US");

/** The "Your own target" card on Me: change the daily calories and macros to numbers the person chooses, or go back to the
 *  calculated ones. `current` is what is used now; `calculated` is what the body, activity and goal give. */
export function TargetEditor({
  current,
  calculated,
  custom,
}: {
  current: Numbers;
  calculated: Numbers;
  custom: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => toForm(current));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = toCustomTarget(form);
  const addsUp = parsed ? macroKcal(parsed) : null;
  const gap = parsed && addsUp !== null ? addsUp - parsed.kcal : 0;
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value.replace(/[^\d]/g, "") }));

  /** Scale the three macros so they add up to the calories (keeping their proportions). */
  const matchCalories = () => {
    if (!parsed || addsUp === null || addsUp <= 0) return;
    const k = parsed.kcal / addsUp;
    setForm((f) => ({
      ...f,
      proteinG: String(Math.round(parsed.proteinG * k)),
      carbsG: String(Math.round(parsed.carbsG * k)),
      fatG: String(Math.round(parsed.fatG * k)),
    }));
  };

  async function save(values: CustomTarget | null) {
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data } = (await supabase?.auth.getUser()) ?? {
      data: { user: null },
    };
    if (!supabase || !data.user) {
      setSaving(false);
      return setError("Please log in again to save your target.");
    }
    const { error: failure } = await supabase
      .from("profiles")
      .update({
        custom_kcal: values?.kcal ?? null,
        custom_protein_g: values?.proteinG ?? null,
        custom_carbs_g: values?.carbsG ?? null,
        custom_fat_g: values?.fatG ?? null,
      })
      .eq("id", data.user.id);
    if (failure) {
      setSaving(false);
      return setError(
        /custom_/.test(`${failure.message} ${failure.details ?? ""}`)
          ? "Your own target isn't set up yet: the database needs the custom_target migration."
          : "We couldn't save that. Please try again.",
      );
    }
    setOpen(false);
    setSaving(false);
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-3 rounded-hero bg-surface p-[18px] shadow-card desk:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Eyebrow tone="muted">
            {custom ? "Your own target" : "Calculated for you"}
          </Eyebrow>
          <Title
            as="h2"
            lead="Set your"
            accent="own goal"
            className="text-lg desk:text-[22px]"
          />
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setForm(toForm(current));
              setError(null);
              setOpen(true);
            }}
            className="h-11 cursor-pointer rounded-full border-[1.5px] border-green px-5 text-sm font-semibold text-green hover:bg-green-tint"
          >
            {custom ? "Change my target" : "Set my own target"}
          </button>
        )}
      </div>

      {!open ? (
        <p className="text-[13px] leading-normal text-ink-muted">
          {custom
            ? `You are using your own numbers instead of the calculated ${n0(calculated.kcal)} kcal. They stay the same when you edit your profile.`
            : "Munchy works your target out from your body, typical day and goal. If your coach or doctor gave you different numbers, you can use those instead."}
        </p>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3 desk:grid-cols-4">
            <Field
              id="goal-kcal"
              label="Calories (kcal)"
              inputMode="numeric"
              value={form.kcal}
              onChange={set("kcal")}
            />
            <Field
              id="goal-protein"
              label="Protein (g)"
              inputMode="numeric"
              value={form.proteinG}
              onChange={set("proteinG")}
            />
            <Field
              id="goal-carbs"
              label="Carbs (g)"
              inputMode="numeric"
              value={form.carbsG}
              onChange={set("carbsG")}
            />
            <Field
              id="goal-fat"
              label="Fat (g)"
              inputMode="numeric"
              value={form.fatG}
              onChange={set("fatG")}
            />
          </div>

          <p
            aria-live="polite"
            className={`text-[13px] ${parsed ? "text-ink-muted" : "text-terracotta-text"}`}
          >
            {!parsed
              ? `Calories ${n0(CUSTOM_LIMITS.kcal.min)}–${n0(CUSTOM_LIMITS.kcal.max)}, each macro 0–${CUSTOM_LIMITS.macro.max} g, whole numbers.`
              : Math.abs(gap) <= Math.max(25, parsed.kcal * 0.03)
                ? `Your macros add up to ${addsUp} kcal, which matches.`
                : `Your macros add up to ${addsUp} kcal, ${Math.abs(gap)} ${gap > 0 ? "more" : "less"} than your calories.`}
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={!parsed || saving}
              onClick={() => parsed && save(parsed)}
              className="h-12 cursor-pointer rounded-btn bg-green px-6 text-[15px] font-semibold text-bg hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save my target"}
            </button>
            <button
              type="button"
              disabled={!parsed || saving || (addsUp ?? 0) <= 0}
              onClick={matchCalories}
              className="h-12 cursor-pointer rounded-btn border-[1.5px] border-border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Match macros to calories
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setOpen(false)}
              className="h-12 cursor-pointer px-3 text-sm text-ink-muted"
            >
              Cancel
            </button>
          </div>

          {custom && (
            <button
              type="button"
              disabled={saving}
              onClick={() => save(null)}
              className="cursor-pointer self-start text-left text-sm font-semibold text-green"
            >
              Go back to calculated ({n0(calculated.kcal)} kcal · P{" "}
              {calculated.proteinG} · C {calculated.carbsG} · F{" "}
              {calculated.fatG})
            </button>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-card bg-terracotta-tint px-3.5 py-2.5 text-[13px]"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function toForm(n: Numbers) {
  return {
    kcal: String(n.kcal),
    proteinG: String(n.proteinG),
    carbsG: String(n.carbsG),
    fatG: String(n.fatG),
  };
}
