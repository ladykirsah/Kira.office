/**
 * Days off — the three ways a shift can be missed, and how a month's worth of them reads.
 *
 * The shop pays **by the day** (`users.day_rate_satang`), so a day not worked is a day not paid,
 * whatever the reason. That is why there is no leave TYPE here: the owner removed it (5 Aug 2026)
 * because it could never change the wage, and the free-text reason says more than a dropdown could.
 *
 * What DOES vary is how much of the day went, and payroll already speaks in halves — `workingHalves`
 * subtracts `staff_days_off.halves` from the month. So the three modes are simply three values of
 * that same number, and **เข้าสาย is zero**: the person turned up and worked, so the wage is
 * untouched and the row exists only so a pattern of lateness is visible. Encoding it this way means
 * adding it changed no wage arithmetic at all, and needed no migration — `halves` was never
 * constrained to 1 or 2 in the schema, only in the API's validation.
 */

import { bangkokDayStart } from "./insights";

export interface LeaveMode {
  /** Halves of a day lost — the number payroll subtracts. */
  halves: LeaveHalves;
  th: string;
  en: string;
}

export type LeaveHalves = 0 | 1 | 2;

/** Heaviest first, so the dropdown opens on the common case and lateness sits last. */
export const LEAVE_MODES: readonly LeaveMode[] = [
  { halves: 2, th: "เต็มวัน", en: "Full day" },
  { halves: 1, th: "ครึ่งวัน", en: "Half day" },
  { halves: 0, th: "เข้าสาย", en: "Late" },
];

/**
 * Is this a leave mode the shop offers?
 *
 * Worth being strict about: `halves` goes straight into the salary calculation, so a 4 arriving from
 * a hand-rolled request would silently wipe two days of somebody's wage. The endpoint is
 * authenticated but that is not the same as trusted.
 */
export function isLeaveHalves(value: unknown): value is LeaveHalves {
  return value === 0 || value === 1 || value === 2;
}

export function leaveModeLabel(halves: LeaveHalves): string {
  return LEAVE_MODES.find((m) => m.halves === halves)?.th ?? "";
}

/**
 * Halves as the shop says them: "2 วันครึ่ง", "ครึ่งวัน", "3 วัน".
 *
 * Returns an empty string for zero rather than "0 วัน" — nothing taken is a different statement from
 * a measured zero, and the caller has a better sentence for it.
 */
export function daysOffLabel(halves: number): string {
  if (halves <= 0) return "";
  const days = Math.floor(halves / 2);
  const half = halves % 2 === 1;
  if (days === 0) return "ครึ่งวัน";
  return half ? `${days} วันครึ่ง` : `${days} วัน`;
}

export interface DayOffSummary {
  /** Halves that cost pay. Lateness is NOT in here. */
  offHalves: number;
  /** How many times the person arrived late — counted, never priced. */
  lateCount: number;
  /** The one line both screens print, so they can never word it differently. */
  label: string;
}

/**
 * A month of rows as one sentence.
 *
 * Lateness is deliberately kept out of `offHalves` and reported as its own count. Adding a
 * zero-cost row into the same total would still be arithmetically zero, but it would invite the
 * next reader to treat the two as one thing — and a month with three late mornings and no leave
 * must never read as time taken off.
 */
export function summariseDaysOff(rows: readonly { halves: number }[]): DayOffSummary {
  const offHalves = rows.reduce((n, r) => n + Math.max(0, r.halves), 0);
  const lateCount = rows.filter((r) => r.halves === 0).length;
  const off = daysOffLabel(offHalves);
  const late = lateCount > 0 ? ` · เข้าสาย ${lateCount} ครั้ง` : "";
  return {
    offHalves,
    lateCount,
    label: `${off ? `หยุดไปแล้ว ${off}` : "ยังไม่มีวันหยุด"}${late}`,
  };
}

/**
 * The Bangkok calendar month ("2026-08") an instant falls in.
 *
 * Both day-off lists default to "this month", and the API deciding that runs on a Worker whose clock
 * is UTC. At 01:00 Bangkok on the 1st, UTC is still 18:00 on the last day of the previous month — so
 * a naive `getMonth()` would open the page on the OLD month and the morning's first submissions
 * would appear to have vanished.
 *
 * Built on `bangkokDayStart` rather than a second copy of the +07:00 offset: one definition of where
 * the Bangkok day begins, so the two can never drift apart.
 */
export function bangkokMonth(ms: number): string {
  const d = new Date(bangkokDayStart(ms) + 7 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
