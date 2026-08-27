/**
 * Which door a sign-in failure came from, so that it is answered where it happened.
 *
 * THE BUG THIS EXISTS FOR (owner, 27 Aug 2026). The sign-in card holds two separate ways in — the
 * everyday form in the middle, and the emergency key in its own section under a rule at the bottom.
 * Both wrote into ONE error slot, the everyday form's. So "กุญแจนี้เปิดไม่ได้" — a verdict on a
 * KEY — appeared halfway up the card, above the everyday Sign in button, with the password field
 * pointing at it as its description. The owner read a complaint about a key while looking at a
 * password box, and the section that actually refused them said nothing at all.
 *
 * An error therefore carries the door it came from, and each door shows only its own.
 */

/** `form` is the everyday card — the PIN, the email/password, and the doors beside them. */
export type LoginDoor = "form" | "key";

export interface LoginError {
  door: LoginDoor;
  text: string;
}

/** The message this door should be showing — null when the failure belongs to the other one. */
export function errorFor(door: LoginDoor, error: LoginError | null): string | null {
  return error && error.door === door ? error.text : null;
}
