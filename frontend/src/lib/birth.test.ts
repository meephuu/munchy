import { describe, expect, it } from "vitest";
import { ageOn, birthLabel, parseBirth, splitBirth } from "./birth";

const now = new Date(2026, 10, 5, 12); // 5 Nov 2026

describe("parseBirth", () => {
  it("builds a padded ISO date from the three fields", () => {
    expect(parseBirth({ day: "7", month: "3", year: "2000" })).toBe("2000-03-07");
    expect(parseBirth({ day: " 29 ", month: "02", year: "2004" })).toBe("2004-02-29");
  });
  it.each([
    ["31 Feb", { day: "31", month: "2", year: "2000" }],
    ["29 Feb in a non-leap year", { day: "29", month: "2", year: "2001" }],
    ["month 13", { day: "1", month: "13", year: "2000" }],
    ["day 0", { day: "0", month: "1", year: "2000" }],
    ["a 2-digit year", { day: "1", month: "1", year: "99" }],
    ["letters", { day: "a", month: "1", year: "2000" }],
    ["empty fields", { day: "", month: "", year: "" }],
  ])("rejects %s", (_, parts) => {
    expect(parseBirth(parts)).toBeNull();
  });
});

describe("ageOn", () => {
  it("counts whole years, with the birthday counting on the day", () => {
    expect(ageOn("2000-11-05", now)).toBe(26);
    expect(ageOn("2000-11-06", now)).toBe(25);
    expect(ageOn("2000-12-31", now)).toBe(25);
    expect(ageOn("2000-01-01", now)).toBe(26);
  });
  it("is null for a future or invalid date", () => {
    expect(ageOn("2027-01-01", now)).toBeNull();
    expect(ageOn("2000-02-30", now)).toBeNull();
    expect(ageOn("not a date", now)).toBeNull();
  });
  it("handles a 29 Feb birthday", () => {
    expect(ageOn("2004-02-29", new Date(2026, 1, 28))).toBe(21);
    expect(ageOn("2004-02-29", new Date(2026, 2, 1))).toBe(22);
  });
});

describe("splitBirth / birthLabel", () => {
  it("splits a stored date back into the fields, without leading zeros", () => {
    expect(splitBirth("2000-03-07")).toEqual({ day: "7", month: "3", year: "2000" });
    expect(splitBirth(null)).toEqual({ day: "", month: "", year: "" });
  });
  it("reads nicely", () => {
    expect(birthLabel("2000-03-07")).toBe("7 Mar 2000");
  });
});
