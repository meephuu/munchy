import { BottomNav } from "@/components/BottomNav";
import { Screen } from "@/components/Screen";

/** What a (member) page shows while its data loads: quiet blocks in the shape of the page, and the phone's bottom nav,
 *  so nothing jumps when the page arrives. The sidebar comes from the layout. */
export function PageSkeleton() {
  return (
    <Screen shell={{ kind: "inShell" }} still>
      <div
        role="status"
        aria-label="Loading"
        className="flex flex-col gap-4 pt-2 desk:gap-6"
      >
        <div className="flex flex-col gap-2">
          <div className="h-7 w-2/3 animate-pulse rounded-field bg-sand/70 desk:h-9 desk:w-80" />
          <div className="h-7 w-1/2 animate-pulse rounded-field bg-sand/70 desk:h-9 desk:w-60" />
        </div>
        <div className="h-14 animate-pulse rounded-card bg-sand/60" />
        <div className="h-[200px] animate-pulse rounded-hero bg-sand/60 desk:h-[260px]" />
        <div className="flex gap-2.5">
          <div className="h-[84px] flex-1 animate-pulse rounded-card bg-sand/50" />
          <div className="h-[84px] flex-1 animate-pulse rounded-card bg-sand/50" />
          <div className="h-[84px] flex-1 animate-pulse rounded-card bg-sand/50" />
        </div>
      </div>
      <BottomNav />
    </Screen>
  );
}
