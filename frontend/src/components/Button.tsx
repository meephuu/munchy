import Link from "next/link";
import type { ComponentProps } from "react";

// The primary action: 56px, green, radius 18, Figtree 600 (DESIGN.md).
const primary =
  "flex h-14 w-full cursor-pointer items-center justify-center rounded-btn bg-green text-base font-semibold " +
  "text-bg hover:bg-green-dark disabled:cursor-not-allowed disabled:opacity-50";

export function PrimaryButton({ className = "", ...rest }: ComponentProps<"button">) {
  return <button className={`${primary} ${className}`} {...rest} />;
}

export function PrimaryLink({ className = "", ...rest }: ComponentProps<typeof Link>) {
  return <Link className={`${primary} ${className}`} {...rest} />;
}

/** Choice button on the Get started screen (goal, typical day, sex): 44px, radius 12, green when chosen. */
export function OptionButton({
  selected,
  className = "",
  ...rest
}: Omit<ComponentProps<"button">, "type" | "aria-pressed"> & { selected: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`h-11 cursor-pointer rounded-field border px-3 text-[13px] font-medium ${
        selected ? "border-green bg-green text-bg" : "border-border bg-surface text-ink"
      } ${className}`}
      {...rest}
    />
  );
}
