// Talks to the backend (POST /estimate, backend/src/api.py) and turns its response into what
// the dish screen shows. fetchEstimate runs in server components only, so the browser never
// needs the backend URL and no CORS setup is required for this path.

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

type ApiTotals = { kcal: number; protein_g: number; fat_g: number; carbs_g: number };

/** Response of POST /estimate (EstimateOut in backend/src/api.py). Only the fields we use. */
export type EstimateResponse = {
  input: string;
  totals: ApiTotals;
  lines: { name: string; grams: number; kcal: number; per_100g: ApiTotals }[];
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

export async function fetchEstimate(text: string): Promise<EstimateResponse> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000), // a fresh LLM parse can take a few seconds
    });
  } catch {
    throw new EstimateError("unreachable", "Can't reach the estimator right now.");
  }

  if (res.ok) return (await res.json()) as EstimateResponse;
  if (res.status === 422) {
    throw new EstimateError("unclear", "We couldn't read that. Try naming the dish and what's in it.");
  }
  if (res.status === 502 || res.status === 503) {
    throw new EstimateError("busy", "The estimator is busy. Try again in a minute.");
  }
  throw new EstimateError("failed", "Something went wrong while estimating this dish.");
}

export type Confidence = "Low" | "Medium" | "High";
export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

/** One food in the meal, as the AI estimated it. `per100` is what lets the user change `grams`. */
export type Ingredient = { name: string; grams: number; per100: Macros; dot: string };

/** What the backend found, before the user changes anything. Plain data, safe to pass to the client. */
export type Dish = {
  ingredients: Ingredient[];
  confidence: Confidence;
  warnings: string[];
  assumptions: string[];
  /** Nothing in the input matched the food database. */
  empty: boolean;
};

// Dots in the ingredient list cycle through the macro colors.
const DOTS = ["var(--color-yolk)", "var(--color-orange)", "var(--color-egg)", "var(--color-teal)"];

const round10 = (n: number) => Math.round(n / 10) * 10;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** How much to trust the number, from what the backend had to guess:
 *  Low    - some input could not be matched, so the total is partial;
 *  Medium - everything matched, but there were uncertain matches or assumed amounts/parts;
 *  High   - everything matched cleanly and nothing was assumed. */
export function confidenceOf(res: Pick<EstimateResponse, "complete" | "warnings" | "assumptions">): Confidence {
  if (!res.complete) return "Low";
  if (res.warnings.length > 0 || res.assumptions.length > 0) return "Medium";
  return "High";
}

export function toDish(res: EstimateResponse): Dish {
  return {
    ingredients: res.lines.map((l, i) => ({
      name: l.name,
      grams: round1(l.grams),
      per100: {
        kcal: l.per_100g.kcal,
        protein: l.per_100g.protein_g,
        carbs: l.per_100g.carbs_g,
        fat: l.per_100g.fat_g,
      },
      dot: DOTS[i % DOTS.length],
    })),
    confidence: confidenceOf(res),
    warnings: res.warnings,
    assumptions: [...new Set(res.assumptions)],
    empty: res.lines.length === 0,
  };
}

export type Row = { name: string; grams: number; kcal: number; dot: string; edited: boolean };

export type Summary = Macros & {
  weight: number;
  low: number;
  high: number;
  rows: Row[];
  /** True if any amount differs from the AI's estimate. */
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
    return { name: ing.name, grams: g, kcal: Math.round(ing.per100.kcal * k), dot: ing.dot, edited: g !== ing.grams };
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
    edited: rows.some((r) => r.edited),
  };
}
