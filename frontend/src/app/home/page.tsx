import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountsOff } from "@/components/AccountsOff";
import { BottomNav } from "@/components/BottomNav";
import { DishSearchBar } from "@/components/DishSearchBar";
import { FavoritesList } from "@/components/FavoritesList";
import { Greeting } from "@/components/Greeting";
import { HomeToday } from "@/components/HomeToday";
import { LogoutButton } from "@/components/LogoutButton";
import { Screen } from "@/components/Screen";
import { Eyebrow, Title, Wordmark } from "@/components/Type";
import { fromRow, targetOf } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

// Home for people who are logged in (design/screens/Main.dc.html): how much of today's target is left,
// the macros, and what was eaten today. Reading the login is request-time work, so it sits behind <Suspense>.
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
  const initial = (data.user.email ?? "?").charAt(0).toUpperCase();

  return (
    <Screen>
      <div className="flex flex-col gap-4">
        <header className="flex items-center justify-between pt-2">
          <div className="flex flex-col gap-1">
            <Wordmark />
            <Eyebrow>Your Bite Buddy</Eyebrow>
          </div>
          <Link
            href="/onboarding"
            aria-label="Your profile"
            className="flex size-10 items-center justify-center rounded-full bg-sand font-heading text-[17px] font-semibold text-green"
          >
            {initial}
          </Link>
        </header>

        <Greeting />
        <DishSearchBar />
        <FavoritesList />

        {!target && (
          <section className="flex flex-col gap-2 rounded-hero bg-terracotta-tint p-[18px]">
            <Eyebrow tone="terracotta">One more step</Eyebrow>
            <Title as="h2" lead="Set up your" accent="profile" className="text-lg" />
            <p className="text-sm">Tell me a bit about you and I&apos;ll set your daily target.</p>
            <Link href="/onboarding" className="text-sm font-semibold">
              Set up my profile
            </Link>
          </section>
        )}

        <HomeToday target={target} />

        <div className="flex flex-col items-center gap-2 pt-1">
          <LogoutButton />
          <p className="max-w-full truncate font-mono text-[10px] tracking-[0.5px] text-ink-muted uppercase">
            Signed in as {data.user.email}
          </p>
        </div>
      </div>
      <BottomNav />
    </Screen>
  );
}
