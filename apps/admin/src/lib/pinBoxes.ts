/**
 * The arithmetic behind the six PIN boxes on the login page.
 *
 * A PIN is one string everywhere else — in state, over the wire, in the database. These boxes need
 * POSITIONS, and the two only agree while the PIN is complete. The moment a box in the middle is
 * cleared there is a hole, and the hole has to survive: collapsing "481920" minus its third digit
 * into "48920" would silently slide 9, 2 and 0 one box to the left on screen.
 *
 * So a partial value may carry interior spaces. That is safe precisely because a value with a space
 * can never match /^\d{6}$/, which is what the form checks before it will submit.
 */

export const PIN_LENGTH = 6;

/** The value laid out as one entry per box, blank where nothing has been typed. */
export function boxDigits(value: string): string[] {
  return value
    .padEnd(PIN_LENGTH, " ")
    .slice(0, PIN_LENGTH)
    .split("")
    .map((d) => (d === " " ? "" : d));
}

/** Put one digit in one box (or clear it with ""), leaving every other box where it is. */
export function setBoxDigit(value: string, index: number, digit: string): string {
  const next = boxDigits(value).map((d, i) => (i === index ? digit : d));
  // Blanks become spaces so positions hold; only trailing ones are dropped, since nothing sits
  // after them to be pushed out of place.
  return next
    .map((d) => (d === "" ? " " : d))
    .join("")
    .trimEnd();
}

/** A pasted or autofilled code, reduced to the digits that fit. */
export function spreadPaste(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, PIN_LENGTH);
}
