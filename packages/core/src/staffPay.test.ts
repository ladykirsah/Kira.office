import { describe, it, expect } from "vitest";
import {
  daysInMonth,
  workingHalves,
  payForMonth,
  pinProblem,
  LOCK_AFTER_FAILURES,
  LOCK_DURATION_MS,
  FAILURE_WINDOW_MS,
  nextLockState,
  isLocked,
  slipExpiresAt,
  slipIsExpired,
  SLIP_RETENTION_MONTHS,
  roleCanBeLocked,
} from "./staffPay";

describe("daysInMonth", () => {
  it("knows the length of a real month", () => {
    expect(daysInMonth("2026-07")).toBe(31);
    expect(daysInMonth("2026-06")).toBe(30);
    expect(daysInMonth("2026-02")).toBe(28);
  });

  it("handles a leap February", () => {
    expect(daysInMonth("2028-02")).toBe(29);
  });
});

describe("workingHalves", () => {
  it("a month with nothing recorded is fully worked", () => {
    expect(workingHalves(31, 0)).toBe(62); // 31 days x 2 halves
  });

  it("subtracts recorded time off", () => {
    expect(workingHalves(31, 4)).toBe(58); // two full days off
    expect(workingHalves(31, 1)).toBe(61); // one half day
  });

  it("never goes negative, however much time is recorded", () => {
    expect(workingHalves(30, 999)).toBe(0);
  });
});

describe("payForMonth", () => {
  it("the owner's own example: ฿400/day, 31-day July, 2 days off > ฿11,600", () => {
    const out = payForMonth({ dayRateSatang: 40_000, period: "2026-07", offHalves: 4 });
    expect(out.daysInMonth).toBe(31);
    expect(out.workingHalves).toBe(58); // 29 days
    expect(out.amountSatang).toBe(1_160_000); // ฿11,600
  });

  it("a half day is worth half a day's pay", () => {
    const out = payForMonth({ dayRateSatang: 40_000, period: "2026-07", offHalves: 3 });
    expect(out.workingHalves).toBe(59); // 29.5 days
    expect(out.amountSatang).toBe(1_180_000); // ฿11,800
  });

  it("a full month with no days off pays the whole month", () => {
    const out = payForMonth({ dayRateSatang: 50_000, period: "2026-06", offHalves: 0 });
    expect(out.amountSatang).toBe(30 * 50_000);
  });

  it("an odd day rate on a half day rounds to whole satang, never a fraction", () => {
    // ฿333.33/day = 33_333 satang; half of that is 16_666.5 — money must not carry a fraction.
    const out = payForMonth({ dayRateSatang: 33_333, period: "2026-07", offHalves: 1 });
    expect(Number.isInteger(out.amountSatang)).toBe(true);
    expect(out.amountSatang).toBe(Math.round(33_333 * 30.5));
  });

  it("someone off the whole month is paid nothing, not a negative", () => {
    const out = payForMonth({ dayRateSatang: 40_000, period: "2026-07", offHalves: 200 });
    expect(out.amountSatang).toBe(0);
  });
});

describe("pinProblem", () => {
  it("accepts six digits", () => {
    expect(pinProblem("481920")).toBeNull();
  });

  it("insists on exactly six digits", () => {
    expect(pinProblem("12345")).not.toBeNull();
    expect(pinProblem("1234567")).not.toBeNull();
    expect(pinProblem("")).not.toBeNull();
    expect(pinProblem("12a456")).not.toBeNull();
    expect(pinProblem("  1234")).not.toBeNull();
  });

  it("refuses the PINs everybody picks", () => {
    // A PIN is entered alone, with no email — a guessable one is the whole lock.
    expect(pinProblem("000000")).not.toBeNull();
    expect(pinProblem("111111")).not.toBeNull();
    expect(pinProblem("123456")).not.toBeNull();
    expect(pinProblem("654321")).not.toBeNull();
  });
});

describe("lockout (3 in a row within 15 minutes, 24 hours)", () => {
  const NOW = 1_800_000_000_000;
  const recent = (n: number, at: number) => ({
    failedAttempts: n,
    lockedUntil: null,
    lastFailedAt: at,
  });

  it("counts failures up to the limit", () => {
    expect(
      nextLockState({ failedAttempts: 0, lockedUntil: null, lastFailedAt: null }, NOW),
    ).toEqual({ failedAttempts: 1, lockedUntil: null, lastFailedAt: NOW });
    expect(nextLockState(recent(1, NOW - 1000), NOW)).toEqual({
      failedAttempts: 2,
      lockedUntil: null,
      lastFailedAt: NOW,
    });
  });

  it("locks for a full day on the third failure", () => {
    const state = nextLockState(recent(LOCK_AFTER_FAILURES - 1, NOW - 60_000), NOW);
    expect(state.failedAttempts).toBe(LOCK_AFTER_FAILURES);
    expect(state.lockedUntil).toBe(NOW + LOCK_DURATION_MS);
    expect(LOCK_DURATION_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("three in a row means IN A ROW — old misses age out (owner, 2026-08-03)", () => {
    // One typo today, one next week, one the week after must NOT lock anybody.
    const stale = FAILURE_WINDOW_MS + 1;
    const first = nextLockState({ failedAttempts: 0, lockedUntil: null, lastFailedAt: null }, NOW);
    expect(first.failedAttempts).toBe(1);
    const second = nextLockState({ ...first }, NOW + stale);
    expect(second.failedAttempts).toBe(1); // restarted, not 2
    const third = nextLockState({ ...second }, NOW + stale * 2);
    expect(third.failedAttempts).toBe(1);
    expect(third.lockedUntil).toBeNull();
  });

  it("but three inside the window still locks", () => {
    let s = nextLockState({ failedAttempts: 0, lockedUntil: null, lastFailedAt: null }, NOW);
    s = nextLockState(s, NOW + 60_000);
    s = nextLockState(s, NOW + 120_000);
    expect(s.failedAttempts).toBe(3);
    expect(s.lockedUntil).toBe(NOW + 120_000 + LOCK_DURATION_MS);
  });

  it("the window is a quarter of an hour", () => {
    expect(FAILURE_WINDOW_MS).toBe(15 * 60 * 1000);
  });

  it("a locked account stays locked until the day is up", () => {
    const until = NOW + LOCK_DURATION_MS;
    const s = { failedAttempts: 3, lockedUntil: until, lastFailedAt: NOW };
    expect(isLocked(s, NOW)).toBe(true);
    expect(isLocked(s, until - 1)).toBe(true);
    expect(isLocked(s, until)).toBe(false);
    expect(isLocked(s, until + 1)).toBe(false);
  });

  it("an account that has never failed is not locked", () => {
    expect(isLocked({ failedAttempts: 0, lockedUntil: null, lastFailedAt: null }, NOW)).toBe(false);
  });
});

describe("wage-slip retention", () => {
  const utc = (y: number, m: number, d: number, h = 9) => Date.UTC(y, m - 1, d, h);

  it("given a slip paid on 4 August > then it survives until 4 November", () => {
    expect(slipExpiresAt(utc(2026, 8, 4))).toBe(utc(2026, 11, 4));
  });

  it("given a payment on the 30th > when the third month is shorter > then it clamps to its last day", () => {
    // 30 Nov + 3 months would be 30 February. February has no 30th; the slip goes on the 28th.
    expect(slipExpiresAt(utc(2026, 11, 30))).toBe(utc(2027, 2, 28));
  });

  it("given the expiry moment exactly > then the slip is expired", () => {
    const paidAt = utc(2026, 8, 4);
    expect(slipIsExpired(paidAt, slipExpiresAt(paidAt) - 1)).toBe(false);
    expect(slipIsExpired(paidAt, slipExpiresAt(paidAt))).toBe(true);
  });

  it("keeps three months, not ninety days", () => {
    // A 92-day quarter (Aug+Sep+Oct) must not expire early just because the days don't divide.
    expect(SLIP_RETENTION_MONTHS).toBe(3);
    expect(slipIsExpired(utc(2026, 8, 4), utc(2026, 11, 3))).toBe(false);
  });
});

describe("lockable roles", () => {
  it("given a mechanic > then the 3-strike lock still applies", () => {
    // The counter staff sign in at a shared machine with a 6-digit PIN, which is the one credential
    // in this system a person could realistically sit and guess. The lock is what makes that futile.
    expect(roleCanBeLocked("mechanic")).toBe(true);
  });

  it("given an admin or super admin > then they are never locked out (owner, 9 Aug 2026)", () => {
    // A locked-out admin has no way back in — the recovery for a lock is "ask a super admin", and
    // when the super admin is the locked one that is nobody. A 24-hour wall in front of the person
    // who runs the shop costs more than the brute-force protection is worth HERE, because
    // Cloudflare Access already stands in front of the admin: reaching this login form at all
    // requires passing an email one-time code first.
    expect(roleCanBeLocked("admin")).toBe(false);
    expect(roleCanBeLocked("super_admin")).toBe(false);
  });

  it("given an unknown role > then it CAN be locked", () => {
    // Fail safe: a role this doesn't recognise keeps the protection rather than losing it.
    expect(roleCanBeLocked("something_new")).toBe(true);
    expect(roleCanBeLocked(null)).toBe(true);
  });
});
