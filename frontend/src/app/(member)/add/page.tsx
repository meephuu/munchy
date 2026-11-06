import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountsOff } from "@/components/AccountsOff";
import { BottomNav } from "@/components/BottomNav";
import { DishSearchBar } from "@/components/DishSearchBar";
import { FavoritesManager } from "@/components/FavoritesManager";
import { MyDishes } from "@/components/MyDishes";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Screen } from "@/components/Screen";
import { Eyebrow, Title } from "@/components/Type";
import { fromRow } from "@/lib/profile";
import { currentUser } from "@/lib/supabase/claims";
import { createClient } from "@/lib/supabase/server";

// The "+" in the bottom nav / "Log a dish" in the sidebar: look up a dish, then log it from the result. Members only
// (see the proxy). Reading the login is request-time work, so it sits behind <Suspense>.
export default function AddPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Add />
    </Suspense>
  );
}

async function Add() {
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

  return (
    <Screen
      shell={{ kind: "inShell" }}
    >
      <div className="flex flex-1 flex-col gap-4 pt-4 desk:gap-6 desk:pt-0">
        <section className="flex flex-col gap-4 desk:flex-row desk:flex-wrap desk:items-center desk:gap-8 desk:rounded-hero desk:bg-surface desk:px-10 desk:py-9 desk:shadow-card">
          <div className="flex min-w-0 flex-col gap-4 desk:flex-[1_1_460px]">
            <div className="flex flex-col gap-1 desk:gap-4">
              <Eyebrow>Log a dish</Eyebrow>
              <Title
                lead="What did you"
                accent="munch?"
                className="text-[26px] desk:text-[40px]"
              />
            </div>
            <div className="desk:max-w-[640px]">
              <DishSearchBar suggest large goal={profile?.goal ?? null} />
            </div>
            <p className="text-sm text-ink-muted desk:max-w-[520px] desk:text-[15px] desk:leading-normal">
              Type any dish, adjust the amounts if you like, then log it to
              breakfast, lunch, dinner or a snack.
            </p>
          </div>
        </section>

        <MyDishes favorites={<FavoritesManager />} />
      </div>
      <BottomNav />
    </Screen>
  );
}
