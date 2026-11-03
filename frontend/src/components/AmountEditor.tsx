"use client";

import { useEffect, useRef, useState } from "react";
import { Chip } from "@/components/Chip";
import { MinusIcon, PlusIcon } from "@/components/Icons";
import { bestUnit, formatQty, stepOf, toGrams, toQty, type UnitOption } from "@/lib/units";

const MAX_G = 5000;

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number) => Math.min(MAX_G, Math.max(0, round1(n)));

/** Change how much of one food is in the meal, in grams or in the food's own units (1 egg, 2 tbsp,
 *  3 slices): - / + buttons, a typed value, and shortcuts relative to the starting amount. The meal
 *  always keeps grams; the unit only changes how the amount is shown and typed. onChange gets the
 *  new grams (0 = leave it out). */
export function AmountEditor({
  id,
  name,
  grams,
  units,
  estimated,
  baseLabel = "As estimated",
  onChange,
  onRemove,
}: {
  id: string;
  name: string;
  grams: number;
  /** Units this food is counted in, besides grams. */
  units: UnitOption[];
  /** The amount the shortcuts are relative to (the AI's estimate, or a serving for an added food). */
  estimated: number;
  baseLabel?: string;
  onChange: (grams: number) => void;
  /** Given for foods the user added: shows a Remove button. */
  onRemove?: () => void;
}) {
  // Start in the unit the amount reads best in (50 g of boiled egg -> 1 egg), else grams.
  const [unitLabel, setUnitLabel] = useState(() => bestUnit(grams, units)?.label ?? "g");
  const unit = units.find((u) => u.label === unitLabel) ?? null;     // null = grams
  const unitName = unit?.label ?? "g";

  // While the user is typing, show exactly what they typed ("1." or ""); otherwise show the value.
  const [draft, setDraft] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Opening the editor near the bottom would leave it under the floating sign-up button.
  useEffect(() => {
    root.current?.scrollIntoView({ block: "nearest" });
  }, []);

  const set = (g: number) => {
    setDraft(null);
    onChange(clamp(g));
  };
  const stepG = stepOf(unit) * (unit?.grams ?? 1);

  const shortcuts = [
    { label: "Half", grams: clamp(estimated / 2) },
    { label: baseLabel, grams: clamp(estimated) },
    { label: "Double", grams: clamp(estimated * 2) },
  ];

  return (
    <div id={id} ref={root} className="flex scroll-mb-32 flex-col gap-2.5 pb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Less ${name}`}
          disabled={grams <= 0}
          onClick={() => set(grams - stepG)}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-field bg-cream text-teal disabled:opacity-40"
        >
          <MinusIcon size={20} />
        </button>
        <label className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-field border border-border bg-white">
          <input
            type="text"
            inputMode="decimal"
            aria-label={`Amount of ${name} in ${unitName === "g" ? "grams" : unitName}`}
            value={draft ?? formatQty(toQty(grams, unit))}
            onChange={(e) => {
              const text = e.target.value;
              if (!/^\d*\.?\d*$/.test(text)) return;
              setDraft(text);
              const n = parseFloat(text);
              if (Number.isFinite(n)) onChange(clamp(toGrams(n, unit)));
            }}
            onFocus={(e) => e.target.select()}
            onBlur={() => setDraft(null)}
            className="w-14 bg-transparent text-center text-[15px] font-semibold text-ink outline-none"
          />
          <span className="text-sm text-ink-muted">{unitName}</span>
        </label>
        <button
          type="button"
          aria-label={`More ${name}`}
          onClick={() => set(grams + stepG)}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-field bg-cream text-teal"
        >
          <PlusIcon size={20} />
        </button>
      </div>

      {units.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-ink-muted">
            {unit ? `= ${round1(grams)} g · measure in` : "Measure in"}
          </span>
          <div className="flex flex-wrap gap-2">
            {[{ label: "g", grams: 1 }, ...units].map((u) => (
              <Chip
                key={u.label}
                selected={u.label === unitName}
                onClick={() => {
                  setDraft(null);
                  setUnitLabel(u.label);
                }}
              >
                {u.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {shortcuts.map((s) => (
          <Chip key={s.label} selected={grams === s.grams} onClick={() => set(s.grams)}>
            {s.label}
          </Chip>
        ))}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto min-h-11 cursor-pointer px-1 text-[13px] font-semibold text-fat-ink"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
