/**
 * Typing a new password or PIN twice before it is saved (owner, 2026-08-25).
 *
 * WHY THIS ONE FIELD AND NOT OTHERS: every other mistake on the profile can be read back off the
 * screen and corrected. A password can only be read back by someone who is still signed in — and a
 * typo'd password is exactly the thing that stops you being signed in. The second box costs one
 * moment and removes the only lockout the app can inflict on itself.
 *
 * It applies where a person sets their OWN secret. The owner resetting somebody else's gets a
 * generated value they can see, so there is nothing to mistype and no second box.
 */

/** Nothing was typed in the box at all — whitespace does not count as an answer. */
const blank = (v: string) => v.trim() === "";

export function confirmationProblem(first: string, second: string): string | null {
  // A DIFFERENT MESSAGE from a mismatch, deliberately: "they don't match" is both wrong and
  // slightly accusing when the person simply has not reached the second box yet.
  if (blank(second)) return "พิมพ์อีกครั้งเพื่อยืนยัน";
  // Compared the way the value will be STORED, not the way it was typed. The password is saved
  // trimmed, so a stray trailing space is not a mismatch — rejecting a pair that would save
  // identically is a wrong answer whose cause is invisible on screen.
  if (first.trim() !== second.trim()) return "ทั้งสองช่องไม่ตรงกัน";
  return null;
}
