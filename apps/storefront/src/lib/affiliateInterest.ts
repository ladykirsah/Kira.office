/**
 * Social proof for a mechanic-picks card, taken from the click count we already record on /go/:id.
 *
 * The owner asked for the real click number rather than a hand-typed "sold" figure — clicks are
 * data we actually hold, and they are the bigger, honest number. Below INTEREST_MIN the card says
 * nothing at all: "คนกดดูแล้ว 2 ครั้ง" reads as *un*popular, which is worse than silence.
 */

/** Below this many clicks a card shows no badge — too few to read as interest. */
export const INTEREST_MIN = 10;

export function interestBadge(clicks: number | undefined): string | null {
  if (!clicks || clicks < INTEREST_MIN) return null;
  return `คนกดดูแล้ว ${clicks.toLocaleString("en-US")} ครั้ง`;
}
