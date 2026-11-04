// "HH:MM" (24 hours) helpers for the time picker.

const pad = (n: number) => String(n).padStart(2, "0");

export const MINUTE_STEP = 5;

/** [hour, minute] of an "HH:MM" text, or null. */
export function parseTime(text: string): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [h, min] = [Number(m[1]), Number(m[2])];
  return h <= 23 && min <= 59 ? [h, min] : null;
}

export const formatTime = (h: number, min: number) => `${pad(h)}:${pad(min)}`;

const wrap = (n: number, size: number) => ((n % size) + size) % size;

/** Move the hour by one (23 goes round to 00, the minutes stay), or the minutes to the next / previous multiple
 *  of 5 (from 07 the next is 10, the previous 05; 55 goes round to 00 without touching the hour). */
export function stepTime(value: string, part: "hour" | "minute", direction: 1 | -1): string {
  const [h, min] = parseTime(value) ?? [12, 0];
  if (part === "hour") return formatTime(wrap(h + direction, 24), min);
  const next = direction === 1 ? (Math.floor(min / MINUTE_STEP) + 1) * MINUTE_STEP : (Math.ceil(min / MINUTE_STEP) - 1) * MINUTE_STEP;
  return formatTime(h, wrap(next, 60));
}
