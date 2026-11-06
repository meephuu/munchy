// Talks to the backend (POST /estimate, backend/src/api.py) and turns its response into what
// the dish screen shows. fetchEstimate runs in server components only, so the browser never
// needs the backend URL and no CORS setup is required for this path.

import { BACKEND_URL } from "./backend";
import { dotOf } from "./foodkind";
import type { UnitOption } from "./units";

type ApiTotals = {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
};

/** Response of POST /estimate (EstimateOut in backend/src/api.py). Only the fields we use. */
export type EstimateResponse = {
  input: string;
  totals: ApiTotals;
  lines: {
    name: string;
    grams: number;
    kcal: number;
    per_100g: ApiTotals;
    units: UnitOption[];
  }[];
  assumptions: string[];
  warnings: string[];
  unmatched: string[];
  complete: boolean;
};

export type EstimateErrorKind = "unreachable" | "unclear" | "busy" | "failed";

export class EstimateError extends Error {
  constructor(
    readonly kind: EstimateErrorKind,
    message: string,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 120_000; // a fresh dish needs two or three LLM calls: about 30 s, more when the LLM is slow
const RETRY_DELAY_MS = 1500;

/** One POST to the backend. A refused or dropped connection is tried once more after a moment (the backend may be
 *  restarting or loading its model); a timeout is not retried, because the backend is still working on it and
 *  the answer will be cached for the next try. */
export async function fetchEstimate(
  text: string,
  { retryDelayMs = RETRY_DELAY_MS } = {},
): Promise<EstimateResponse> {
  let res: Response | undefined;
  for (let attempt = 0; attempt < 2 && !res; attempt++) {
    try {
      res = await fetch(`${BACKEND_URL}/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError") {
        throw new EstimateError(
          "busy",
          "This one is taking longer than usual. Try again: it's usually quick the second time.",
        );
      }
      if (attempt === 1)
        throw new EstimateError(
          "unreachable",
          "Can't reach the estimator right now.",
        );
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
  if (!res)
    throw new EstimateError(
      "unreachable",
      "Can't reach the estimator right now.",
    );

  if (res.ok) return (await res.json()) as EstimateResponse;
  if (res.status === 422) {
    throw new EstimateError(
      "unclear",
      "We couldn't read that. Try naming the dish and what's in it.",
    );
  }
  if (res.status === 502 || res.status === 503) {
    throw new EstimateError(
      "busy",
      "The estimator is busy. Try again in a minute.",
    );
  }
  throw new EstimateError(
    "failed",
    "Something went wrong while estimating this dish.",
  );
}

export type Confidence = "Low" | "Medium" | "High";
export type Macros = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

/** One food in the meal, as the AI estimated it. `per100` is what lets the user change `grams`. */
export type Ingredient = {
  name: string;
  grams: number;
  per100: Macros;
  /** Units the food is naturally counted in (besides grams): 1 egg, 2 tbsp... */
  units: UnitOption[];
  /** Colour of the food's kind (see foodkind.ts). */
  dot: string;
  /** Added by the user from the food search, not found by the AI. */
  added?: boolean;
};

/** What the backend found, before the user changes anything. Plain data, safe to pass to the client. */
export type Dish = {
  ingredients: Ingredient[];
  confidence: Confidence;
  /** Input the backend could not find, so it is missing from the total. Worth showing up front. */
  notices: string[];
  /** How the number was reached: assumed amounts, typical parts, and matches that were uncertain. */
  assumptions: string[];
  /** Nothing in the input matched the food database. */
  empty: boolean;
};

const NO_MATCH = "no match found"; // how the backend starts the warning for an input it left out

const round10 = (n: number) => Math.round(n / 10) * 10;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** How much to trust the number, from what the backend had to guess:
 *  Low    - some input could not be matched, so the total is partial;
 *  Medium - everything matched, but there were uncertain matches or assumed amounts/parts;
 *  High   - everything matched cleanly and nothing was assumed. */
export function confidenceOf(
  res: Pick<EstimateResponse, "complete" | "warnings" | "assumptions">,
): Confidence {
  if (!res.complete) return "Low";
  if (res.warnings.length > 0 || res.assumptions.length > 0) return "Medium";
  return "High";
}

export function toDish(res: EstimateResponse): Dish {
  return {
    ingredients: res.lines.map((l) => ({
      name: l.name,
      grams: round1(l.grams),
      per100: {
        kcal: l.per_100g.kcal,
        protein: l.per_100g.protein_g,
        carbs: l.per_100g.carbs_g,
        fat: l.per_100g.fat_g,
      },
      units: l.units,
      dot: dotOf({
        kcal: l.per_100g.kcal,
        protein: l.per_100g.protein_g,
        carbs: l.per_100g.carbs_g,
        fat: l.per_100g.fat_g,
      }),
    })),
    confidence: confidenceOf(res),
    notices: res.unmatched.map(
      (n) =>
        `We couldn't find “${n}” in our food list, so it isn't in the total.`,
    ),
    // Uncertain-match warnings are technical (scores, runner-up names): they live with the
    // assumptions instead of in the main view. "no match found" ones are covered by `notices`.
    assumptions: [
      ...new Set([
        ...res.assumptions,
        ...res.warnings.filter((w) => !w.startsWith(NO_MATCH)),
      ]),
    ],
    empty: res.lines.length === 0,
  };
}

export type Row = {
  name: string;
  grams: number;
  kcal: number;
  /** Grams of each macro in this row at its amount, to one decimal (kept so a logged meal can show them). */
  protein: number;
  carbs: number;
  fat: number;
  dot: string;
  edited: boolean;
  added: boolean;
};

export type Summary = Macros & {
  weight: number;
  low: number;
  high: number;
  rows: Row[];
  /** True if the user changed an amount or added a food. */
  edited: boolean;
};

/** The numbers for the amounts the user has chosen (`grams`, one per ingredient, in order).
 *  Each food's nutrients scale linearly with its weight, so this is plain arithmetic on the
 *  per-100 g values the backend sent; with unchanged amounts it reproduces the backend totals. */
export function summarize(dish: Dish, grams: number[]): Summary {
  const total: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let weight = 0;
  const rows = dish.ingredients.map((ing, i) => {
    const g = grams[i] ?? ing.grams;
    const k = g / 100;
    total.kcal += ing.per100.kcal * k;
    total.protein += ing.per100.protein * k;
    total.carbs += ing.per100.carbs * k;
    total.fat += ing.per100.fat * k;
    weight += g;
    return {
      name: ing.name,
      grams: g,
      kcal: Math.round(ing.per100.kcal * k),
      protein: round1(ing.per100.protein * k),
      carbs: round1(ing.per100.carbs * k),
      fat: round1(ing.per100.fat * k),
      dot: ing.dot,
      edited: g !== ing.grams,
      added: !!ing.added,
    };
  });
  const kcal = Math.round(total.kcal);
  return {
    kcal,
    protein: Math.round(total.protein),
    carbs: Math.round(total.carbs),
    fat: Math.round(total.fat),
    weight: Math.round(weight),
    // The estimate is shown as roughly +/-14%, rounded to the nearest 10 (DESIGN.md).
    low: round10(kcal * 0.86),
    high: round10(kcal * 1.14),
    rows,
    edited: rows.some((r) => r.edited || r.added),
  };
}
