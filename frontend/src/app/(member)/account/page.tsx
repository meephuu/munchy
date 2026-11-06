import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountsOff } from "@/components/AccountsOff";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/Icons";
import { LogoutButton } from "@/components/LogoutButton";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Screen } from "@/components/Screen";
import { TargetEditor } from "@/components/TargetEditor";
import { Eyebrow, Title } from "@/components/Type";
import { birthLabel } from "@/lib/birth";
import { calculatedTargetOf, fromRow, targetOf } from "@/lib/profile";
import { currentUser } from "@/lib/supabase/claims";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITIES, GOALS, SEXES } from "@/lib/target";

// Account (members only): who you are, the daily target and the numbers behind it, shortcuts, log out.
// Reading the login is request-time work, so it sits behind <Suspense>.
export default function AccountPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
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
  const user = await currentUser(supabase);
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const profile = fromRow(row);
  const target = profile ? targetOf(profile) : null;
  const email = user.email ?? "";
  // the profile is made at sign-up, so its date is the day the account started
  const since = row?.created_at ? new Date(row.created_at) : null;
  const label = (list: { id: string; label: string }[], id: string) =>
    list.find((x) => x.id === id)?.label ?? id;

  return (
    <Screen
      shell={{ kind: "inShell" }}
    >
      <div className="flex flex-col gap-4 desk:gap-6">
        <header className="flex items-center gap-3 pt-2 desk:pt-0">
          <Link
            href="/home"
            aria-label="Back to Home"
            className="flex size-11 shrink-0 items-center justify-center rounded-row bg-surface text-ink shadow-row desk:hidden"
          >
            <ArrowLeftIcon size={20} />
          </Link>
          <div className="flex flex-col gap-0.5 desk:gap-2">
            <Eyebrow>Account</Eyebrow>
            <Title
              lead="You &"
              accent="your target"
              className="text-xl desk:text-4xl"
            />
          </div>
        </header>

        <div className="flex flex-col gap-4 desk:flex-row desk:flex-wrap desk:items-stretch desk:gap-6">
          <section className="flex items-center gap-3.5 rounded-hero bg-surface p-[18px] shadow-card desk:min-w-0 desk:flex-[1_1_300px] desk:flex-col desk:items-start desk:gap-[18px] desk:p-7">
            <span
              aria-hidden="true"
              className="flex size-14 shrink-0 items-center justify-center rounded-full bg-green font-heading text-2xl font-semibold text-bg desk:size-[72px] desk:text-[32px]"
            >
              {(email || "?").charAt(0).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5 desk:gap-1">
              <span className="truncate text-[15px] font-semibold desk:text-lg">
                {email}
              </span>
              {since && (
                <span className="font-mono text-[10px] tracking-[1px] text-ink-muted uppercase desk:text-[11px]">
                  Member since {MONTHS[since.getUTCMonth()]}{" "}
                  {since.getUTCFullYear()}
                </span>
              )}
            </div>
            <div className="mt-auto hidden desk:block">
              <LogoutButton />
            </div>
          </section>

          {target && profile ? (
            <section className="flex flex-col gap-3 rounded-hero bg-green p-[18px] text-bg desk:min-w-0 desk:flex-[2_1_480px] desk:flex-row desk:flex-wrap desk:items-center desk:gap-6 desk:p-7">
              <div className="flex flex-col gap-3 desk:min-w-[300px] desk:flex-1 desk:gap-4">
                <span className="font-mono text-[10px] font-bold tracking-[1.5px] text-gold uppercase desk:text-[11px]">
                  Daily target ·{" "}
                  {target.custom ? "Your own" : label(GOALS, profile.goal)}
                </span>
                <div className="flex items-baseline gap-2 desk:gap-2.5">
                  <span className="font-brand text-[44px] leading-none desk:text-[64px]">
                    {target.kcal.toLocaleString("en-US")}
                  </span>
                  <span className="text-[15px] font-semibold desk:text-[17px]">
                    kcal
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 desk:gap-2.5">
                  <Macro label="Protein" grams={target.proteinG} />
                  <Macro label="Carbs" grams={target.carbsG} />
                  <Macro label="Fat" grams={target.fatG} />
                </div>
                {target.floored && (
                  <span className="text-xs text-green-soft">
                    Kept at a safe minimum: eating less than this isn&apos;t a
                    good idea.
                  </span>
                )}
              </div>
              <Image
                src="/bowl.png"
                alt=""
                width={150}
                height={150}
                className="hidden shrink-0 desk:block"
              />
            </section>
          ) : (
            <section className="flex flex-col gap-2 rounded-hero bg-terracotta-tint p-[18px] desk:flex-[2_1_480px] desk:p-7">
              <Eyebrow tone="terracotta">One more step</Eyebrow>
              <p className="text-sm">
                Tell me a bit about you and I&apos;ll set your daily target.
              </p>
              <Link href="/onboarding" className="text-sm font-semibold">
                Set up my profile
              </Link>
            </section>
          )}
        </div>

        {target && profile && (
          <TargetEditor
            current={target}
            calculated={calculatedTargetOf(profile)}
            custom={!!target.custom}
          />
        )}

        <div className="flex flex-col gap-4 desk:flex-row desk:flex-wrap desk:items-start desk:gap-6">
          {profile && (
            <section className="flex flex-col gap-1 desk:min-w-0 desk:flex-[2_1_480px] desk:rounded-hero desk:bg-surface desk:px-7 desk:pt-[22px] desk:pb-2.5 desk:shadow-card">
              <div className="flex items-baseline justify-between desk:pb-1">
                <Eyebrow tone="muted" className="desk:hidden">
                  About you
                </Eyebrow>
                <Title
                  as="h2"
                  lead="About"
                  accent="you"
                  className="hidden text-[22px] desk:block"
                />
                <Link
                  href="/onboarding"
                  className="text-[13px] font-semibold desk:text-sm"
                >
                  <span className="desk:hidden">Edit</span>
                  <span className="hidden desk:inline">Edit profile</span>
                </Link>
              </div>
              <dl className="flex flex-col rounded-card bg-surface px-3.5 py-1 shadow-row desk:grid desk:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] desk:gap-x-8 desk:rounded-none desk:bg-transparent desk:p-0 desk:shadow-none">
                <Row term="Goal" value={label(GOALS, profile.goal)} />
                <Row
                  term="Typical day"
                  value={label(ACTIVITIES, profile.activity)}
                />
                <Row term="Sex" value={label(SEXES, profile.sex)} />
                <Row
                  term="Age"
                  value={
                    profile.birthDate
                      ? `${profile.age} · born ${birthLabel(profile.birthDate)}`
                      : `${profile.age}`
                  }
                />
                <Row term="Height" value={`${profile.heightCm} cm`} />
                <Row term="Weight" value={`${profile.weightKg} kg`} />
              </dl>
            </section>
          )}

          <div className="flex min-w-0 flex-col gap-4 desk:flex-[1_1_300px]">
            <nav
              aria-label="Shortcuts"
              className="flex flex-col rounded-card bg-surface px-3.5 py-1 shadow-row desk:rounded-hero desk:px-6 desk:py-1.5 desk:shadow-card"
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
            <p className="hidden text-center font-mono text-[9px] tracking-[0.5px] text-ink-muted uppercase desk:block">
              Estimates are approximate · Not medical advice
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 pt-1 desk:hidden">
          <LogoutButton />
          <p className="text-center font-mono text-[9px] tracking-[0.5px] text-ink-muted uppercase">
            Estimates are approximate · Not medical advice
          </p>
        </div>
      </div>
    </Screen>
  );
}

function Macro({ label, grams }: { label: string; grams: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-field bg-white/10 p-2 desk:gap-1 desk:rounded-row desk:p-3.5">
      <span className="font-mono text-[9px] text-green-soft uppercase">
        {label}
      </span>
      <span className="text-base font-semibold desk:text-[22px]">
        {grams} g
      </span>
    </div>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-divider last:border-b-0 desk:min-h-16 desk:flex-col desk:items-start desk:justify-center desk:gap-1 desk:py-3 desk:last:border-b">
      <dt className="font-mono text-[10px] tracking-[1px] text-ink-muted uppercase">
        {term}
      </dt>
      <dd className="text-[14px] font-semibold desk:text-base">{value}</dd>
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
      className={`flex min-h-14 items-center gap-3 py-2 row-hover text-ink desk:min-h-[72px] ${last ? "" : "border-b border-divider"}`}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-ink-muted">{hint}</span>
      </span>
      <ArrowRightIcon size={18} className="shrink-0 text-green" />
    </Link>
  );
}
