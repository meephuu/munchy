import { afterEach, describe, expect, it, vi } from "vitest";
import { confidenceOf, EstimateError, fetchEstimate, toView, type EstimateResponse } from "./estimate";

const response = (over: Partial<EstimateResponse> = {}): EstimateResponse => ({
  input: "x",
  totals: { kcal: 582.4, protein_g: 33.7, fat_g: 26.0, carbs_g: 54.1 },
  lines: [
    { name: "steamed sticky rice", grams: 90, kcal: 207.2 },
    { name: "grilled pork skewer", grams: 150, kcal: 375 },
  ],
  assumptions: [],
  warnings: [],
  unmatched: [],
  complete: true,
  ...over,
});

describe("toView", () => {
  it("rounds totals, sums the weight and shows a range of about +/-14% to the nearest 10", () => {
    const v = toView(response());
    expect([v.kcal, v.protein, v.fat, v.carbs, v.grams]).toEqual([582, 34, 26, 54, 240]);
    expect([v.low, v.high]).toEqual([500, 660]);
  });

  it("turns lines into ingredient rows with grams and kcal", () => {
    const [rice, pork] = toView(response()).parts;
    expect(rice).toMatchObject({ name: "steamed sticky rice", amount: "90 g", kcal: 207 });
    expect(pork.amount).toBe("150 g");
    expect(rice.dot).not.toBe(pork.dot);
  });

  it("keeps one decimal for small amounts and de-duplicates assumptions", () => {
    const v = toView(response({
      lines: [{ name: "parmesan", grams: 5.04, kcal: 21 }],
      assumptions: ["assumed 1 serving", "assumed 1 serving"],
    }));
    expect(v.parts[0].amount).toBe("5 g");
    expect(v.assumptions).toEqual(["assumed 1 serving"]);
  });

  it("flags an estimate with no lines as empty", () => {
    expect(toView(response({ lines: [], complete: false })).empty).toBe(true);
    expect(toView(response()).empty).toBe(false);
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
