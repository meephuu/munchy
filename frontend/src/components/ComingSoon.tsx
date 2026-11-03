import { BottomNav } from "@/components/BottomNav";
import { Screen } from "@/components/Screen";
import { Eyebrow, Title } from "@/components/Type";

/** A logged-in screen that is designed but not built yet (Coach, Progress): says so, keeps the nav. */
export function ComingSoon({
  eyebrow,
  lead,
  accent,
  children,
}: {
  eyebrow: string;
  lead: string;
  accent: string;
  children: string;
}) {
  return (
    <Screen>
      <div className="flex flex-1 flex-col gap-4 pt-4">
        <div className="flex flex-col gap-1">
          <Eyebrow>{eyebrow}</Eyebrow>
          <Title lead={lead} accent={accent} className="text-[26px]" />
        </div>
        <section className="flex flex-col gap-2 rounded-hero bg-surface p-[18px] shadow-card">
          <Eyebrow tone="muted">Coming soon</Eyebrow>
          <p className="text-sm text-ink-muted">{children}</p>
        </section>
      </div>
      <BottomNav />
    </Screen>
  );
}
