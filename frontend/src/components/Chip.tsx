import Link from "next/link";
import type { ComponentProps } from "react";

// Pill chip: 34px visible height, 13px/500; the ::after widens the hit area to 44px without changing
// the layout (DESIGN.md: keep a >=44px tap target).
const base =
  "relative inline-flex h-[34px] shrink-0 cursor-pointer items-center rounded-full border text-[13px] " +
  "leading-none font-medium after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-['']";
const selectedClass = "border-green bg-green text-bg";
const idleClass = "border-border bg-surface text-ink";

type ChipProps = Omit<ComponentProps<"button">, "type" | "aria-pressed"> & { selected: boolean };

/** Toggle / single-choice chip. */
export function Chip({ selected, className = "", ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`${base} px-3.5 ${selected ? selectedClass : idleClass} ${className}`}
      {...rest}
    />
  );
}

/** Suggestion chip that navigates (never selected). */
export function ChipLink({ className = "", ...rest }: ComponentProps<typeof Link>) {
  return <Link className={`${base} px-3 ${idleClass} ${className}`} {...rest} />;
}
