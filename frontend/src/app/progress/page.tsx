import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountsOff } from "@/components/AccountsOff";
import { BottomNav } from "@/components/BottomNav";
import { ProgressView } from "@/components/ProgressView";
import { Screen } from "@/components/Screen";
import { Eyebrow, Title } from "@/components/Type";
import { fromRow, targetOf } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

// Progress (design/screens/Progress.dc.html). Reading the login is request-time work, so it sits behind <Suspense>.
export default function ProgressPage() {
  return (
    <Suspense fallback={<Screen>{null}</Screen>}>
      <Progress />
    </Suspense>
  );
}

async function Progress() {
  const supabase = await createClient();
  if (!supabase) return <AccountsOff />;
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const { data: row } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  const profile = fromRow(row);

  return (
    <Screen>
      <div className="flex flex-col gap-4 pt-4">
        <div className="flex flex-col gap-1">
          <Eyebrow>Progress · last 7 days</Eyebrow>
          <Title lead="Your week," accent="at a glance" className="text-[26px]" />
        </div>
        <ProgressView target={profile ? targetOf(profile) : null} />
      </div>
      <BottomNav />
    </Screen>
  );
}
