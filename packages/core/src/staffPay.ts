/**
 * Staff pay, quick-PIN rules and account lockout — the pure arithmetic, kept away from D1 so the
 * money can be tested exactly.
 *
 * SALARY MODEL (owner, 2026-08-03): pay = day rate × working days, where working days are the
 * month's calendar days minus the days the person recorded off. Nothing is added and nothing is
 * deducted — no overtime, no bonus, no social security. Paid on the 5th of the following month.
 *
 *   ฿400/day · July (31 days) · 2 days off  →  29 × ฿400 = ฿11,600
 *
 * Everything counts in HALVES rather than days, because a half day off is allowed and floating
 * point has no business anywhere near a wage. 29.5 days is 59 halves; the only division happens
 * once, at the end, and is rounded to whole satang.
 */

/** Days in a 'YYYY-MM' period, leap years included. */
export function daysInMonth(period: string): number {
  const [year, month] = period.split("-").map(Number);
  // Day 0 of the NEXT month is the last day of this one — the standard trick, and leap-safe.
  return new Date(Date.UTC(year!, month!, 0)).getUTCDate();
}

/**
 * When a month's wage is handed over: the **5th of the month after it** (owner, 2026-08-25).
 *
 * A fixed rule, not a record of what happened — August's row reads 5 September whether the money
 * actually moved on the 5th, the 8th, or not yet at all. The owner was asked directly and chose the
 * rule over the real date: payday is a promise the shop makes, and a date that shifts when you are
 * late reads as though the promise moved with it. What DID happen is on the row's status and its
 * slip.
 *
 * Returns null for anything that is not a real 'YYYY-MM', because a wage date guessed from
 * nonsense is worse than no date at all.
 */
export function salaryDueDate(period: string): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return null;
  const [year, month] = period.split("-").map(Number);
  // December rolls into January of the next year, which is why this counts rather than adding one.
  const next = new Date(Date.UTC(year!, month!, 5));
  return next.toISOString().slice(0, 10);
}

/** Halves actually worked: the month, less time recorded off, never below zero. */
export function workingHalves(days: number, offHalves: number): number {
  return Math.max(0, days * 2 - offHalves);
}

export function payForMonth(input: { dayRateSatang: number; period: string; offHalves: number }): {
  daysInMonth: number;
  workingHalves: number;
  amountSatang: number;
} {
  const days = daysInMonth(input.period);
  const halves = workingHalves(days, input.offHalves);
  // One division, at the end: a half day at an odd rate would otherwise leave a fraction of a
  // satang, which is not a thing that exists.
  const amountSatang = Math.round((input.dayRateSatang * halves) / 2);
  return { daysInMonth: days, workingHalves: halves, amountSatang };
}

/* ── Quick-login PIN ─────────────────────────────────────────────────────────────────────────────
 * The PIN is typed ALONE — no email — so it identifies the person as well as letting them in.
 * That makes a guessable PIN the entire lock, which is why the obvious ones are refused outright.
 */

const BANNED_PINS = new Set([
  "000000",
  "111111",
  "222222",
  "333333",
  "444444",
  "555555",
  "666666",
  "777777",
  "888888",
  "999999",
  "123456",
  "654321",
  "012345",
  "543210",
  "121212",
  "112233",
]);

export function pinProblem(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return "The PIN must be exactly 6 digits.";
  if (BANNED_PINS.has(pin)) return "That PIN is too easy to guess. Choose another.";
  return null;
}

/* ── Lockout ─────────────────────────────────────────────────────────────────────────────────────
 * Owner's rule: three failed sign-ins IN A ROW — PIN and password counted together — lock the
 * account for a full day.
 *
 * "In a row" is a run, not a lifetime tally (owner, 2026-08-03). A miss older than the window below
 * is forgotten, so one typo today, one next week and one the week after do NOT add up to a lockout;
 * three inside a quarter of an hour — which is what an actual guessing attempt looks like — do.
 *
 * The lock itself cannot be waited out by anyone but the clock. It IS cleared when the super admin
 * sets a new password, because the credential the person was failing against no longer exists.
 */

export const LOCK_AFTER_FAILURES = 3;
export const LOCK_DURATION_MS = 24 * 60 * 60 * 1000;
/** How long one failure keeps counting towards the next. */
export const FAILURE_WINDOW_MS = 15 * 60 * 1000;

export interface LockState {
  failedAttempts: number;
  lockedUntil: number | null;
  /** When the last failure happened — what makes "in a row" mean a run rather than a total. */
  lastFailedAt: number | null;
}

/** The state after one more failure. The third one inside the window sets the 24-hour clock. */
export function nextLockState(state: LockState, now: number): LockState {
  const continuesRun = state.lastFailedAt !== null && now - state.lastFailedAt <= FAILURE_WINDOW_MS;
  const failedAttempts = continuesRun ? state.failedAttempts + 1 : 1;
  return {
    failedAttempts,
    lockedUntil: failedAttempts >= LOCK_AFTER_FAILURES ? now + LOCK_DURATION_MS : null,
    lastFailedAt: now,
  };
}

/** Locked until the moment passes — at `lockedUntil` exactly, the account is open again. */
export function isLocked(state: LockState, now: number): boolean {
  return state.lockedUntil !== null && now < state.lockedUntil;
}

/**
 * Whose account may be locked out after three failed sign-ins. EVERYONE (owner, 25 Aug 2026).
 *
 * Admins and super admins were exempt from 9 Aug 2026, on two supports that have both since gone:
 *
 *  1. **"The lock's only recovery is 'ask a super admin'"** — nobody, when the locked-out person IS
 *     the super admin. There is now `/recover`: Cloudflare Access covers that one address, proves
 *     the owner by a code to their mailbox, and signs them back in without needing another person.
 *     A lock is no longer a wall the owner cannot climb.
 *  2. **"Cloudflare Access already stands in front of the admin"** — so reaching the login form at
 *     all meant passing a one-time code, and the lock was a second fence behind a locked gate. The
 *     owner has now made the Kira.office form the everyday door. The gate is coming off. The fence
 *     is the whole defence, and an account that can NEVER be locked, behind a six-digit PIN, is a
 *     million guesses that nothing counts.
 *
 * So the exemption is withdrawn, in the same change that makes it safe to withdraw. Mechanics were
 * never exempt: theirs is a PIN typed at a shared counter machine — the one credential somebody
 * could realistically stand and guess — and an admin is right there to clear it.
 *
 * An unrecognised role KEEPS the lock: a role added later should inherit the protection, not lose it
 * by being unlisted. That is now the only rule there is.
 */
export function roleCanBeLocked(_role: string | null | undefined): boolean {
  return true;
}

/* ── Wage-slip retention ──────────────────────────────────────────────────────────────────────
 *
 * A transfer slip is proof that a wage was paid, and it carries bank details for both sides. It is
 * worth keeping while a question about that payment is still live, and not worth keeping after —
 * so the image is deleted three months on while the payslip record itself stays forever (owner,
 * 2026-08-04).
 *
 * Three CALENDAR months, not ninety days: "kept for 3 months" is a promise about the calendar, and
 * a quarter that happens to hold 92 days must not expire two days early.
 */
export const SLIP_RETENTION_MONTHS = 3;

/** The moment a slip image stops being kept. Time of day is preserved. */
export function slipExpiresAt(paidAtMs: number): number {
  const paid = new Date(paidAtMs);
  const target = new Date(
    Date.UTC(paid.getUTCFullYear(), paid.getUTCMonth() + SLIP_RETENTION_MONTHS, 1),
  );
  // The target month may be shorter than the month paid in — 30 November + 3 gives 30 February,
  // which does not exist. Land on the last real day instead of rolling into March.
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(paid.getUTCDate(), lastDay));
  target.setUTCHours(
    paid.getUTCHours(),
    paid.getUTCMinutes(),
    paid.getUTCSeconds(),
    paid.getUTCMilliseconds(),
  );
  return target.getTime();
}

/** True once the image should be gone. At the expiry moment exactly, it is due for deletion. */
export function slipIsExpired(paidAtMs: number, now: number): boolean {
  return now >= slipExpiresAt(paidAtMs);
}
