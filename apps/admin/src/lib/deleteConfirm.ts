/** The word a person types to arm a destructive action. Compared case-insensitively. */
export const DELETE_WORD = "DELETE";

/**
 * Has someone typed the confirmation word, and only that word?
 *
 * Deleting a product is a one-way door: it archives the row, every list filters archived rows out,
 * and no screen brings it back. The typing step exists so the action cannot happen by reflex.
 *
 * Case and surrounding whitespace are forgiven — someone who typed "delete" meant it exactly as
 * much as someone who typed "DELETE", and refusing them reads as a broken button. Anything with
 * other words in it is refused: that is no longer a deliberate single gesture.
 */
export function isDeleteConfirmed(typed: string): boolean {
  return typed.trim().toUpperCase() === DELETE_WORD;
}
