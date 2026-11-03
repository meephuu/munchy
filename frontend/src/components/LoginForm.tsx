"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Brand } from "@/components/Brand";
import { PrimaryButton } from "@/components/Button";
import { Field } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { Title } from "@/components/Type";
import { friendlyAuthError, validateCredentials } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

// The confirmation-email link sends people here with ?notice=confirm when it did not work. Read in the
// browser, so the form is rendered once and never swapped (a swap would wipe what the person typed).
const subscribe = () => () => {};
const readSearch = () => window.location.search;
const alwaysTrue = () => true;

/** Log in with email and password. Not in the design files; built from the same parts as the others. */
export function LoginForm() {
  const router = useRouter();
  const search = useSyncExternalStore(subscribe, readSearch, () => "");
  // False until the page's JavaScript is running. Before that the submit button stays disabled, so a quick
  // Enter press cannot make the browser submit the form by itself (that would put the password in the URL).
  const ready = useSyncExternalStore(subscribe, alwaysTrue, () => false);
  const notice =
    new URLSearchParams(search).get("notice") === "confirm"
      ? "That confirmation link didn't work, or was already used. Log in, or sign up again."
      : undefined;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = validateCredentials(email, password);
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    const supabase = createClient();
    if (!supabase) return setBusy(false);
    const { error: failure } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (failure) {
      setBusy(false);
      return setError(friendlyAuthError(failure));
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <Screen>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 pt-1">
        <Brand />
        <Title lead="Welcome" accent="back" className="text-[26px]" />
        {notice && (
          <p role="status" className="rounded-card bg-terracotta-tint px-3.5 py-3 text-[13px]">
            {notice}
          </p>
        )}
        <Field id="email" label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-terracotta-text">
            {error}
          </p>
        )}
        <PrimaryButton type="submit" disabled={busy || !ready}>
          {busy ? "Logging in…" : "Log in"}
        </PrimaryButton>
        <p className="text-center text-sm text-ink-muted">
          New here?{" "}
          <Link href="/onboarding" className="font-semibold">
            Create a free account
          </Link>
        </p>
        <Link href="/" className="text-center text-sm font-semibold">
          Back to search
        </Link>
      </form>
    </Screen>
  );
}
