import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountsOff } from "@/components/AccountsOff";
import { ArrowRightIcon, SearchIcon } from "@/components/Icons";
import { LogoutButton } from "@/components/LogoutButton";
import { Screen } from "@/components/Screen";
import { Eyebrow, Title, Wordmark } from "@/components/Type";
import { fromRow, targetOf } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

// Home for people who are logged in. For now: their daily target and a dish search. The full Home
// (calories left today, today's bites, logging) is a later screen (design/screens/Main.dc.html).
export default function HomePage() {
  return (
    <Suspense fallback={<Screen>{null}</Screen>}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const supabase = await createClient();
  if (!supabase) return <AccountsOff />;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: row } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  const profile = fromRow(row);
  const target = profile ? targetOf(profile) : null;

  return (
    <Screen>
      <div className="flex flex-col gap-4">
        <header className="flex items-center justify-between pt-2">
          <div className="flex flex-col gap-1">
            <Wordmark />
            <Eyebrow>Your Bite Buddy</Eyebrow>
          </div>
          <LogoutButton />
        </header>

        <Title lead="What did you" accent="munch?" className="text-[26px]" />

        <Form
          action="/dish"
          className="flex h-14 items-center gap-2 rounded-card bg-surface py-1.5 pr-1.5 pl-3.5 shadow-search"
        >
          <label htmlFor="dish" className="sr-only">
            Dish name
          </label>
          <SearchIcon size={18} className="shrink-0 text-placeholder" />
          <input
            id="dish"
            name="q"
            type="text"
            required
            autoComplete="off"
            placeholder="e.g. pad kra pao with fried egg"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
          />
          <button
            type="submit"
            aria-label="Analyze dish"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-field bg-green text-bg hover:bg-green-dark"
          >
            <ArrowRightIcon size={20} />
          </button>
        </Form>

        {target ? (
          <section className="flex flex-col gap-2.5 rounded-hero bg-surface p-[18px] shadow-card">
            <Eyebrow>Your daily target</Eyebrow>
            <div className="flex items-baseline gap-1.5">
              <span className="font-brand text-4xl leading-none text-green">{target.kcal.toLocaleString("en-US")}</span>
              <span className="text-sm font-semibold">kcal</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-badge bg-green-tint px-2.5 py-1 text-xs font-semibold text-green">
                Protein {target.proteinG} g
              </span>
              <span className="rounded-badge bg-bronze-tint px-2.5 py-1 text-xs font-semibold text-bronze">
                Carbs {target.carbsG} g
              </span>
              <span className="rounded-badge bg-terracotta-tint px-2.5 py-1 text-xs font-semibold text-terracotta-text">
                Fat {target.fatG} g
              </span>
            </div>
            <Link href="/onboarding" className="text-xs font-semibold">
              Edit my profile
            </Link>
          </section>
        ) : (
          <section className="flex flex-col gap-2 rounded-hero bg-terracotta-tint p-[18px]">
            <Eyebrow tone="terracotta">One more step</Eyebrow>
            <Title as="h2" lead="Set up your" accent="profile" className="text-lg" />
            <p className="text-sm">Tell me a bit about you and I&apos;ll set your daily target.</p>
            <Link href="/onboarding" className="text-sm font-semibold">
              Set up my profile
            </Link>
          </section>
        )}

        <p className="text-center text-xs text-ink-muted">
          Logging meals, today&apos;s calories left and coaching are coming next.
        </p>
        <p className="truncate text-center font-mono text-[10px] tracking-[0.5px] text-ink-muted uppercase">
          Signed in as {data.user.email}
        </p>
      </div>
    </Screen>
  );
}
