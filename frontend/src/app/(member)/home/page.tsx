import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountsOff } from "@/components/AccountsOff";
import { DishSearchBar } from "@/components/DishSearchBar";
import { FavoritesList } from "@/components/FavoritesList";
import { Greeting } from "@/components/Greeting";
import { HomeToday } from "@/components/HomeToday";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Screen } from "@/components/Screen";
import { Eyebrow, Title } from "@/components/Type";
import { fromRow, targetOf } from "@/lib/profile";
import { currentUser } from "@/lib/supabase/claims";
import { createClient } from "@/lib/supabase/server";

// Home for people who are logged in (design/screens/Main.dc.html): how much of today's target is left,
// the macros, and what was eaten today. Reading the login is request-time work, so it sits behind <Suspense>.
export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const supabase = await createClient();
  if (!supabase) return <AccountsOff />;
  const user = await currentUser(supabase);
  if (!user) redirect("/login");

  const [{ data: row }, { data: favorites }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("favorites")
      .select("id,title")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  const profile = fromRow(row);
  const favoriteItems = (favorites ?? []) as { id: string; title: string }[];
  const target = profile ? targetOf(profile) : null;

  return (
    <Screen
      shell={{ kind: "inShell" }}
    >
      <div className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col gap-4 desk:flex-row desk:flex-wrap desk:items-end desk:justify-between desk:gap-5">
          <Greeting />
          <div className="desk:min-w-[280px] desk:flex-[0_1_460px]">
            <DishSearchBar suggest goal={profile?.goal ?? null} />
          </div>
        </div>
        <div className="desk:hidden">
          <FavoritesList items={favoriteItems} />
        </div>

        {!target && (
          <section className="flex flex-col gap-2 rounded-hero bg-terracotta-tint p-[18px]">
            <Eyebrow tone="terracotta">One more step</Eyebrow>
            <Title
              as="h2"
              lead="Set up your"
              accent="profile"
              className="text-lg"
            />
            <p className="text-sm">
              Tell me a bit about you and I&apos;ll set your daily target.
            </p>
            <Link href="/onboarding" className="text-sm font-semibold">
              Set up my profile
            </Link>
          </section>
        )}

        <HomeToday target={target} favorites={favoriteItems} />
      </div>
    </Screen>
  );
}
