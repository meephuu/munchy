import Link from "next/link";
import { Brand } from "@/components/Brand";
import { Screen } from "@/components/Screen";
import { Eyebrow, Title } from "@/components/Type";

/** Shown instead of the sign-up / log-in form when Supabase keys are not configured. */
export function AccountsOff() {
  return (
    <Screen>
      <div className="flex flex-col gap-3.5 pt-1">
        <Brand />
        <section role="note" className="flex flex-col gap-2 rounded-hero bg-terracotta-tint p-[18px]">
          <Eyebrow tone="terracotta">Heads up</Eyebrow>
          <Title as="h1" lead="Accounts aren't" accent="switched on yet" className="text-lg" />
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
