import { describe, it, expect } from "vitest";
import { ageInYears, isAtLeastYears } from "./age";

// Fixed "now": 2026-07-17T00:00:00Z
const NOW = Date.UTC(2026, 6, 17);

describe("ageInYears", () => {
  it("exactly 20 today (birthday is today) > 20", () => {
    expect(ageInYears("2006-07-17", NOW)).toBe(20);
  });

  it("turns 20 tomorrow (still 19 today) > 19", () => {
    expect(ageInYears("2006-07-18", NOW)).toBe(19);
  });

  it("turned 20 yesterday > 20", () => {
    expect(ageInYears("2006-07-16", NOW)).toBe(20);
  });

  it("a comfortable adult > correct age", () => {
    expect(ageInYears("1990-01-01", NOW)).toBe(36);
  });

  it("rejects an impossible date (2006-02-30) > null", () => {
    expect(ageInYears("2006-02-30", NOW)).toBeNull();
  });

  it("rejects a malformed / non-ISO string > null", () => {
    expect(ageInYears("17/07/2006", NOW)).toBeNull();
    expect(ageInYears("", NOW)).toBeNull();
    expect(ageInYears("2006-7-1", NOW)).toBeNull();
  });

  it("rejects a future date of birth > null", () => {
    expect(ageInYears("2030-01-01", NOW)).toBeNull();
  });

  it("handles a leap-day birthday", () => {
    expect(ageInYears("2004-02-29", NOW)).toBe(22);
  });
});

describe("isAtLeastYears (the 20+ gate)", () => {
  it("exactly-20-today passes", () => {
    expect(isAtLeastYears("2006-07-17", 20, NOW)).toBe(true);
  });

  it("one-day-short-of-20 fails", () => {
    expect(isAtLeastYears("2006-07-18", 20, NOW)).toBe(false);
  });

  it("an invalid date fails closed (never passes the gate)", () => {
    expect(isAtLeastYears("2006-02-30", 20, NOW)).toBe(false);
    expect(isAtLeastYears("garbage", 20, NOW)).toBe(false);
  });
});
