/**
 * Account profile rules — the customer's own name and login phone.
 *
 * Pure + shared, because the registration screen, the account screen and the two endpoints must all
 * agree on what a valid name is. They did not before: registration never asked for a name at all,
 * checkout captured whatever was typed exactly once (`WHERE name = ''`), and nothing could ever
 * change it again — which is how a customer ends up permanently called "L".
 */

/** Deliberately generous: Thai names, nicknames and shop names all live here. */
export const DISPLAY_NAME_MAX = 60;
const DISPLAY_NAME_MIN = 2;

/** Trim, and collapse runs of whitespace — "สมชาย   ใจดี" and "สมชาย ใจดี" are the same name. */
export function normalizeDisplayName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Thai error for an invalid name, or null when it is fine. ALWAYS validates the normalized value,
 * so "  L  " cannot pass a length check that "L" would fail.
 *
 * The 2-character floor is the whole point of this function: a single letter is not a name, it is
 * someone tapping past a required field — and the old flow then froze that forever.
 */
export function displayNameError(raw: string): string | null {
  const name = normalizeDisplayName(raw);
  if (name.length === 0) return "กรุณากรอกชื่อ";
  if (name.length < DISPLAY_NAME_MIN) return "ชื่อสั้นเกินไป กรุณากรอกชื่อให้ครบ";
  if (name.length > DISPLAY_NAME_MAX) return `ชื่อยาวเกิน ${DISPLAY_NAME_MAX} ตัวอักษร`;
  return null;
}

export interface PhoneChangeInput {
  /** the account's current login phone, already normalized */
  currentPhone: string;
  /** the requested new phone, already normalized */
  nextPhone: string;
  /** true when another storefront_customers row already holds nextPhone */
  taken: boolean;
}

/**
 * Thai error for a phone change, or null when it may proceed.
 *
 * This is a credential change, so the guards matter more than the ergonomics:
 *  • `taken` blocks seizing a number that belongs to someone else. The phone is not just a login —
 *    guest order tracking resolves orders by (ref, phone), so taking a number would take its orders.
 *  • Proving control of the NEW number is NOT decided here; the endpoint requires a fresh OTP that
 *    was sent to it. This function only decides whether the change is permissible at all.
 */
export function phoneChangeError(i: PhoneChangeInput): string | null {
  if (!/^\d{9,10}$/.test(i.nextPhone)) return "กรุณากรอกเบอร์โทรศัพท์ 9-10 หลัก";
  if (i.nextPhone === i.currentPhone) return "เป็นเบอร์เดิมของคุณอยู่แล้ว";
  if (i.taken) return "เบอร์นี้มีบัญชีอื่นใช้อยู่แล้ว";
  return null;
}
