import { BottomNav } from "@/components/BottomNav";
import { DishSearchBar } from "@/components/DishSearchBar";
import { Screen } from "@/components/Screen";
import { Eyebrow, Title } from "@/components/Type";

// The "+" in the bottom nav: look up a dish, then log it from the result. Members only (see the proxy).
export default function AddPage() {
  return (
    <Screen>
      <div className="flex flex-1 flex-col gap-4 pt-4">
        <div className="flex flex-col gap-1">
          <Eyebrow>Log a dish</Eyebrow>
          <Title lead="What did you" accent="munch?" className="text-[26px]" />
        </div>
        <DishSearchBar />
        <p className="text-sm text-ink-muted">
          Type any dish, adjust the amounts if you like, then log it to breakfast, lunch, dinner or a snack.
        </p>
      </div>
      <BottomNav />
    </Screen>
  );
}
