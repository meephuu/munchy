"use client";

import { useState } from "react";
import { Chip } from "@/components/Chip";
import { MinusIcon, PlusIcon } from "@/components/Icons";

const STEP_G = 10;
const MAX_G = 5000;

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number) => Math.min(MAX_G, Math.max(0, round1(n)));

/** Change how much of one food is in the meal: - / + buttons, a typed value in grams, and
 *  shortcuts relative to what the AI estimated. Calls onChange with the new grams (0 = leave it out). */
export function AmountEditor({
  id,
  name,
  grams,
  estimated,
  onChange,
}: {
  id: string;
  name: string;
  grams: number;
  /** The AI's estimate, for the shortcuts. */
  estimated: number;
  onChange: (grams: number) => void;
}) {
  // While the user is typing, show exactly what they typed ("1." or ""); otherwise show the value.
  const [draft, setDraft] = useState<string | null>(null);

  const set = (g: number) => {
    setDraft(null);
    onChange(clamp(g));
  };

  const shortcuts = [
    { label: "Half", grams: clamp(estimated / 2) },
    { label: "As estimated", grams: clamp(estimated) },
    { label: "Double", grams: clamp(estimated * 2) },
  ];

  return (
    <div id={id} className="flex flex-col gap-2.5 pb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Less ${name}`}
          disabled={grams <= 0}
          onClick={() => set(grams - STEP_G)}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-field bg-cream text-teal disabled:opacity-40"
        >
          <MinusIcon size={20} />
        </button>
        <label className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-field border border-border bg-white">
          <input
            type="text"
            inputMode="decimal"
            aria-label={`Amount of ${name} in grams`}
            value={draft ?? String(grams)}
            onChange={(e) => {
              const text = e.target.value;
              if (!/^\d*\.?\d*$/.test(text)) return;
              setDraft(text);
              const n = parseFloat(text);
              if (Number.isFinite(n)) onChange(clamp(n));
            }}
            onFocus={(e) => e.target.select()}
            onBlur={() => setDraft(null)}
            className="w-16 bg-transparent text-center text-[15px] font-semibold text-ink outline-none"
          />
          <span className="text-sm text-ink-muted">g</span>
        </label>
        <button
          type="button"
          aria-label={`More ${name}`}
          onClick={() => set(grams + STEP_G)}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-field bg-cream text-teal"
        >
          <PlusIcon size={20} />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {shortcuts.map((s) => (
          <Chip key={s.label} selected={grams === s.grams} onClick={() => set(s.grams)}>
            {s.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
