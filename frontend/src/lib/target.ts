// Daily calorie and macro target from a person's body, activity and goal (DESIGN.md: Mifflin-St Jeor
// BMR x activity factor, adjusted for the goal; protein by body weight). Pure and deterministic.
// Approximate by nature, and never aimed at an extreme deficit: see the floor in dailyTarget.

export type Goal = "lose" | "maintain" | "gain" | "muscle";
export type Activity = "desk" | "feet" | "active";
export type Sex = "female" | "male" | "unspecified";

export type Body = { sex: Sex; age: number; heightCm: number; weightKg: number };

export const GOALS: { id: Goal; label: string; kcalFactor: number; proteinPerKg: number }[] = [
  { id: "lose", label: "Lose weight", kcalFactor: 0.85, proteinPerKg: 1.9 }, // 15% below maintenance
  { id: "maintain", label: "Stay balanced", kcalFactor: 1, proteinPerKg: 1.5 },
  { id: "gain", label: "Gain weight", kcalFactor: 1.12, proteinPerKg: 1.7 },
  { id: "muscle", label: "Build muscle", kcalFactor: 1.08, proteinPerKg: 2 },
];

export const ACTIVITIES: { id: Activity; label: string; factor: number }[] = [
  { id: "desk", label: "Desk job", factor: 1.2 },
  { id: "feet", label: "On my feet", factor: 1.4 },
  { id: "active", label: "Very active", factor: 1.6 },
];

export const SEXES: { id: Sex; label: string }[] = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "unspecified", label: "Prefer not to say" },
];

// What the formula accepts. Below 14 the adult formula does not apply.
export const LIMITS = {
  age: { min: 14, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 250 },
} as const;

const FAT_SHARE = 0.28; // of calories
const MAX_PROTEIN_SHARE = 0.35; // of calories: keeps protein sensible for very heavy people on a low target
const MIN_KCAL = 1200; // never target less than this

// Mifflin-St Jeor constant by sex; "prefer not to say" uses the midpoint of the two.
const SEX_OFFSET: Record<Sex, number> = { male: 5, female: -161, unspecified: -78 };

export type Target = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Calories the body burns at rest, and with the chosen activity, before the goal adjustment. */
  bmr: number;
  maintenance: number;
  /** The goal asked for less than is safe, so the target was raised to the floor. */
  floored: boolean;
  /** The person set these numbers themselves instead of using the calculated ones. */
  custom?: boolean;
};

const inRange = (n: number, r: { min: number; max: number }) =>
  Number.isFinite(n) && n >= r.min && n <= r.max;

export function isValidBody(b: Body): boolean {
  return inRange(b.age, LIMITS.age) && inRange(b.heightCm, LIMITS.heightCm) && inRange(b.weightKg, LIMITS.weightKg);
}

export function bmrOf(b: Body): number {
  return 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.age + SEX_OFFSET[b.sex];
}

const round10 = (n: number) => Math.round(n / 10) * 10;

/** The daily target, or null if the body numbers are outside what the formula supports. */
export function dailyTarget(body: Body, goal: Goal, activity: Activity): Target | null {
  if (!isValidBody(body)) return null;
  const g = GOALS.find((x) => x.id === goal)!;
  const a = ACTIVITIES.find((x) => x.id === activity)!;

  const bmr = bmrOf(body);
  const maintenance = bmr * a.factor;
  const wanted = round10(maintenance * g.kcalFactor);
  const floor = Math.max(MIN_KCAL, round10(bmr)); // not below the body's resting needs
  const kcal = goal === "lose" ? Math.max(wanted, floor) : wanted;

  const fatG = Math.round((kcal * FAT_SHARE) / 9);
  const proteinG = Math.min(
    Math.round(g.proteinPerKg * body.weightKg),
    Math.floor((kcal * MAX_PROTEIN_SHARE) / 4),
  );
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));

  return {
    kcal,
    proteinG,
    carbsG,
    fatG,
    bmr: Math.round(bmr),
    maintenance: Math.round(maintenance),
    floored: goal === "lose" && wanted < floor,
  };
}
