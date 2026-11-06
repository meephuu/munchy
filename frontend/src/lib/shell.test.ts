import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "./profile";
import { memberShell } from "./shell";

describe("memberShell", () => {
  it("has the email, the daily target and 'goal · typical day' for the sidebar tile", () => {
    expect(memberShell("me@example.com", DEFAULT_PROFILE)).toEqual({
      email: "me@example.com",
      targetKcal: 1900,
      targetLine: "Stay balanced · Desk job",
    });
  });

  it("has no target tile until the profile is set up", () => {
    expect(memberShell("me@example.com", null)).toEqual({ email: "me@example.com", targetKcal: null, targetLine: null });
  });

  it("copes with a missing email", () => {
    expect(memberShell(null, null).email).toBeNull();
  });
});
