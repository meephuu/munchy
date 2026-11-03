import type { ComponentProps } from "react";

/** A labelled text / number input: 48px high, white, radius 12 (the design's form field). */
export function Field({
  id,
  label,
  className = "",
  ...input
}: { id: string; label: string } & Omit<ComponentProps<"input">, "id">) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        className="box-border h-12 w-full rounded-field border border-border bg-white px-3 text-[15px] text-ink outline-none focus:border-teal"
        {...input}
      />
    </div>
  );
}
