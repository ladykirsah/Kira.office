import { describe, it, expect } from "vitest";
import { dateRange } from "./dateRange";

/**
 * The orders page defaults to the "Today" range, so this boundary decides whether the owner sees a
 * fresh order at all. The shop is in Bangkok (UTC+7); an order placed at 00:45 local is BEFORE UTC
 * midnight, so deriving the day boundary from epoch arithmetic (`now - now % DAY_MS`) silently
 * hides every order placed between local midnight and 07:00.
 *
 * Every timestamp below is built with the local-time Date constructor, so these assertions hold in
 * any timezone rather than only in the one that happened to be set when they were written.
 */
const local = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

const DAY_MS = 24 * 60 * 60 * 1000;

describe("dateRange > today", () => {
  const now = local(2026, 7, 30, 10, 35);

  it("starts at LOCAL midnight, not UTC midnight", () => {
    expect(dateRange("today", now, "", "").start).toBe(local(2026, 7, 30));
  });

  it("given an order placed at 00:45 local > includes it", () => {
    const { start, end } = dateRange("today", now, "", "");
    const order = local(2026, 7, 30, 0, 45);
    expect(order).toBeGreaterThanOrEqual(start);
    expect(order).toBeLessThanOrEqual(end);
  });

  it("given an order placed at 23:59 the previous day > excludes it", () => {
    const { start } = dateRange("today", now, "", "");
    expect(local(2026, 7, 29, 23, 59)).toBeLessThan(start);
  });
});

describe("dateRange > month boundaries", () => {
  const now = local(2026, 7, 30, 10, 35);

  it("this month starts at local midnight on the 1st", () => {
    expect(dateRange("month", now, "", "").start).toBe(local(2026, 7, 1));
  });

  it("last month spans the 1st of the previous month to the 1st of this one", () => {
    const { start, end } = dateRange("lastmonth", now, "", "");
    expect(start).toBe(local(2026, 6, 1));
    expect(end).toBe(local(2026, 7, 1));
  });

  it("given January > last month rolls back into the previous year", () => {
    const jan = local(2026, 1, 15, 12, 0);
    expect(dateRange("lastmonth", jan, "", "").start).toBe(local(2025, 12, 1));
  });
});

describe("dateRange > custom", () => {
  const now = local(2026, 7, 30, 10, 35);

  it("treats the picked from-date as LOCAL midnight", () => {
    // <input type="date"> yields "YYYY-MM-DD"; `new Date(str)` would parse that as UTC.
    expect(dateRange("custom", now, "2026-07-10", "").start).toBe(local(2026, 7, 10));
  });

  it("includes the whole of the picked to-date", () => {
    const { end } = dateRange("custom", now, "2026-07-10", "2026-07-20");
    expect(end).toBe(local(2026, 7, 20) + DAY_MS);
    // an order at 23:59 on the to-date must still fall inside the range
    expect(local(2026, 7, 20, 23, 59)).toBeLessThan(end);
  });

  it("given no dates picked yet > falls back to everything up to now", () => {
    expect(dateRange("custom", now, "", "")).toEqual({ start: 0, end: now });
  });
});

describe("dateRange > all", () => {
  it("spans from the epoch to now", () => {
    const now = local(2026, 7, 30, 10, 35);
    expect(dateRange("all", now, "", "")).toEqual({ start: 0, end: now });
  });
});
