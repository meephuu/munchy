"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/Brand";
import { OptionButton, PrimaryButton } from "@/components/Button";
import { Field } from "@/components/Field";
import { ArrowLeftIcon } from "@/components/Icons";
import { Screen } from "@/components/Screen";
import { Eyebrow, Title } from "@/components/Type";
import { ageOn, parseBirth, splitBirth } from "@/lib/birth";
import {
  DEFAULT_PROFILE,
  saveDraft,
  targetOf,
  toProfile,
  toRow,
  type Profile,
} from "@/lib/profile";
import type { MemberShell } from "@/lib/shell";
import { createClient } from "@/lib/supabase/client";
import {
  ACTIVITIES,
  GOALS,
  LIMITS,
  SEXES,
  type Activity,
  type Goal,
  type Sex,
} from "@/lib/target";

// "Get started" (design/screens/Onboarding.dc.html): goal, body, typical day, and the daily target
// that follows from them, live. A guest's answers wait in the browser until they create an account;
// someone who is already logged in saves them straight to their profile.
// Sex is not in the design: the calorie formula needs it, so it is asked as one extra optional row.

export function OnboardingForm({
  member,
  shell = null,
  saved,
}: {
  member: boolean;
  /** What the sidebar shows for a logged-in person (null for a guest). */
  shell?: MemberShell | null;
  saved: Profile | null;
}) {
  const router = useRouter();
  const start = saved ?? DEFAULT_PROFILE;
  const [goal, setGoal] = useState<Goal>(start.goal);
  const [activity, setActivity] = useState<Activity>(start.activity);
  const [sex, setSex] = useState<Sex>(start.sex);
  const [birth, setBirth] = useState(() => splitBirth(start.birthDate));
  const [height, setHeight] = useState(String(start.heightCm));
  const [weight, setWeight] = useState(String(start.weightKg));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The target follows the form live; an incomplete or out-of-range body gives none.
  const birthDate = parseBirth(birth);
  const profile = toProfile({
    goal,
    activity,
    sex,
    age: NaN,
    birthDate,
    heightCm: height,
    weightKg: weight,
  });
  const age = birthDate ? ageOn(birthDate, new Date()) : null;
  const target = profile ? targetOf(profile) : null;
  const anyTyped =
    birth.day !== "" ||
    birth.month !== "" ||
    birth.year !== "" ||
    height !== "" ||
    weight !== "";

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
    const { data } = (await supabase?.auth.getUser()) ?? {
      data: { user: null },
    };
    if (!supabase || !data.user) {
      setSaving(false);
      setError("Please log in again to save your profile.");
      return;
    }
    const row = { id: data.user.id, ...toRow(profile) };
    let { error: failure } = await supabase.from("profiles").upsert(row);
    if (
      failure &&
      /birth_date/.test(`${failure.message} ${failure.details ?? ""}`)
    ) {
      // the birth_date column is not in the database yet (migration not run): save without it, age still saved
      const { birth_date: _unused, ...withoutDate } = row;
      void _unused;
      ({ error: failure } = await supabase
        .from("profiles")
        .upsert(withoutDate));
    }
    if (failure) {
      setSaving(false);
      setError("We couldn't save your profile. Please try again.");
      return;
    }
    router.push("/account");
    router.refresh();
  }

  return (
    <Screen
      shell={
        shell
          ? { kind: "member", member: shell }
          : { kind: "guest", hasAccountHint: true }
      }
    >
      <div className="flex flex-col gap-3.5 pt-1 desk:gap-7 desk:pt-0">
        {member ? (
          <header className="flex items-center gap-3 pt-1">
            <Link
              href="/account"
              aria-label="Back to Account"
              className="flex size-11 shrink-0 items-center justify-center rounded-row bg-surface text-ink shadow-row desk:hidden"
            >
              <ArrowLeftIcon size={20} />
            </Link>
            <div className="flex flex-col gap-0.5">
              <Eyebrow>Account</Eyebrow>
              <Title
                lead="Edit your"
                accent="profile"
                className="text-xl desk:text-4xl"
              />
            </div>
          </header>
        ) : (
          <>
            <div className="desk:hidden">
              <Brand />
            </div>
            <div className="flex flex-col gap-2">
              <Eyebrow className="hidden desk:block">
                Get started · 1 minute
              </Eyebrow>
              <Title
                lead="How much should you eat,"
                accent="every day?"
                className="text-[26px] desk:text-[40px]"
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-3.5 desk:flex-row desk:flex-wrap desk:items-start desk:gap-6">
          <div className="contents desk:flex desk:min-w-0 desk:flex-[1.6_1_520px] desk:flex-col desk:gap-[26px] desk:rounded-hero desk:bg-surface desk:p-8 desk:shadow-card">
            <div className="flex flex-col gap-2">
              <Eyebrow tone="muted">Your goal</Eyebrow>
              <div className="grid grid-cols-2 gap-2 desk:grid-cols-4 desk:gap-2.5">
                {GOALS.map((g) => (
                  <OptionButton
                    key={g.id}
                    selected={goal === g.id}
                    onClick={() => setGoal(g.id)}
                    className="desk:h-12 desk:text-sm"
                  >
                    {g.label}
                  </OptionButton>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Eyebrow tone="muted">Sex · used in the formula</Eyebrow>
              <div className="grid grid-cols-3 gap-2">
                {SEXES.map((s) => (
                  <OptionButton
                    key={s.id}
                    selected={sex === s.id}
                    onClick={() => setSex(s.id)}
                    className="px-1 desk:h-12 desk:text-sm"
                  >
                    {s.label}
                  </OptionButton>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Eyebrow tone="muted">
                Date of birth{age !== null ? ` · ${age} years old` : ""}
              </Eyebrow>
              <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
                <Field
                  id="birth-day"
                  label="Day"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="DD"
                  autoComplete="bday-day"
                  value={birth.day}
                  onChange={(e) =>
                    setBirth((b) => ({ ...b, day: e.target.value }))
                  }
                />
                <Field
                  id="birth-month"
                  label="Month"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="MM"
                  autoComplete="bday-month"
                  value={birth.month}
                  onChange={(e) =>
                    setBirth((b) => ({ ...b, month: e.target.value }))
                  }
                />
                <Field
                  id="birth-year"
                  label="Year"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="YYYY"
                  autoComplete="bday-year"
                  value={birth.year}
                  onChange={(e) =>
                    setBirth((b) => ({ ...b, year: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field
                id="height"
                label="Height cm"
                type="number"
                inputMode="decimal"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
              <Field
                id="weight"
                label="Weight kg"
                type="number"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            {anyTyped && !profile && (
              <p role="alert" className="-mt-1.5 text-xs text-terracotta-text">
                A real date of birth (you must be {LIMITS.age.min}–
                {LIMITS.age.max}
                ), height {LIMITS.heightCm.min}–{LIMITS.heightCm.max} cm and
                weight {LIMITS.weightKg.min}–{LIMITS.weightKg.max} kg, please.
              </p>
            )}

            <div className="flex flex-col gap-2">
              <Eyebrow tone="muted">Your typical day</Eyebrow>
              <div className="flex gap-2">
                {ACTIVITIES.map((a) => (
                  <OptionButton
                    key={a.id}
                    selected={activity === a.id}
                    onClick={() => setActivity(a.id)}
                    className="flex-1 desk:h-12 desk:text-sm"
                  >
                    {a.label}
                  </OptionButton>
                ))}
              </div>
            </div>
          </div>

          <div className="contents desk:sticky desk:top-6 desk:flex desk:min-w-0 desk:flex-[1_1_320px] desk:flex-col desk:gap-4 desk:rounded-hero desk:bg-green desk:p-8 desk:text-bg">
            <section className="flex flex-col gap-2.5 rounded-hero bg-surface px-[18px] py-4 shadow-card desk:gap-4 desk:rounded-none desk:bg-transparent desk:p-0 desk:shadow-none">
              <Eyebrow className="desk:text-gold">Your daily target</Eyebrow>
              <div className="flex items-baseline gap-1.5">
                <span
                  aria-live="polite"
                  className={`leading-none desk:text-[64px] ${target ? "font-brand text-4xl text-green desk:text-bg" : "text-4xl text-ink-muted desk:text-green-soft"}`}
                >
                  {target ? target.kcal.toLocaleString("en-US") : "—"}
                </span>
                <span className="text-sm font-semibold desk:text-[17px]">
                  kcal
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  tone="bg-green-tint text-green"
                  label="Protein"
                  grams={target?.proteinG}
                />
                <Badge
                  tone="bg-bronze-tint text-bronze"
                  label="Carbs"
                  grams={target?.carbsG}
                />
                <Badge
                  tone="bg-terracotta-tint text-terracotta-text"
                  label="Fat"
                  grams={target?.fatG}
                />
              </div>
              <p className="hidden text-[13px] leading-normal text-green-soft desk:block">
                Worked out with the Mifflin-St Jeor formula from your body, your
                typical day and your goal.
              </p>
              {target?.floored && (
                <span className="text-[11px] text-ink-muted desk:text-green-soft">
                  I kept this at a safe minimum: eating less than this
                  isn&apos;t a good idea.
                </span>
              )}
            </section>

            <div className="sticky bottom-5 mt-6 flex flex-col items-center gap-2 bg-bg pt-2 desk:static desk:mt-0 desk:items-stretch desk:bg-transparent desk:pt-0">
              {error && (
                <p
                  role="alert"
                  className="text-xs text-terracotta-text desk:text-gold"
                >
                  {error}
                </p>
              )}
              <PrimaryButton
                type="button"
                disabled={!profile || saving}
                onClick={submit}
                className="desk:bg-bg desk:text-green desk:hover:bg-surface"
              >
                {saving ? "Saving…" : member ? "Save changes" : "Let's munch"}
              </PrimaryButton>
              <span className="text-center font-mono text-[9px] tracking-[0.5px] text-ink-muted uppercase desk:text-green-soft">
                Not medical advice · check with a pro if you have a condition
              </span>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  );
}

function Badge({
  tone,
  label,
  grams,
}: {
  tone: string;
  label: string;
  grams: number | undefined;
}) {
  return (
    <span
      className={`rounded-badge px-2.5 py-1 text-xs font-semibold desk:bg-white/10 desk:text-bg ${tone}`}
    >
      {label} {grams ?? "—"} g
    </span>
  );
}
