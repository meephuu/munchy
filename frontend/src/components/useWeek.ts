"use client";

import { useCallback, useEffect, useState } from "react";
import { lastDays, type DayMeal, type Weigh } from "@/lib/progress";
import { createClient } from "@/lib/supabase/client";

export type WeekData = {
  meals: DayMeal[];
  weighs: Weigh[];
  logged: string[];
  now: Date;
};
export type WeekState =
  | { kind: "loading" }
  | {
      kind: "error";
      error: { code?: string; message?: string; status?: number };
    }
  | { kind: "ready"; data: WeekData };

/** The last 60 days of meals (for the week's bars, the streak and the protein average) and weigh-ins, loaded in the
 *  browser because "a day" is the person's own local day. `reload` fetches again (after logging a weight). */
export function useWeek(): { state: WeekState; reload: () => Promise<void> } {
  const [state, setState] = useState<WeekState>({ kind: "loading" });

  const reload = useCallback(async () => {
    const supabase = createClient();
    if (!supabase)
      return setState({
        kind: "error",
        error: { message: "Accounts aren't switched on." },
      });
    const now = new Date();
    const since = lastDays(now, 60)[0];
    const [meals, weights] = await Promise.all([
      supabase
        .from("meals")
        .select("eaten_on,kcal,protein_g")
        .gte("eaten_on", since)
        .limit(2000),
      supabase
        .from("weights")
        .select("logged_on,kg")
        .gte("logged_on", since)
        .order("logged_on", { ascending: true }),
    ]);
    const error = meals.error ?? weights.error;
    if (error) return setState({ kind: "error", error });
    const rows = (meals.data ?? []).map((r) => ({
      eatenOn: String(r.eaten_on),
      kcal: Number(r.kcal),
      protein: Number(r.protein_g),
    }));
    setState({
      kind: "ready",
      data: {
        meals: rows,
        logged: rows.map((r) => r.eatenOn),
        weighs: (weights.data ?? []).map((r) => ({
          loggedOn: String(r.logged_on),
          kg: Number(r.kg),
        })),
        now,
      },
    });
  }, []);

  useEffect(() => {
    // reload() is async: it only sets state after the requests return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  return { state, reload };
}
