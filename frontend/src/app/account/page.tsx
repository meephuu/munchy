import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountsOff } from "@/components/AccountsOff";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/Icons";
import { LogoutButton } from "@/components/LogoutButton";
import { Screen } from "@/components/Screen";
import { Eyebrow, Title } from "@/components/Type";
import { fromRow, targetOf } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITIES, GOALS, SEXES } from "@/lib/target";

// Account (members only): who you are, the daily target and the numbers behind it, shortcuts, log out.
// Reading the login is request-time work, so it sits behind <Suspense>.
export default function AccountPage() {
  return (
    <Suspense fallback={<Screen>{null}</Screen>}>
      <Account />
    </Suspense>
  );
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

async function Account() {
  const supabase = await createClient();
  if (!supabase) return <AccountsOff />;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const profile = fromRow(row);
  const target = profile ? targetOf(profile) : null;
  const email = user.email ?? "";
  const since = new Date(user.created_at);
  const label = (list: { id: string; label: string }[], id: string) =>
    list.find((x) => x.id === id)?.label ?? id;

  return (
    <Screen>
      <div className="flex flex-col gap-4">
        <header className="flex items-center gap-3 pt-2">
          <Link
            href="/home"
            aria-label="Back to Home"
            className="flex size-11 shrink-0 items-center justify-center rounded-row bg-surface text-ink shadow-row"
          >
            <ArrowLeftIcon size={20} />
          </Link>
          <div className="flex flex-col gap-0.5">
            <Eyebrow>Account</Eyebrow>
            <Title lead="You &" accent="your target" className="text-xl" />
          </div>
        </header>

        <section className="flex items-center gap-3.5 rounded-hero bg-surface p-[18px] shadow-card">
          <span
            aria-hidden="true"
            className="flex size-14 shrink-0 items-center justify-center rounded-full bg-green font-heading text-2xl font-semibold text-bg"
          >
            {(email || "?").charAt(0).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[15px] font-semibold">{email}</span>
            <span className="font-mono text-[10px] tracking-[1px] text-ink-muted uppercase">
              Member since {MONTHS[since.getUTCMonth()]}{" "}
              {since.getUTCFullYear()}
            </span>
          </div>
        </section>

        {target && profile ? (
          <section className="flex flex-col gap-3 rounded-hero bg-green p-[18px] text-bg">
            <span className="font-mono text-[10px] font-bold tracking-[1.5px] text-gold uppercase">
              Daily target · {label(GOALS, profile.goal)}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-brand text-[44px] leading-none">
                {target.kcal.toLocaleString("en-US")}
              </span>
              <span className="text-[15px] font-semibold">kcal</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Macro label="Protein" grams={target.proteinG} />
              <Macro label="Carbs" grams={target.carbsG} />
              <Macro label="Fat" grams={target.fatG} />
            </div>
            {target.floored && (
              <span className="text-xs text-green-soft">
                Kept at a safe minimum: eating less than this isn&apos;t a good
                idea.
              </span>
            )}
          </section>
        ) : (
          <section className="flex flex-col gap-2 rounded-hero bg-terracotta-tint p-[18px]">
            <Eyebrow tone="terracotta">One more step</Eyebrow>
            <p className="text-sm">
              Tell me a bit about you and I&apos;ll set your daily target.
            </p>
            <Link href="/onboarding" className="text-sm font-semibold">
              Set up my profile
            </Link>
          </section>
        )}

        {profile && (
          <section className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <Eyebrow tone="muted">About you</Eyebrow>
              <Link href="/onboarding" className="text-[13px] font-semibold">
                Edit
              </Link>
            </div>
            <dl className="flex flex-col rounded-card bg-surface px-3.5 py-1 shadow-row">
              <Row term="Goal" value={label(GOALS, profile.goal)} />
              <Row
                term="Typical day"
                value={label(ACTIVITIES, profile.activity)}
              />
              <Row term="Sex" value={label(SEXES, profile.sex)} />
              <Row term="Age" value={`${profile.age}`} />
              <Row term="Height" value={`${profile.heightCm} cm`} />
              <Row term="Weight" value={`${profile.weightKg} kg`} last />
            </dl>
          </section>
        )}

        <nav
          aria-label="Shortcuts"
          className="flex flex-col rounded-card bg-surface px-3.5 py-1 shadow-row"
        >
          <Shortcut
            href="/progress"
            title="Progress"
            hint="Your week, streak and weight"
          />
          <Shortcut
            href="/add"
            title="My dishes & favorites"
            hint="Create your own dishes, log in one tap"
            last
          />
        </nav>

        <div className="flex flex-col items-center gap-2 pt-1">
          <LogoutButton />
          <p className="text-center font-mono text-[9px] tracking-[0.5px] text-ink-muted uppercase">
            Estimates are approximate · Not medical advice
          </p>
        </div>
      </div>
      <BottomNav />
    </Screen>
  );
}

function Macro({ label, grams }: { label: string; grams: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-field bg-white/10 p-2">
      <span className="font-mono text-[9px] text-green-soft uppercase">
        {label}
      </span>
      <span className="text-base font-semibold">{grams} g</span>
    </div>
  );
}

function Row({
  term,
  value,
  last = false,
}: {
  term: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex min-h-11 items-center justify-between gap-3 ${last ? "" : "border-b border-divider"}`}
    >
      <dt className="font-mono text-[10px] tracking-[1px] text-ink-muted uppercase">
        {term}
      </dt>
      <dd className="text-[14px] font-semibold">{value}</dd>
    </div>
  );
}

function Shortcut({
  href,
  title,
  hint,
  last = false,
}: {
  href: string;
  title: string;
  hint: string;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-14 items-center gap-3 py-2 text-ink ${last ? "" : "border-b border-divider"}`}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-ink-muted">{hint}</span>
      </span>
      <ArrowRightIcon size={18} className="shrink-0 text-green" />
    </Link>
  );
}
