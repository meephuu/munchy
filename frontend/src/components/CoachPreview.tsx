import Link from "next/link";
import { PlusIcon } from "@/components/Icons";
import { Eyebrow, Title } from "@/components/Type";
import catalogJson from "@/lib/catalog.json";
import { ideasFor, type CatalogDish } from "@/lib/coach";
import { slotLabel, type MealSlot } from "@/lib/meals";

const catalog = catalogJson as CatalogDish[];

/** The desktop Home's Coach card: three dishes that fit what is left today, each a + to open it; "All ideas" opens Coach. */
export function CoachPreview({
  next,
  kcalLeft,
  proteinLeft,
  eatenTitles,
}: {
  next: MealSlot | null;
  kcalLeft: number;
  proteinLeft: number;
  eatenTitles: string[];
}) {
  if (kcalLeft <= 0) return null;
  const ideas = ideasFor(catalog, { kcal: kcalLeft }, eatenTitles, "fit");
  if (ideas.length === 0) return null;

  return (
    <section className="flex flex-col gap-1.5 rounded-hero bg-surface p-[22px] shadow-card">
      <div className="flex items-baseline justify-between">
        <Eyebrow>Coach{next ? ` · ${slotLabel(next)}` : ""}</Eyebrow>
        <Link href="/coach" className="text-[13px] font-semibold">
          All ideas
        </Link>
      </div>
      <Title
        as="h2"
        lead="What fits"
        accent={next === "dinner" ? "tonight?" : "next?"}
        className="text-xl"
      />
      <span className="pb-1.5 text-[13px] text-ink-muted">
        {kcalLeft.toLocaleString("en-US")} kcal
        {proteinLeft > 0 ? ` and ${proteinLeft} g protein` : ""} to go
      </span>
      {ideas.map((d) => (
        <Link
          key={d.title}
          href={`/dish?q=${encodeURIComponent(d.title)}`}
          className="flex items-center gap-3 border-t border-divider py-2.5 text-ink hover:bg-bg/60"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm font-semibold">{d.title}</span>
            <span className="font-mono text-[10px] text-ink-muted">
              {d.kcal} kcal · P {d.protein} g
            </span>
          </span>
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green text-bg"
          >
            <PlusIcon size={16} />
          </span>
        </Link>
      ))}
    </section>
  );
}
