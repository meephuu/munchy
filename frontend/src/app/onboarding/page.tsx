import { Suspense } from "react";
import { OnboardingForm } from "@/components/OnboardingForm";
import { Screen } from "@/components/Screen";
import { fromRow } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

// Get started (design/screens/Onboarding.dc.html). Open to everyone: a guest's answers wait for
// sign-up; a logged-in person edits and saves their own profile. Reading the login is request-time
// work, so it sits behind <Suspense>; the screen stays blank until we know which form to show, so nobody
// types into a form that is about to be replaced.
export default function OnboardingPage() {
  return (
    <Suspense fallback={<Screen>{null}</Screen>}>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const supabase = await createClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (!supabase || !data.user) return <OnboardingForm member={false} saved={null} />;

  const { data: row } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  return <OnboardingForm member saved={fromRow(row)} />;
}
