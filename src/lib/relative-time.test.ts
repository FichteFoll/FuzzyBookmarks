import { describe, expect, it } from "vitest";

import { formatAbsoluteTime, formatRelativeTime } from "./relative-time";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = (365 / 12) * DAY;
const YEAR = 365 * DAY;

describe("formatRelativeTime", () => {
  it("shows the two largest adjacent units: 1y 4m ago", () => {
    // 1 year + 4 months + a sub-month remainder that must not bump the count.
    const diff = YEAR + 4 * MONTH + 100_000;
    expect(formatRelativeTime(0, diff)).toBe("1y 4m ago");
  });

  it("shows the two largest adjacent units: 2d 5h ago", () => {
    const diff = 2 * DAY + 5 * HOUR + 1000;
    expect(formatRelativeTime(0, diff)).toBe("2d 5h ago");
  });

  it("omits the second component when its count is 0: 3min ago", () => {
    const diff = 3 * MINUTE + 500;
    expect(formatRelativeTime(0, diff)).toBe("3min ago");
  });

  it("omits the second component when the remainder is under one month: 1y ago", () => {
    const diff = YEAR + 1_000_000;
    expect(formatRelativeTime(0, diff)).toBe("1y ago");
  });

  it("formats a plain seconds diff: 45s ago", () => {
    const diff = 45 * SECOND;
    expect(formatRelativeTime(0, diff)).toBe("45s ago");
  });

  it("returns 'now' for a diff under one second", () => {
    expect(formatRelativeTime(0, 999)).toBe("now");
  });

  it("returns 'now' for a timestamp in the future", () => {
    expect(formatRelativeTime(1000, 0)).toBe("now");
  });

  it("never pairs non-adjacent units, e.g. never '1y 40d ago'", () => {
    // 1 year plus 40 days: the adjacent unit to "y" is "m", not "d",
    // so the days must be folded into a months count instead.
    const diff = YEAR + 40 * DAY;
    expect(formatRelativeTime(0, diff)).toBe("1y 1m ago");
  });
});

describe("formatAbsoluteTime", () => {
  it("formats local time as zero-padded YYYY-MM-DD HH:MM:SS", () => {
    const timestamp = new Date(2024, 2, 5, 9, 7, 3).getTime();
    const date = new Date(timestamp);
    const pad = (value: number): string => String(value).padStart(2, "0");
    const expected =
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

    expect(formatAbsoluteTime(timestamp)).toBe(expected);
  });
});
