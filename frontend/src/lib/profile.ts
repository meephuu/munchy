// A person's profile: what they told us (goal, activity, body) and the daily target worked out from it.
// Stored in Supabase as one row per account (see supabase/migrations). Everything here is pure.

import { ageOn } from "./birth";
import {
  ACTIVITIES,
  dailyTarget,
  GOALS,
  isValidBody,
  SEXES,
  type Activity,
  type Goal,
  type Sex,
  type Target,
} from "./target";

export type Profile = {
  goal: Goal;
  activity: Activity;
  sex: Sex;
  /** Whole years, worked out from `birthDate` when there is one (else the age saved before dates of birth existed). */
  age: number;
  /** YYYY-MM-DD; null for profiles saved before we asked for it. */
  birthDate: string | null;
  heightCm: number;
  weightKg: number;
};

/** A profile row as it is stored (snake_case, with the target saved next to the inputs). */
export type ProfileRow = {
  goal: Goal;
  activity: Activity;
  sex: Sex;
  age: number;
  birth_date: string | null;
  height_cm: number;
  weight_kg: number;
  target_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export const DEFAULT_PROFILE: Profile = {
  goal: "maintain",
  activity: "desk",
  sex: "unspecified",
  age: 21,
  birthDate: null,
  heightCm: 174,
  weightKg: 68,
};

const isOneOf = <T extends string>(list: { id: T }[], v: unknown): v is T => list.some((x) => x.id === v);

/** A Profile from untrusted data (a saved draft, a database row...), or null if anything is off. */
export function toProfile(raw: unknown, now: Date = new Date()): Profile | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const birthDate = typeof r.birthDate === "string" && r.birthDate ? r.birthDate : null;
  // with a date of birth the age follows it (and a bad date is refused); without one, the age as given
  const age = birthDate ? ageOn(birthDate, now) : Number(r.age);
  const profile = {
    goal: r.goal,
    activity: r.activity,
    sex: r.sex,
    age,
    birthDate,
    heightCm: Number(r.heightCm),
    weightKg: Number(r.weightKg),
  };
  if (!isOneOf(GOALS, profile.goal) || !isOneOf(ACTIVITIES, profile.activity) || !isOneOf(SEXES, profile.sex)) {
    return null;
  }
  const p = profile as Profile;
  return isValidBody(p) ? p : null;
}

export function targetOf(p: Profile): Target {
  return dailyTarget(p, p.goal, p.activity)!; // a valid Profile always has a target
}

export function toRow(p: Profile): ProfileRow {
  const t = targetOf(p);
  return {
    goal: p.goal,
    activity: p.activity,
    sex: p.sex,
    age: p.age,
    birth_date: p.birthDate,
    height_cm: p.heightCm,
    weight_kg: p.weightKg,
    target_kcal: t.kcal,
    protein_g: t.proteinG,
    carbs_g: t.carbsG,
    fat_g: t.fatG,
  };
}

/** The profile in a row (as returned by Supabase), or null if it does not hold a valid one. */
export function fromRow(row: unknown): Profile | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  return toProfile({ goal: r.goal, activity: r.activity, sex: r.sex, age: r.age, birthDate: r.birth_date, heightCm: r.height_cm, weightKg: r.weight_kg });
}

// A guest fills the profile in before they have an account; it waits here until they sign up.
export const DRAFT_KEY = "munchy.profile-draft";

/** The draft saved in sessionStorage (its raw text), as a Profile, or null if there is none or it is invalid. */
export function parseDraft(text: string | null): Profile | null {
  if (!text) return null;
  try {
    return toProfile(JSON.parse(text));
  } catch {
    return null;
  }
}

export function saveDraft(p: Profile): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(p));
  } catch {
    /* private mode or storage full: the sign-up page will send them back to the form */
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to clear */
  }
}
