import type { ComponentProps } from "react";

/** A labelled text / number input: 46px high, white, radius 12, with the small mono label above. */
export function Field({
  id,
  label,
  className = "",
  ...input
}: { id: string; label: string } & Omit<ComponentProps<"input">, "id">) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={id}
        className="font-mono text-[10px] font-bold tracking-[1px] text-ink-muted uppercase"
      >
        {label}
      </label>
      <input
        id={id}
        className="box-border h-[46px] w-full rounded-field border border-border bg-surface px-3 text-[15px] text-ink outline-none focus:border-green"
        {...input}
      />
    </div>
  );
}
