import Link from "next/link";
import { Screen } from "@/components/Screen";

// Placeholder so "Log in" / "Create free account" do not 404. The real screen is
// design/screens/Onboarding.dc.html and comes after the guest screens.
export default function OnboardingPlaceholder() {
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <h1 className="font-display text-2xl font-normal">Accounts are coming soon</h1>
        <p className="text-sm text-ink-muted">Sign-up and your daily target are the next screens.</p>
        <Link href="/" className="text-sm font-semibold">
          Back to search
        </Link>
      </div>
    </Screen>
  );
}
