// Small helpers for the sign-up and log-in forms.

export const MIN_PASSWORD = 8;

/** A problem with what was typed, in plain words, or null if it can be sent. */
export function validateCredentials(email: string, password: string): string | null {
  const e = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return "Enter a valid email address.";
  if (password.length < MIN_PASSWORD) return `Use a password of at least ${MIN_PASSWORD} characters.`;
  return null;
}

type AuthFailure = { message?: string; code?: string; status?: number };

/** What to tell the person when Supabase refuses: never the raw error text. */
export function friendlyAuthError(err: AuthFailure): string {
  const code = err.code ?? "";
  const text = (err.message ?? "").toLowerCase();
  if (code === "user_already_exists" || text.includes("already registered") || text.includes("already been registered")) {
    return "That email already has an account. Try logging in instead.";
  }
  if (code === "invalid_credentials" || text.includes("invalid login credentials")) {
    return "Wrong email or password.";
  }
  if (code === "email_not_confirmed" || text.includes("email not confirmed")) {
    return "Please confirm your email first: check your inbox for the link.";
  }
  if (code === "weak_password" || text.includes("password should be")) {
    return `Pick a stronger password (at least ${MIN_PASSWORD} characters).`;
  }
  if (code.includes("rate_limit") || err.status === 429 || text.includes("rate limit")) {
    return "Too many tries. Wait a minute and try again.";
  }
  if (text.includes("failed to fetch") || text.includes("network")) {
    return "Can't reach the account service. Check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}
