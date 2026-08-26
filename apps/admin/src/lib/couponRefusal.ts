import type { Phrase } from "./lang";

/**
 * The two things the coupons screen has to say NO to, said in the reader's language.
 *
 * WHY HERE AND NOT AT THE SERVER: the API refuses both of these already, with a 409 — but its
 * message is written in English, because a request carries no opinion about who is reading it.
 * Both answers are knowable from what is already on the screen, so the refusal is decided here.
 * The 409 remains the backstop for the gap between the check and the request: another till can
 * claim a code, or redeem a coupon, in between.
 *
 * Pure functions rather than lines inside a button, so both refusals can be proved without a
 * redeemed coupon to click on.
 */

/**
 * A coupon somebody has used is financial history — the owner's rule is disable it, never delete it.
 *
 * A count that is not a positive-or-zero number is treated as "used": if the count is broken, that
 * is the worst possible moment to wave a delete through.
 */
export function deleteRefusal(redemptions: number): Phrase | null {
  if (Number.isFinite(redemptions) && redemptions === 0) return null;
  return {
    th: `คูปองนี้มีคนใช้ไปแล้ว ${redemptions} ครั้ง — ปิดใช้งานได้ แต่ลบไม่ได้`,
    en: `This coupon has ${redemptions} redemption(s) — disable it instead of deleting.`,
  };
}

/** Two coupons cannot share a code: whichever the customer typed, only one of them could apply. */
export function duplicateCodeRefusal(code: string, existing: readonly string[]): Phrase | null {
  // Compared the way a code is STORED — upper-case, trimmed. The box upper-cases as you type, but a
  // code arriving from anywhere else must not get past by being the same word in another case.
  const wanted = code.trim().toUpperCase();
  if (!existing.some((c) => c.trim().toUpperCase() === wanted)) return null;
  return { th: `โค้ด ${wanted} มีอยู่แล้ว`, en: `Coupon code ${wanted} already exists` };
}
