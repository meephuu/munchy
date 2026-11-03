import Link from "next/link";
import type { ComponentProps } from "react";

// The primary action: 56px, teal, radius 18 (DESIGN.md), set in the display font like the design's
// "Let's munch" button.
const primary =
  "flex h-14 w-full cursor-pointer items-center justify-center rounded-btn bg-teal font-display text-base " +
  "text-cream disabled:cursor-not-allowed disabled:opacity-50";

export function PrimaryButton({ className = "", ...rest }: ComponentProps<"button">) {
  return <button className={`${primary} ${className}`} {...rest} />;
}

export function PrimaryLink({ className = "", ...rest }: ComponentProps<typeof Link>) {
  return <Link className={`${primary} ${className}`} {...rest} />;
}

/** Square-ish choice button (goal, activity, sex): 48px, radius 14, teal when chosen. */
export function OptionButton({
  selected,
  className = "",
  ...rest
}: Omit<ComponentProps<"button">, "type" | "aria-pressed"> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`h-12 cursor-pointer rounded-row border px-3 text-[13px] ${
        selected ? "border-teal bg-teal text-cream" : "border-border bg-white text-ink"
      } ${className}`}
      {...rest}
    />
  );
}
