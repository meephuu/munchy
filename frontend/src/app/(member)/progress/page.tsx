import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountsOff } from "@/components/AccountsOff";
import { ProgressView } from "@/components/ProgressView";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Screen } from "@/components/Screen";
import { fromRow, targetOf } from "@/lib/profile";
import { currentUser } from "@/lib/supabase/claims";
import { createClient } from "@/lib/supabase/server";

// Progress (design/screens/Progress.dc.html). Reading the login is request-time work, so it sits behind <Suspense>.
export default function ProgressPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Progress />
    </Suspense>
  );
}

async function Progress() {
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
      <div className="flex flex-col gap-4 pt-4 desk:gap-6 desk:pt-0">
        <ProgressView target={profile ? targetOf(profile) : null} />
      </div>
    </Screen>
  );
}
