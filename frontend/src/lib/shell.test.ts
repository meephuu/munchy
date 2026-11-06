import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "./profile";
import { memberShell } from "./shell";

describe("memberShell", () => {
  it("has the email, the daily target and 'goal · typical day' for the sidebar tile", () => {
    const shell = memberShell("me@example.com", DEFAULT_PROFILE);
    expect(shell).toMatchObject({
      email: "me@example.com",
      targetKcal: 1900,
      targetLine: "Stay balanced · Desk job",
    });
    expect(shell.target?.kcal).toBe(1900);
  });

  it("has no target tile until the profile is set up", () => {
    expect(memberShell("me@example.com", null)).toEqual({ email: "me@example.com", targetKcal: null, targetLine: null, target: null });
  });

  it("copes with a missing email", () => {
    expect(memberShell(null, null).email).toBeNull();
  });
});
