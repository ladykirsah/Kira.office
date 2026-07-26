import { describe, it, expect } from "vitest";
import { dateTimeToMs } from "./couponSchedule";

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
