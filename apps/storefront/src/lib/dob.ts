/**
 * Registration birthday assembly — the three วัน/เดือน/ปีพ.ศ. dropdowns → one ISO "YYYY-MM-DD".
 *
 * Extracted from OtpLogin because this value gates registration, is POSTed to both OTP routes and is
 * persisted as `date_of_birth` PII — logic that decides those things should be testable on its own.
 *
 * Thai users pick a Buddhist year (พ.ศ.); the stored date is the Christian year (พ.ศ. − 543).
 */

/** "" until all three parts are chosen — an incomplete birthday is not a wrong one. */
export function toDobIso(beYear: string, month: string, day: string): string {
  if (!beYear || !month || !day) return "";
  return `${Number(beYear) - 543}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Days in the chosen เดือน/ปีพ.ศ., so the วัน dropdown cannot offer 31 ก.พ. at all.
 * Falls back to 31 until both are chosen — never hide days we can't yet rule out.
 */
export function daysInBeMonth(beYear: string, month: string): number {
  if (!beYear || !month) return 31;
  // Day 0 of the NEXT month is the last day of this one — leap years fall out for free.
  return new Date(Date.UTC(Number(beYear) - 543, Number(month), 0)).getUTCDate();
}
