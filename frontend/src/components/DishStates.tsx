import Image from "next/image";
import { DishHeader } from "@/components/DishHeader";
import { Screen } from "@/components/Screen";

/** What the guest typed, in the same card the result uses. */
export function DishEcho({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-card border border-line-soft bg-white px-3.5 py-3">
      <Image src="/bowl.png" alt="" width={36} height={36} />
      <span className="flex-1 text-[15px] wrap-break-word">{text}</span>
    </div>
  );
}

/** Shown while the backend works (a fresh parse can take a few seconds). */
export function DishLoading() {
  return (
    <Screen>
      <div className="flex flex-col gap-3.5">
        <DishHeader />
        <div role="status" className="flex flex-col gap-3.5">
          <span className="text-[13px] text-ink-muted">Estimating your bite…</span>
          <div className="h-[170px] animate-pulse rounded-hero bg-olive/60" />
          <div className="h-[132px] animate-pulse rounded-card bg-white/70" />
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
}: {
  query: string;
  title: string;
  message: string;
  details?: string[];
}) {
  return (
    <Screen>
      <div className="flex flex-col gap-3.5">
        <DishHeader />
        <DishEcho text={query} />
        <section role="alert" className="flex flex-col gap-2 rounded-hero bg-swap-bg p-[18px]">
          <h2 className="font-display text-[15px] font-normal text-ink-strong">{title}</h2>
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
          className="flex h-[52px] items-center justify-center rounded-card border-[1.5px] border-teal text-[15px] font-semibold"
        >
          Try again
        </a>
      </div>
    </Screen>
  );
}
