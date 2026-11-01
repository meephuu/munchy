import Link from "next/link";
import type { ComponentProps } from "react";

// Pill chip: 34px visible height; the ::after widens the hit area to 44px without
// changing the layout (DESIGN.md: keep a >=44px tap target).
const base =
  "relative inline-flex h-[34px] shrink-0 cursor-pointer items-center rounded-full border px-3.5 " +
  "text-[13px] leading-none after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-['']";
const selectedClass = "border-teal bg-teal text-cream";
const idleClass = "border-border bg-white text-ink";

type ChipProps = Omit<ComponentProps<"button">, "type" | "aria-pressed"> & { selected: boolean };

/** Toggle / single-choice chip. */
export function Chip({ selected, className = "", ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`${base} ${selected ? selectedClass : idleClass} ${className}`}
      {...rest}
    />
  );
}

/** Suggestion chip that navigates (never selected). */
export function ChipLink({ className = "", ...rest }: ComponentProps<typeof Link>) {
  return <Link className={`${base} ${idleClass} ${className}`} {...rest} />;
}
