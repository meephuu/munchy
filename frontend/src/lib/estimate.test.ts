import { afterEach, describe, expect, it, vi } from "vitest";
import {
  confidenceOf,
  EstimateError,
  fetchEstimate,
  summarize,
  toDish,
  type EstimateResponse,
} from "./estimate";

const per100 = (kcal: number, protein_g: number, fat_g: number, carbs_g: number) => ({
  kcal,
  protein_g,
  fat_g,
  carbs_g,
});

const response = (over: Partial<EstimateResponse> = {}): EstimateResponse => ({
  input: "x",
  totals: { kcal: 582.4, protein_g: 33.7, fat_g: 26.0, carbs_g: 54.1 },
  lines: [
    { name: "steamed sticky rice", grams: 90, kcal: 207.2, per_100g: per100(230, 4.2, 0.5, 51.8), units: [{ label: "pack", grams: 90 }] },
    { name: "grilled pork skewer", grams: 150, kcal: 375, per_100g: per100(250, 20, 17, 5), units: [{ label: "skewer", grams: 30 }] },
  ],
  assumptions: [],
  warnings: [],
  unmatched: [],
  complete: true,
  ...over,
});

describe("toDish", () => {
  it("keeps each food with its amount and per-100 g nutrients", () => {
    const [rice, pork] = toDish(response()).ingredients;
    expect(rice).toMatchObject({ name: "steamed sticky rice", grams: 90, per100: { kcal: 230, protein: 4.2, fat: 0.5, carbs: 51.8 } });
    expect(pork.grams).toBe(150);
    expect(pork.units).toEqual([{ label: "skewer", grams: 30 }]);
    expect(rice.dot).not.toBe(pork.dot);
  });

  it("keeps technical uncertain-match warnings with the assumptions, not as notices", () => {
    const d = toDish(response({ warnings: ["uncertain match: 'x' -> y (0.71); other candidates: z"] }));
    expect(d.notices).toEqual([]);
    expect(d.assumptions).toEqual(["uncertain match: 'x' -> y (0.71); other candidates: z"]);
  });

  it("turns an input that could not be found into a plain-language notice", () => {
    const d = toDish(response({
      complete: false,
      unmatched: ["beer"],
      warnings: ["no match found for 'beer': not counted, so the totals are incomplete"],
    }));
    expect(d.notices).toEqual(["We couldn't find “beer” in our food list, so it isn't in the total."]);
    expect(d.assumptions).toEqual([]);                          // not repeated in the technical list
  });

  it("de-duplicates assumptions and flags an estimate with no lines as empty", () => {
    const d = toDish(response({ assumptions: ["assumed 1 serving", "assumed 1 serving"] }));
    expect(d.assumptions).toEqual(["assumed 1 serving"]);
    expect(d.empty).toBe(false);
    expect(toDish(response({ lines: [], complete: false })).empty).toBe(true);
  });
});

describe("summarize", () => {
  const dish = toDish(response());
  const asEstimated = dish.ingredients.map((i) => i.grams);

  it("with the AI's amounts reproduces the backend's totals", () => {
    const s = summarize(dish, asEstimated);
    expect([s.kcal, s.protein, s.fat, s.carbs, s.weight]).toEqual([582, 34, 26, 54, 240]);
    expect([s.low, s.high]).toEqual([500, 660]);
    expect(s.edited).toBe(false);
    expect(s.rows.map((r) => r.kcal)).toEqual([207, 375]);
  });

  it("rescales a food's nutrients when its amount changes and marks the row edited", () => {
    const s = summarize(dish, [90, 75]);                    // half the pork
    expect(s.rows[1]).toMatchObject({ grams: 75, kcal: 188, edited: true });
    expect(s.rows[0].edited).toBe(false);
    expect(s.kcal).toBe(Math.round(230 * 0.9 + 250 * 0.75));
    expect(s.weight).toBe(165);
    expect(s.edited).toBe(true);
  });

  it("treats 0 g as taking the food out, and can bring it back from 0", () => {
    expect(summarize(dish, [0, 150]).rows[0]).toMatchObject({ grams: 0, kcal: 0 });
    expect(summarize(dish, [0, 150]).kcal).toBe(375);
    expect(summarize(dish, [0, 0]).kcal).toBe(0);
    expect(summarize(dish, [200, 150]).rows[0].kcal).toBe(460);   // per-100 g values never lose precision
  });

  it("recomputes the +/-14% range from the new total", () => {
    const s = summarize(dish, [90, 0]);
    expect([s.kcal, s.low, s.high]).toEqual([207, 180, 240]);
  });
});

describe("confidenceOf", () => {
  it("is Low when part of the input could not be matched", () => {
    expect(confidenceOf(response({ complete: false }))).toBe("Low");
  });
  it("is Medium when something was uncertain or assumed", () => {
    expect(confidenceOf(response({ warnings: ["uncertain match"] }))).toBe("Medium");
    expect(confidenceOf(response({ assumptions: ["assumed 1 serving"] }))).toBe("Medium");
  });
  it("is High only when everything matched cleanly with nothing assumed", () => {
    expect(confidenceOf(response())).toBe("High");
  });
});

describe("fetchEstimate", () => {
  afterEach(() => vi.unstubAllGlobals());
  const reply = (status: number, body: unknown = {}) =>
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));

  it("posts the text and returns the parsed response", async () => {
    reply(200, response());
    const res = await fetchEstimate("ข้าวเหนียวหมูปิ้ง 5 ไม้");
    expect(res.totals.kcal).toBe(582.4);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/estimate$/);
    expect(JSON.parse(init!.body as string)).toEqual({ text: "ข้าวเหนียวหมูปิ้ง 5 ไม้" });
  });

  it.each([
    [422, "unclear"],
    [502, "busy"],
    [503, "busy"],
    [500, "failed"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    reply(status, { detail: "internal detail that must not reach the user" });
    const err = await fetchEstimate("x").catch((e) => e);
    expect(err).toBeInstanceOf(EstimateError);
    expect(err.kind).toBe(kind);
    expect(err.message).not.toMatch(/internal detail/);
  });

  it("reports an unreachable backend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const err = await fetchEstimate("x").catch((e) => e);
    expect(err.kind).toBe("unreachable");
  });
});
