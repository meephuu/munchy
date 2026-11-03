import Link from "next/link";
import { Brand } from "@/components/Brand";
import { Screen } from "@/components/Screen";

/** Shown instead of the sign-up / log-in form when Supabase keys are not configured. */
export function AccountsOff() {
  return (
    <Screen>
      <div className="flex flex-col gap-4 pt-1">
        <Brand />
        <section role="note" className="flex flex-col gap-2 rounded-hero bg-swap-bg p-[18px]">
          <h1 className="font-display text-[15px] font-normal text-ink-strong">Accounts aren&apos;t switched on yet</h1>
          <p className="text-sm">
            This copy of Munchy isn&apos;t connected to its account service. You can still look up any dish
            without an account.
          </p>
        </section>
        <Link href="/" className="text-sm font-semibold">
          Back to search
        </Link>
      </div>
    </Screen>
  );
}
