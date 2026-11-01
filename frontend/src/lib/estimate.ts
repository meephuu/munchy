// Talks to the backend (POST /estimate, backend/src/api.py) and turns its response into what
// the dish screen shows. Called from server components only, so the browser never needs the
// backend URL and no CORS setup is required for this path.

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

/** Response of POST /estimate (EstimateOut in backend/src/api.py). Only the fields we use. */
export type EstimateResponse = {
  input: string;
  totals: { kcal: number; protein_g: number; fat_g: number; carbs_g: number };
  lines: { name: string; grams: number; kcal: number }[];
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
export type Part = { name: string; amount: string; kcal: number; dot: string };

export type DishView = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  grams: number;
  low: number;
  high: number;
  confidence: Confidence;
  parts: Part[];
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

export function toView(res: EstimateResponse): DishView {
  const kcal = Math.round(res.totals.kcal);
  return {
    kcal,
    protein: Math.round(res.totals.protein_g),
    carbs: Math.round(res.totals.carbs_g),
    fat: Math.round(res.totals.fat_g),
    grams: Math.round(res.lines.reduce((sum, l) => sum + l.grams, 0)),
    // The estimate is shown as roughly +/-14%, rounded to the nearest 10 (DESIGN.md).
    low: round10(kcal * 0.86),
    high: round10(kcal * 1.14),
    confidence: confidenceOf(res),
    parts: res.lines.map((l, i) => ({
      name: l.name,
      amount: `${round1(l.grams)} g`,
      kcal: Math.round(l.kcal),
      dot: DOTS[i % DOTS.length],
    })),
    warnings: res.warnings,
    assumptions: [...new Set(res.assumptions)],
    empty: res.lines.length === 0,
  };
}
