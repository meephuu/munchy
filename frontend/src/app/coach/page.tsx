import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountsOff } from "@/components/AccountsOff";
import { BottomNav } from "@/components/BottomNav";
import { CoachView } from "@/components/CoachView";
import { Screen } from "@/components/Screen";
import { fromRow, targetOf } from "@/lib/profile";
import { currentUser } from "@/lib/supabase/claims";
import { memberShell } from "@/lib/shell";
import { createClient } from "@/lib/supabase/server";

// Coach (design/screens/Coach.dc.html). Reading the login is request-time work, so it sits behind <Suspense>.
export default function CoachPage() {
  return (
    <Suspense fallback={<Screen>{null}</Screen>}>
      <Coach />
    </Suspense>
  );
}

async function Coach() {
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
      <div className="flex flex-col gap-4 pt-4 desk:gap-6 desk:pt-0">
        <CoachView target={profile ? targetOf(profile) : null} />
      </div>
      <BottomNav />
    </Screen>
  );
}
