import Link from "next/link";
import { ArrowLeftIcon } from "@/components/Icons";
import { Eyebrow, Title } from "@/components/Type";

/** Top bar of the dish screens (design "Bite check"): back button, eyebrow, and the dish as the title.
 *  The last word of the dish is set in italic green like the design's "Pad kra pao, *fried egg*". */
export function DishHeader({ dish }: { dish?: string }) {
  const words = dish?.trim().split(/\s+/) ?? [];
  const accent = words.length > 1 ? words.pop() : undefined;
  const lead = words.join(" ") || undefined;
  const title = dish ? (
    <Title lead={lead} accent={accent} className="line-clamp-2 text-xl first-letter:uppercase" />
  ) : (
    <Title lead="Working it" accent="out…" className="text-xl" />
  );

  return (
    <header className="flex items-center justify-between gap-3 pt-2">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/"
          aria-label="Back to search"
          className="flex size-11 shrink-0 items-center justify-center rounded-row bg-surface text-ink shadow-row"
        >
          <ArrowLeftIcon size={20} />
        </Link>
        <div className="flex min-w-0 flex-col gap-0.5">
          <Eyebrow>Bite check</Eyebrow>
          {title}
        </div>
      </div>
      <Link href="/login" className="shrink-0 text-sm font-semibold">
        Log in
      </Link>
    </header>
  );
}
