import { DishHeader } from "@/components/DishHeader";
import { LoadingSteps } from "@/components/LoadingSteps";
import { DishSearchBar } from "@/components/DishSearchBar";
import { Screen } from "@/components/Screen";
import type { MemberShell } from "@/lib/shell";
import { Eyebrow, Title } from "@/components/Type";

/** Shown while the backend works (a fresh parse can take a few seconds). */
export function DishLoading() {
  return (
    <Screen>
      <div className="flex flex-col gap-3.5">
        <DishHeader />
        <div role="status" aria-label="Loading">
          <LoadingSteps />
        </div>
      </div>
    </Screen>
  );
}

/** The estimate could not be shown: a failure, or nothing in the input is in our food table. */
export function DishProblem({
  query,
  title,
  message,
  details = [],
  member = null,
}: {
  query: string;
  title: string;
  message: string;
  details?: string[];
  member?: MemberShell | null;
}) {
  return (
    <Screen
      shell={
        member
          ? { kind: "member", member }
          : {
              kind: "guest",
              topBar: <DishSearchBar placeholder="Check another dish" />,
            }
      }
    >
      <div className="flex flex-col gap-3.5">
        <DishHeader dish={query} />
        <section
          role="alert"
          className="flex flex-col gap-2 rounded-hero bg-terracotta-tint p-[18px]"
        >
          <Eyebrow tone="terracotta">Hmm</Eyebrow>
          <Title as="h2" lead={title} className="text-lg" />
          <p className="text-sm">{message}</p>
          {details.length > 0 && (
            <ul className="list-disc pl-4 text-xs text-ink-muted">
              {details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </section>
        {/* a plain <a>: a full reload makes sure the backend is asked again */}
        <a
          href={`/dish?q=${encodeURIComponent(query)}`}
          className="flex h-[52px] items-center justify-center rounded-card border-[1.5px] border-green text-[15px] font-semibold"
        >
          Try again
        </a>
      </div>
    </Screen>
  );
}
