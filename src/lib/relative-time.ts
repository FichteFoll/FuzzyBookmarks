// Pure formatting helpers for a bookmark's `dateAdded` timestamp.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = (365 / 12) * DAY;
const YEAR = 365 * DAY;

// Largest-to-smallest; `formatRelativeTime` only ever pairs a unit with
// the next one in this list, never a non-adjacent pair.
const UNITS: ReadonlyArray<{ label: string; ms: number }> = [
  { label: "y", ms: YEAR },
  { label: "m", ms: MONTH },
  { label: "d", ms: DAY },
  { label: "h", ms: HOUR },
  { label: "min", ms: MINUTE },
  { label: "s", ms: SECOND },
];

export function formatRelativeTime(timestamp: number, now: number): string {
  const diff = now - timestamp;
  if (diff < SECOND) return "now";

  for (const [i, unit] of UNITS.entries()) {
    const count = Math.floor(diff / unit.ms);
    if (count < 1) continue;

    const remainder = diff - count * unit.ms;
    const nextUnit: (typeof UNITS)[number] | undefined = UNITS[i + 1];
    const nextCount = nextUnit ? Math.floor(remainder / nextUnit.ms) : 0;
    const suffix =
      nextUnit && nextCount > 0 ? ` ${nextCount}${nextUnit.label}` : "";
    return `${count}${unit.label}${suffix} ago`;
  }

  return "now";
}

export function formatAbsoluteTime(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number): string => String(value).padStart(2, "0");
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${datePart} ${timePart}`;
}
