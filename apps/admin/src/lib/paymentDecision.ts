/**
 * May this viewer decide a payment right now?
 *
 * TWO CONDITIONS, and the second one is the owner's (27 Aug 2026): the role must allow it, AND a
 * slip must actually be attached. Confirm and Reject used to appear the moment an order reached
 * "verifying" — so on an order with nothing attached the page offered to approve a payment for
 * which there was no evidence at all, and approving sends the order forward into packing.
 *
 * Deliberately NOT tied to whether this viewer can SEE the slip image. That is a separate,
 * narrower gate: viewing is super-admin only because a slip carries bank details, while the
 * decision is open to any admin. Folding the two together would quietly take the decision away
 * from the people who are meant to make it.
 */
export function canDecidePayment(canAct: boolean, slipImageKey: string | null): boolean {
  return canAct && (slipImageKey ?? "").trim() !== "";
}
