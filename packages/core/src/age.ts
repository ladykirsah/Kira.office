/**
 * Age from a date of birth — used for the AirPlus 20+ registration gate (Terms §2, CCC §19).
 * DOB is an ISO calendar date "YYYY-MM-DD"; `nowMs` is epoch ms. Computed in UTC: for a 20-year gate
 * a sub-day timezone difference at the exact birthday boundary is immaterial, and UTC keeps it pure +
 * deterministic to test. Invalid / non-real dates (e.g. 2020-02-30) return null so callers reject.
 */
export function ageInYears(dobIso: string, nowMs: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dobIso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dob = new Date(Date.UTC(y, mo - 1, d));
  // Reject impossible dates (JS rolls 2020-02-30 into March — the round-trip catches it).
  if (dob.getUTCFullYear() !== y || dob.getUTCMonth() !== mo - 1 || dob.getUTCDate() !== d) {
    return null;
  }
  const now = new Date(nowMs);
  if (dob.getTime() > now.getTime()) return null; // DOB in the future
  let age = now.getUTCFullYear() - y;
  const monthNow = now.getUTCMonth() + 1;
  const dayNow = now.getUTCDate();
  if (monthNow < mo || (monthNow === mo && dayNow < d)) age -= 1; // birthday not reached yet this year
  return age;
}

/** True when the DOB is a valid date and the person is at least `years` old as of `nowMs`. */
export function isAtLeastYears(dobIso: string, years: number, nowMs: number): boolean {
  const age = ageInYears(dobIso, nowMs);
  return age !== null && age >= years;
}
