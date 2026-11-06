// What the desktop sidebar shows about the logged-in person: the email, and the "Daily target" tile.

import type { Profile } from "./profile";
import { targetOf } from "./profile";
import { ACTIVITIES, GOALS } from "./target";

export type MemberShell = {
  email: string | null;
  /** Daily calorie target, or null when the profile is not set up yet. */
  targetKcal: number | null;
  /** "Stay balanced · On my feet" */
  targetLine: string | null;
};

export function memberShell(email: string | null, profile: Profile | null): MemberShell {
  if (!profile) return { email, targetKcal: null, targetLine: null };
  const goal = GOALS.find((g) => g.id === profile.goal)?.label;
  const activity = ACTIVITIES.find((a) => a.id === profile.activity)?.label;
  return {
    email,
    targetKcal: targetOf(profile).kcal,
    targetLine: [goal, activity].filter(Boolean).join(" · ") || null,
  };
}
