import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountsOff } from "@/components/AccountsOff";
import { ArrowRightIcon, SearchIcon } from "@/components/Icons";
import { LogoutButton } from "@/components/LogoutButton";
import { Screen } from "@/components/Screen";
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
      <div className="flex flex-col gap-[18px]">
        <header className="flex items-center justify-between pt-2">
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[30px] leading-none text-olive-logo">Munchy</span>
            <span className="max-w-[180px] truncate text-xs text-ink-muted">{data.user.email}</span>
          </div>
          <LogoutButton />
        </header>

        <Form
          action="/dish"
          className="flex h-14 items-center gap-2 rounded-card border border-line-soft bg-white py-1.5 pr-1.5 pl-3.5"
        >
          <label htmlFor="dish" className="sr-only">
            Dish name
          </label>
          <SearchIcon size={18} className="shrink-0 text-ink-faint" />
          <input
            id="dish"
            name="q"
            type="text"
            required
            autoComplete="off"
            placeholder="What are you eating?"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
          />
          <button
            type="submit"
            aria-label="Analyze dish"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-field bg-teal text-cream"
          >
            <ArrowRightIcon size={20} />
          </button>
        </Form>

        {target ? (
          <section className="flex flex-col gap-2.5 rounded-hero bg-olive px-[18px] py-4">
            <span className="text-xs">Your daily target</span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[34px] leading-none text-ink-strong">
                {target.kcal.toLocaleString("en-US")}
              </span>
              <span className="text-sm">kcal</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-cream px-2.5 py-1 text-xs">Protein {target.proteinG} g</span>
              <span className="rounded-full bg-cream px-2.5 py-1 text-xs">Carbs {target.carbsG} g</span>
              <span className="rounded-full bg-cream px-2.5 py-1 text-xs">Fat {target.fatG} g</span>
            </div>
            <Link href="/onboarding" className="text-xs font-semibold">
              Edit my profile
            </Link>
          </section>
        ) : (
          <section className="flex flex-col gap-2 rounded-hero bg-swap-bg p-[18px]">
            <h2 className="font-display text-[15px] font-normal text-ink-strong">One more step</h2>
            <p className="text-sm">Tell me a bit about you and I&apos;ll set your daily target.</p>
            <Link href="/onboarding" className="text-sm font-semibold">
              Set up my profile
            </Link>
          </section>
        )}

        <p className="text-center text-xs text-ink-muted">
          Logging meals, today&apos;s calories left and coaching are coming next.
        </p>
      </div>
    </Screen>
  );
}
