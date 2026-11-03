"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/Brand";
import { OptionButton, PrimaryButton } from "@/components/Button";
import { Field } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { DEFAULT_PROFILE, saveDraft, targetOf, toProfile, toRow, type Profile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/client";
import { ACTIVITIES, GOALS, LIMITS, SEXES, type Activity, type Goal, type Sex } from "@/lib/target";

// "Get started" (design/screens/Onboarding.dc.html): goal, body, typical day, and the daily target
// that follows from them, live. A guest's answers wait in the browser until they create an account;
// someone who is already logged in saves them straight to their profile.
// Sex is not in the design: the calorie formula needs it, so it is asked as one extra optional row.

export function OnboardingForm({ member, saved }: { member: boolean; saved: Profile | null }) {
  const router = useRouter();
  const start = saved ?? DEFAULT_PROFILE;
  const [goal, setGoal] = useState<Goal>(start.goal);
  const [activity, setActivity] = useState<Activity>(start.activity);
  const [sex, setSex] = useState<Sex>(start.sex);
  const [age, setAge] = useState(String(start.age));
  const [height, setHeight] = useState(String(start.heightCm));
  const [weight, setWeight] = useState(String(start.weightKg));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The target follows the form live; an incomplete or out-of-range body gives none.
  const profile = toProfile({ goal, activity, sex, age, heightCm: height, weightKg: weight });
  const target = profile ? targetOf(profile) : null;
  const anyTyped = age !== "" || height !== "" || weight !== "";

  async function submit() {
    if (!profile) return;
    setError(null);
    if (!member) {
      // a guest: keep the answers for the sign-up page
      saveDraft(profile);
      router.push("/signup");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
    if (!supabase || !data.user) {
      setSaving(false);
      setError("Please log in again to save your profile.");
      return;
    }
    const { error: failure } = await supabase.from("profiles").upsert({ id: data.user.id, ...toRow(profile) });
    if (failure) {
      setSaving(false);
      setError("We couldn't save your profile. Please try again.");
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <Screen>
      <div className="flex flex-col gap-4 pt-1">
        <Brand />
        <p className="text-sm leading-normal">
          Tell me a bit about you, and I&apos;ll set a daily target that fits your body and your day.
        </p>

        <div className="flex flex-col gap-2">
          <span className="text-xs text-ink-muted">Your goal</span>
          <div className="grid grid-cols-2 gap-2">
            {GOALS.map((g) => (
              <OptionButton key={g.id} selected={goal === g.id} onClick={() => setGoal(g.id)}>
                {g.label}
              </OptionButton>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs text-ink-muted">Sex (the calorie formula differs a little)</span>
          <div className="grid grid-cols-3 gap-2">
            {SEXES.map((s) => (
              <OptionButton key={s.id} selected={sex === s.id} onClick={() => setSex(s.id)} className="px-1">
                {s.label}
              </OptionButton>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Field id="age" label="Age" type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
          <Field id="height" label="Height (cm)" type="number" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} />
          <Field id="weight" label="Weight (kg)" type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        {anyTyped && !profile && (
          <p role="alert" className="-mt-2 text-xs text-fat-ink">
            Age {LIMITS.age.min}–{LIMITS.age.max}, height {LIMITS.heightCm.min}–{LIMITS.heightCm.max} cm and
            weight {LIMITS.weightKg.min}–{LIMITS.weightKg.max} kg, please.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-xs text-ink-muted">Your typical day</span>
          <div className="flex gap-2">
            {ACTIVITIES.map((a) => (
              <OptionButton key={a.id} selected={activity === a.id} onClick={() => setActivity(a.id)} className="flex-1">
                {a.label}
              </OptionButton>
            ))}
          </div>
        </div>

        <section className="flex flex-col gap-2.5 rounded-hero bg-olive px-[18px] py-4">
          <span className="text-xs">Your daily target</span>
          <div className="flex items-baseline gap-1.5">
            <span
              aria-live="polite"
              className={`leading-none ${target ? "font-display text-[34px] text-ink-strong" : "text-[34px] text-ink-muted"}`}
            >
              {target ? target.kcal.toLocaleString("en-US") : "—"}
            </span>
            <span className="text-sm">kcal</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              ["Protein", target?.proteinG],
              ["Carbs", target?.carbsG],
              ["Fat", target?.fatG],
            ].map(([label, grams]) => (
              <span key={label} className="rounded-full bg-cream px-2.5 py-1 text-xs">
                {label} {grams ?? "—"} g
              </span>
            ))}
          </div>
          <span className="text-[11px]">
            {target?.floored
              ? "I kept this at a safe minimum: eating less than this isn't a good idea."
              : "I'll fine-tune this as your weight trend comes in."}
          </span>
        </section>
      </div>

      <div className="sticky bottom-5 mt-6 flex flex-col items-center gap-2 bg-cream pt-2">
        {error && (
          <p role="alert" className="text-xs text-fat-ink">
            {error}
          </p>
        )}
        <PrimaryButton type="button" disabled={!profile || saving} onClick={submit}>
          {saving ? "Saving…" : member ? "Save my profile" : "Let's munch"}
        </PrimaryButton>
        <span className="text-[10px] text-ink-muted">
          Not medical advice. Have a health condition? Check with a pro.
        </span>
      </div>
    </Screen>
  );
}
