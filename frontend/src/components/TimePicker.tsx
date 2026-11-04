"use client";

import { MinusIcon, PlusIcon } from "@/components/Icons";
import { formatTime, parseTime, stepTime } from "@/lib/time";

const button =
  "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-field bg-sand text-green";

/** Pick a time of day ("HH:MM", 24 hours) with the same - / + steppers as the amount editor: the hour by one,
 *  the minutes by five. Tap a number to type it. */
export function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (time: string) => void;
}) {
  const [h, m] = parseTime(value) ?? [12, 0];

  // The box always shows two digits, so a typed digit lands after "0x": keep the last two ("01" + "2" -> 12).
  const typed = (part: "hour" | "minute", text: string) => {
    const digits = text.replace(/\D/g, "").slice(-2);
    if (digits === "") return;
    const n = Number(digits);
    if (n > (part === "hour" ? 23 : 59)) return;
    onChange(part === "hour" ? formatTime(n, m) : formatTime(h, n));
  };

  return (
    <div
      role="group"
      aria-label="Time eaten"
      className="flex items-center gap-2"
    >
      <Unit
        label="hour"
        value={h}
        onType={(t) => typed("hour", t)}
        onStep={(d) => onChange(stepTime(value, "hour", d))}
      />
      <span
        aria-hidden="true"
        className="font-brand text-xl leading-none text-green"
      >
        :
      </span>
      <Unit
        label="minute"
        value={m}
        onType={(t) => typed("minute", t)}
        onStep={(d) => onChange(stepTime(value, "minute", d))}
      />
    </div>
  );
}

function Unit({
  label,
  value,
  onType,
  onStep,
}: {
  label: "hour" | "minute";
  value: number;
  onType: (text: string) => void;
  onStep: (direction: 1 | -1) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`Earlier ${label}`}
        onClick={() => onStep(-1)}
        className={button}
      >
        <MinusIcon size={18} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label === "hour" ? "Hour" : "Minute"}
        value={String(value).padStart(2, "0")}
        onChange={(e) => onType(e.target.value)}
        onFocus={(e) => e.target.select()}
        className="h-11 w-12 rounded-field border border-border bg-surface text-center font-mono text-[17px] font-bold text-ink outline-none focus:border-green"
      />
      <button
        type="button"
        aria-label={`Later ${label}`}
        onClick={() => onStep(1)}
        className={button}
      >
        <PlusIcon size={18} />
      </button>
    </div>
  );
}
