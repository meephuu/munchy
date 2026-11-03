// Amounts in a food's natural unit (1 egg, 2 tbsp, 3 slices) next to plain grams. Grams stay the one
// source of truth everywhere else; these helpers only convert for display and input.

/** A unit a food is counted in: `grams` is the weight of one of them. */
export type UnitOption = { label: string; grams: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** How many of `unit` make `grams` (null unit = grams themselves). */
export function toQty(grams: number, unit: UnitOption | null): number {
  return unit ? round2(grams / unit.grams) : grams;
}

export function toGrams(qty: number, unit: UnitOption | null): number {
  return unit ? qty * unit.grams : qty;
}

// Measures that are naturally split in halves; everything else (egg, slice, piece...) goes by whole ones.
const HALVES = new Set(["tbsp", "tsp", "cup", "bowl", "glass", "plate", "serving", "scoop"]);

/** The step of the - / + buttons: 10 g, half a cup/spoon, or one piece. */
export function stepOf(unit: UnitOption | null): number {
  if (!unit) return 10;
  return HALVES.has(unit.label) ? 0.5 : 1;
}

/** "1", "0.5", "2.25": no trailing zeros. */
export function formatQty(qty: number): string {
  return String(round2(qty));
}

/** The unit an amount reads best in, or null for grams: one that gives a whole or half count
 *  between 0.5 and 30 (50 g of boiled egg -> 1 egg). Whole counts beat halves, then fewer beats more. */
export function bestUnit(grams: number, units: UnitOption[]): UnitOption | null {
  if (grams <= 0) return null;
  let best: { unit: UnitOption; score: number; qty: number } | null = null;
  for (const unit of units) {
    const qty = grams / unit.grams;
    if (qty < 0.5 || qty > 30) continue;
    const nearWhole = Math.abs(qty - Math.round(qty)) < 0.02;
    const nearHalf = Math.abs(qty * 2 - Math.round(qty * 2)) < 0.04;
    if (!nearWhole && !nearHalf) continue;
    const score = nearWhole ? 0 : 1;
    if (!best || score < best.score || (score === best.score && qty < best.qty)) best = { unit, score, qty };
  }
  return best?.unit ?? null;
}
