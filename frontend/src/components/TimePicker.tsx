"use client";

import { ChevronDownIcon } from "@/components/Icons";
import { formatTime, parseTime } from "@/lib/time";

const two = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** Pick a time of day ("HH:MM", 24 hours) from two drop-downs, hour and minute. They are real selects, so a
 *  phone shows its own scroll wheel; they are styled like the app's other fields. */
export function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (time: string) => void;
}) {
  const [h, m] = parseTime(value) ?? [12, 0];
  return (
    <div
      role="group"
      aria-label="Time eaten"
      className="flex items-center gap-2"
    >
      <Select
        label="Hour"
        value={h}
        options={HOURS}
        onPick={(n) => onChange(formatTime(n, m))}
      />
      <span
        aria-hidden="true"
        className="font-brand text-xl leading-none text-green"
      >
        :
      </span>
      <Select
        label="Minute"
        value={m}
        options={MINUTES}
        onPick={(n) => onChange(formatTime(h, n))}
      />
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: number;
  options: number[];
  onPick: (n: number) => void;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onPick(Number(e.target.value))}
        className="h-11 w-[84px] cursor-pointer appearance-none rounded-field border border-border bg-surface pr-7 pl-3 font-mono text-[16px] font-bold text-ink outline-none focus:border-green"
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {two(n)}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        size={16}
        className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-green"
      />
    </div>
  );
}
