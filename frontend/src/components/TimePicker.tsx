"use client";

import { useEffect, useRef } from "react";
import { formatTime, parseTime } from "@/lib/time";

const ROW = 44; // px per row; three rows are visible and the middle one is the chosen time
const two = (n: number) => String(n).padStart(2, "0");

/** A minimal wheel time picker ("HH:MM", 24 hours): hour and minute columns you scroll or swipe, snapping to a row,
 *  the chosen one on a soft band in the middle. Click a number to jump to it; arrow keys step the focused wheel. */
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
      className="relative mx-auto grid w-44 grid-cols-2"
      style={{ height: ROW * 3 }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 rounded-field bg-sand"
        style={{ top: ROW, height: ROW }}
      />
      <Wheel
        label="Hour"
        count={24}
        value={h}
        onPick={(n) => onChange(formatTime(n, m))}
      />
      <Wheel
        label="Minute"
        count={60}
        value={m}
        onPick={(n) => onChange(formatTime(h, n))}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center font-mono text-[20px] font-bold text-ink"
        style={{ top: ROW, height: ROW }}
      >
        :
      </span>
    </div>
  );
}

function Wheel({
  label,
  count,
  value,
  onPick,
}: {
  label: string;
  count: number;
  value: number;
  onPick: (n: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Keep the wheel on the value when it changes from outside (a tap, a key, the first render).
  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ROW) !== value)
      el.scrollTop = value * ROW;
  }, [value]);

  useEffect(() => () => clearTimeout(settle.current), []);

  // Report the row the wheel came to rest on, a moment after the scrolling stops.
  const onScroll = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(
        count - 1,
        Math.max(0, Math.round(el.scrollTop / ROW)),
      );
      if (i !== value) onPick(i);
    }, 90);
  };

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          onPick((value + (e.key === "ArrowDown" ? 1 : -1) + count) % count);
        }
      }}
      className="relative h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain outline-none [scrollbar-width:none] [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)] focus-visible:rounded-field focus-visible:ring-2 focus-visible:ring-green [&::-webkit-scrollbar]:hidden"
      style={{ paddingBlock: ROW }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          role="option"
          aria-selected={i === value}
          onClick={() => onPick(i)}
          className={`flex cursor-pointer snap-center items-center font-mono text-[20px] ${
            i === value ? "font-bold text-ink" : "text-ink-muted"
          } ${label === "Hour" ? "justify-end pr-3.5" : "justify-start pl-3.5"}`}
          style={{ height: ROW }}
        >
          {two(i)}
        </div>
      ))}
    </div>
  );
}
