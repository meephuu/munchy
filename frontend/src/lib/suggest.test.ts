import { describe, expect, it } from "vitest";
import { newIdeas, recentDishes, suggestionsFor } from "./suggest";

const day = (d: number) => new Date(2026, 10, d, 12);

describe("recentDishes", () => {
  it("keeps newest first, one per dish however it was typed", () => {
    expect(recentDishes(["Pad thai", "som tam", "  pad  THAI ", "Larb"])).toEqual(["Pad thai", "som tam", "Larb"]);
  });
  it("respects the limit and skips blanks", () => {
    expect(recentDishes(["a", " ", "b", "c"], 2)).toEqual(["a", "b"]);
  });
});

describe("newIdeas", () => {
  it("never suggests what the person already has", () => {
    const ideas = newIdeas("maintain", ["khao man gai", "Pad thai with shrimp"], day(1), 50);
    const titles = ideas.map((i) => i.title.toLowerCase());
    expect(titles).not.toContain("khao man gai");
    expect(titles).not.toContain("pad thai with shrimp");
    expect(ideas.every((i) => i.kind === "new")).toBe(true);
  });
  it("puts dishes that suit the goal first", () => {
    const ideas = newIdeas("lose", [], day(1), 3).map((i) => i.title);
    expect(ideas).toHaveLength(3);
    expect(ideas).not.toContain("Massaman curry with rice"); // a gain dish
  });
  it("changes from day to day", () => {
    expect(newIdeas("maintain", [], day(1))).not.toEqual(newIdeas("maintain", [], day(2)));
  });
  it("still suggests something with no goal", () => {
    expect(newIdeas(null, [], day(1))).toHaveLength(4);
  });
});

describe("suggestionsFor", () => {
  const pools = {
    favorites: ["Pad kra pao"],
    recent: ["Som tam", "pad kra pao", "Pad thai"],
    ideas: [{ title: "Papaya salad", kind: "new" as const }],
  };
  it("shows favorites, then recent, then ideas for an empty box, each dish once", () => {
    expect(suggestionsFor("", pools).map((s) => `${s.kind}:${s.title}`)).toEqual([
      "favorite:Pad kra pao",
      "recent:Som tam",
      "recent:Pad thai",
      "new:Papaya salad",
    ]);
  });
  it("filters by what is typed, starts-with first", () => {
    expect(suggestionsFor("pa", pools).map((s) => s.title)).toEqual(["Pad kra pao", "Pad thai", "Papaya salad"]);
    expect(suggestionsFor("tam", pools).map((s) => s.title)).toEqual(["Som tam"]);
  });
  it("is empty when nothing matches", () => {
    expect(suggestionsFor("zzz", pools)).toEqual([]);
  });
});
