// Date of birth instead of a typed age: the age is worked out from it, so it stays right as the years pass.
// Pure functions; dates are plain "YYYY-MM-DD" text (what the database's date column holds).

export type BirthParts = { day: string; month: string; year: string };

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for a real calendar date typed as day / month / year, or null (31 Feb, letters, a 2-digit year...). */
export function parseBirth({ day, month, year }: BirthParts): string | null {
  if (!/^\d{1,2}$/.test(day.trim()) || !/^\d{1,2}$/.test(month.trim()) || !/^\d{4}$/.test(year.trim())) return null;
  const [d, m, y] = [Number(day), Number(month), Number(year)];
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** The three form fields for a stored date (empty strings for none). */
export function splitBirth(birthDate: string | null): BirthParts {
  const m = birthDate ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate) : null;
  return m ? { day: String(Number(m[3])), month: String(Number(m[2])), year: m[1] } : { day: "", month: "", year: "" };
}

/** Whole years old on `now` (the birthday counts on the day itself), or null if the text is not a past date. */
export function ageOn(birthDate: string, now: Date): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(y, mo - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== d) return null;
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--;
  return age >= 0 ? age : null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "12 Mar 2000" */
export function birthLabel(birthDate: string): string {
  const p = splitBirth(birthDate);
  return p.day ? `${p.day} ${MONTHS[Number(p.month) - 1]} ${p.year}` : birthDate;
}
