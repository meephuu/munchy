import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountsOff } from "@/components/AccountsOff";
import { BottomNav } from "@/components/BottomNav";
import { DishSearchBar } from "@/components/DishSearchBar";
import { FavoritesManager } from "@/components/FavoritesManager";
import { MyDishes } from "@/components/MyDishes";
import { Screen } from "@/components/Screen";
import { Eyebrow, Title } from "@/components/Type";
import { fromRow } from "@/lib/profile";
import { memberShell } from "@/lib/shell";
import { currentUser } from "@/lib/supabase/claims";
import { createClient } from "@/lib/supabase/server";

// The "+" in the bottom nav: look up a dish, then log it from the result. Members only (see the proxy).
// Reading the login is request-time work, so it sits behind <Suspense>.
export default function AddPage() {
  return (
    <Suspense fallback={<Screen>{null}</Screen>}>
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
      shell={{ kind: "member", member: memberShell(user.email, profile) }}
    >
      <div className="flex flex-1 flex-col gap-4 pt-4">
        <div className="flex flex-col gap-1">
          <Eyebrow>Log a dish</Eyebrow>
          <Title lead="What did you" accent="munch?" className="text-[26px]" />
        </div>
        <DishSearchBar suggest goal={profile?.goal ?? null} />
        <p className="text-sm text-ink-muted">
          Type any dish, adjust the amounts if you like, then log it to
          breakfast, lunch, dinner or a snack.
        </p>
        <FavoritesManager />
        <MyDishes />
      </div>
      <BottomNav />
    </Screen>
  );
}
