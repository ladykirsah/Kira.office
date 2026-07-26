import { describe, it, expect } from "vitest";
import { dateTimeToMs, msToDateInput, msToTimeInput, compactWindow } from "./couponSchedule";

/**
 * The coupon form splits each window bound into a date box + a time box (owner request). This helper
 * combines them into epoch ms (local time, matching the old datetime-local behaviour); no date means
 * no bound (null), and a date with no time defaults to midnight.
 */
describe("dateTimeToMs", () => {
  it("given no date > returns null (no window bound), even with a time", () => {
    expect(dateTimeToMs("", "")).toBeNull();
    expect(dateTimeToMs("", "10:00")).toBeNull();
  });

  it("given a date with no time > defaults to midnight", () => {
    expect(dateTimeToMs("2026-07-26", "")).toBe(dateTimeToMs("2026-07-26", "00:00"));
  });

  it("given date + time > a later time is a larger epoch by exactly the gap", () => {
    const a = dateTimeToMs("2026-07-26", "14:00")!;
    const b = dateTimeToMs("2026-07-26", "14:30")!;
    expect(b - a).toBe(30 * 60 * 1000);
  });

  it("given an unparseable date > returns null (no accidental Invalid-Date NaN)", () => {
    expect(dateTimeToMs("not-a-date", "10:00")).toBeNull();
  });
});

describe("msToDateInput / msToTimeInput (seed the edit form from a saved bound)", () => {
  it("given null > returns empty strings (an unbounded coupon has empty boxes)", () => {
    expect(msToDateInput(null)).toBe("");
    expect(msToTimeInput(null)).toBe("");
  });

  it("round-trips with dateTimeToMs (local time, minute precision)", () => {
    const ms = dateTimeToMs("2026-04-01", "09:30")!;
    expect(msToDateInput(ms)).toBe("2026-04-01");
    expect(msToTimeInput(ms)).toBe("09:30");
    expect(dateTimeToMs(msToDateInput(ms), msToTimeInput(ms))).toBe(ms);
  });

  it("zero-pads single-digit month/day/hour/minute", () => {
    const ms = dateTimeToMs("2026-01-05", "03:07")!;
    expect(msToDateInput(ms)).toBe("2026-01-05");
    expect(msToTimeInput(ms)).toBe("03:07");
  });
});

describe("compactWindow (period shown on the collapsed row)", () => {
  const apr1 = dateTimeToMs("2026-04-01", "00:00")!;
  const apr30 = dateTimeToMs("2026-04-30", "23:59")!;

  it("no bounds > Always", () => {
    expect(compactWindow(null, null)).toBe("Always");
  });
  it("start only > From <date>", () => {
    expect(compactWindow(apr1, null)).toBe("From 1 Apr 2026");
  });
  it("end only > Until <date>", () => {
    expect(compactWindow(null, apr30)).toBe("Until 30 Apr 2026");
  });
  it("both > <start> → <end>", () => {
    expect(compactWindow(apr1, apr30)).toBe("1 Apr 2026 → 30 Apr 2026");
  });
});
