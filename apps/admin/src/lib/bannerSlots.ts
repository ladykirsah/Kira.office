/**
 * Rules for the two home-page banner slots.
 *
 * The slots are NOT interchangeable: the hero carousel rotates a small set of full-width slides,
 * while the promo strip is a single wide band. They have different frames, so the admin gives each
 * its own setup rather than one shared form with a slot dropdown.
 */

export type BannerSlot = "hero" | "promo";

/**
 * How many banners a slot accepts. `null` = no cap.
 *
 * The hero carousel is capped at 3 (owner's call): slides past the third are rarely seen, and a
 * carousel a visitor has to sit through is worse than no carousel.
 */
export const SLOT_LIMIT: Record<BannerSlot, number | null> = {
  hero: 3,
  promo: null,
};

/**
 * Whether a slot is at capacity.
 *
 * Compares with `>=`, not `===` — two tabs adding at once can push the stored count past the cap,
 * and once over, the form must stay closed rather than springing back open.
 */
export function slotIsFull(slot: BannerSlot, count: number): boolean {
  const limit = SLOT_LIMIT[slot];
  return limit !== null && count >= limit;
}

/** "2 / 3" for a capped slot, plain "2" for an uncapped one. */
export function slotCountLabel(slot: BannerSlot, count: number): string {
  const limit = SLOT_LIMIT[slot];
  return limit === null ? String(count) : `${count} / ${limit}`;
}

/**
 * The scheduling window a banner should be saved with.
 *
 * "Live time" OFF means BOTH bounds are null — the banner runs until the owner changes it. That is
 * deliberately not a far-future end date: a real date would silently expire the banner one day,
 * which is exactly the surprise the toggle exists to avoid.
 */
export function liveWindow(
  liveTimeOn: boolean,
  startsInput: string,
  endsInput: string,
): { startsAt: number | null; endsAt: number | null } {
  if (!liveTimeOn) return { startsAt: null, endsAt: null };
  const toMs = (v: string): number | null => (v ? new Date(v).getTime() : null);
  return { startsAt: toMs(startsInput), endsAt: toMs(endsInput) };
}
