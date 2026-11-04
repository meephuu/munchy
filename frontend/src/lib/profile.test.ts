import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, fromRow, parseDraft, targetOf, toProfile, toRow } from "./profile";

describe("toProfile", () => {
  it("accepts a valid profile, also with numbers given as text (as a saved draft or form would)", () => {
    expect(toProfile(DEFAULT_PROFILE)).toEqual(DEFAULT_PROFILE);
    expect(toProfile({ ...DEFAULT_PROFILE, age: "30", heightCm: "180", weightKg: "75.5" })).toMatchObject({
      age: 30,
      heightCm: 180,
      weightKg: 75.5,
    });
  });

  it.each([
    ["nothing", null],
    ["a string", "profile"],
    ["an unknown goal", { ...DEFAULT_PROFILE, goal: "bulk" }],
    ["an unknown activity", { ...DEFAULT_PROFILE, activity: "couch" }],
    ["an unknown sex", { ...DEFAULT_PROFILE, sex: "x" }],
    ["an age out of range", { ...DEFAULT_PROFILE, age: 7 }],
    ["a weight that is not a number", { ...DEFAULT_PROFILE, weightKg: "heavy" }],
    ["a missing height", { ...DEFAULT_PROFILE, heightCm: undefined }],
  ])("rejects %s", (_, raw) => {
    expect(toProfile(raw)).toBeNull();
  });
});

describe("rows", () => {
  it("toRow stores the inputs with the target worked out from them", () => {
    const row = toRow(DEFAULT_PROFILE);
    const t = targetOf(DEFAULT_PROFILE);
    expect(row).toEqual({
      goal: "maintain",
      activity: "desk",
      sex: "unspecified",
      age: 21,
      birth_date: null,
      height_cm: 174,
      weight_kg: 68,
      target_kcal: t.kcal,
      protein_g: t.proteinG,
      carbs_g: t.carbsG,
      fat_g: t.fatG,
    });
    expect(row.target_kcal).toBe(1900);
  });

  it("fromRow reads the inputs back (the stored target is not trusted: it is recomputed from them)", () => {
    expect(fromRow({ ...toRow(DEFAULT_PROFILE), target_kcal: 99999 })).toEqual(DEFAULT_PROFILE);
    expect(fromRow({ goal: "lose" })).toBeNull();
    expect(fromRow(null)).toBeNull();
  });
});

describe("parseDraft", () => {
  it("reads a saved draft back", () => {
    expect(parseDraft(JSON.stringify(DEFAULT_PROFILE))).toEqual(DEFAULT_PROFILE);
  });
  it("gives null for nothing, broken text or a draft that is no longer valid", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("")).toBeNull();
    expect(parseDraft("{not json")).toBeNull();
    expect(parseDraft(JSON.stringify({ ...DEFAULT_PROFILE, age: 3 }))).toBeNull();
  });
});

describe("date of birth", () => {
  const now = new Date(2026, 10, 5);
  const withBirth = { ...DEFAULT_PROFILE, birthDate: "2000-03-07", age: undefined };

  it("works the age out from the date (and ignores any age that came with it)", () => {
    expect(toProfile(withBirth, now)).toMatchObject({ age: 26, birthDate: "2000-03-07" });
    expect(toProfile({ ...withBirth, age: 99 }, now)?.age).toBe(26);
  });
  it("the age moves on after the birthday", () => {
    expect(toProfile(withBirth, new Date(2026, 2, 6))?.age).toBe(25);
    expect(toProfile(withBirth, new Date(2026, 2, 7))?.age).toBe(26);
  });
  it("refuses a date in the future, an impossible date, or someone under 14", () => {
    expect(toProfile({ ...withBirth, birthDate: "2027-01-01" }, now)).toBeNull();
    expect(toProfile({ ...withBirth, birthDate: "2000-02-30" }, now)).toBeNull();
    expect(toProfile({ ...withBirth, birthDate: "2020-01-01" }, now)).toBeNull();
  });
  it("is stored with the date and the age at saving time, and read back", () => {
    const p = toProfile(withBirth, now)!;
    const row = toRow(p);
    expect(row).toMatchObject({ birth_date: "2000-03-07", age: 26 });
    expect(fromRow(row)).toMatchObject({ birthDate: "2000-03-07" });
  });
  it("an older profile with only an age still works", () => {
    expect(fromRow({ ...toRow(DEFAULT_PROFILE), birth_date: null })).toEqual(DEFAULT_PROFILE);
  });
});
