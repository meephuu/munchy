"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Brand } from "@/components/Brand";
import { PrimaryButton, PrimaryLink } from "@/components/Button";
import { Field } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { Title } from "@/components/Type";
import { friendlyAuthError, MIN_PASSWORD, validateCredentials } from "@/lib/auth";
import { clearDraft, DRAFT_KEY, parseDraft, targetOf, toRow } from "@/lib/profile";
import { createClient } from "@/lib/supabase/client";

// The browser-only draft from the Get started screen: undefined while the page is still loading,
// null once we know there is none.
const subscribe = () => () => {};
const readDraft = (): string | null | undefined => {
  try {
    return sessionStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
};

/** Create the account. The profile from "Get started" travels with the sign-up (as the new user's
 *  metadata) and a database trigger turns it into the profile row, so it also works when the project
 *  asks people to confirm their email first and there is no session yet. */
export function SignupForm() {
  const router = useRouter();
  const draftText = useSyncExternalStore(subscribe, readDraft, () => undefined);
  const draft = draftText === undefined ? undefined : parseDraft(draftText);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInbox, setCheckInbox] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const problem = validateCredentials(email, password);
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    const supabase = createClient();
    if (!supabase) return setBusy(false);

    const { data, error: failure } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { profile: toRow(draft) },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (failure) return setError(friendlyAuthError(failure));
    // With email confirmation on, an address that is already registered comes back as a user with no identities.
    if (data.user && data.user.identities?.length === 0) {
      return setError(friendlyAuthError({ code: "user_already_exists" }));
    }
    clearDraft();
    if (data.session) {
      router.push("/home");
      router.refresh();
    } else {
      setCheckInbox(true);
    }
  }

  if (checkInbox) {
    return (
      <Screen>
        <div className="flex flex-col gap-4 pt-1">
          <Brand />
          <Title lead="Check your" accent="email" className="text-[26px]" />
          <p className="text-sm">
            We sent a link to <strong>{email.trim()}</strong>. Open it to confirm your account, then log in.
          </p>
          <PrimaryLink href="/login">Go to log in</PrimaryLink>
        </div>
      </Screen>
    );
  }

  if (draft === undefined) return <Screen>{null}</Screen>;

  if (draft === null) {
    return (
      <Screen>
        <div className="flex flex-col gap-4 pt-1">
          <Brand />
          <Title lead="First, a few quick" accent="questions" className="text-[26px]" />
          <p className="text-sm">So your daily target fits you, tell me a bit about yourself before you sign up.</p>
          <PrimaryLink href="/onboarding">Get started</PrimaryLink>
        </div>
      </Screen>
    );
  }

  const target = targetOf(draft);
  return (
    <Screen>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4 pt-1">
        <Brand />
        <Title lead="Create your" accent="account" className="text-[26px]" />
        <p className="rounded-card bg-green-tint px-3.5 py-3 text-sm">
          Your daily target: <strong>{target.kcal.toLocaleString("en-US")} kcal</strong> · Protein{" "}
          {target.proteinG} g · Carbs {target.carbsG} g · Fat {target.fatG} g
        </p>
        <Field id="email" label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          id="password"
          label={`Password (at least ${MIN_PASSWORD} characters)`}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-terracotta-text">
            {error}
          </p>
        )}
        <PrimaryButton type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </PrimaryButton>
        <p className="text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold">
            Log in
          </Link>
        </p>
        <Link href="/onboarding" className="text-center text-sm font-semibold">
          Change my answers
        </Link>
      </form>
    </Screen>
  );
}
