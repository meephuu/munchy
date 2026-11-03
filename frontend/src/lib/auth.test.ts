import { describe, expect, it } from "vitest";
import { friendlyAuthError, validateCredentials } from "./auth";

describe("validateCredentials", () => {
  it("accepts a normal email and password (surrounding spaces in the email are ignored)", () => {
    expect(validateCredentials("anna@example.com", "longenough")).toBeNull();
    expect(validateCredentials("  anna@example.com ", "longenough")).toBeNull();
  });
  it.each(["", "anna", "anna@", "anna@example", "an na@example.com"])("rejects the email %j", (email) => {
    expect(validateCredentials(email, "longenough")).toMatch(/email/i);
  });
  it("rejects a short password", () => {
    expect(validateCredentials("anna@example.com", "short")).toMatch(/8 characters/);
  });
});

describe("friendlyAuthError", () => {
  it("explains the common failures in plain words", () => {
    expect(friendlyAuthError({ code: "user_already_exists" })).toMatch(/already has an account/);
    expect(friendlyAuthError({ message: "User already registered" })).toMatch(/already has an account/);
    expect(friendlyAuthError({ code: "invalid_credentials" })).toBe("Wrong email or password.");
    expect(friendlyAuthError({ message: "Invalid login credentials" })).toBe("Wrong email or password.");
    expect(friendlyAuthError({ code: "email_not_confirmed" })).toMatch(/confirm your email/);
    expect(friendlyAuthError({ code: "weak_password" })).toMatch(/stronger password/);
    expect(friendlyAuthError({ code: "over_email_send_rate_limit" })).toMatch(/Too many/);
    expect(friendlyAuthError({ status: 429 })).toMatch(/Too many/);
    expect(friendlyAuthError({ message: "Failed to fetch" })).toMatch(/Can't reach/);
  });
  it("never shows raw error text it does not recognise", () => {
    const msg = friendlyAuthError({ message: "duplicate key value violates unique constraint pg_xyz" });
    expect(msg).toBe("Something went wrong. Please try again.");
  });
});
