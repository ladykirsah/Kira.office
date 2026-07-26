/**
 * Pure planning for the "on hold" stock bucket. Holds are recorded as ledger movements so that the
 * existing (unfiltered) `SUM(quantity_delta)` availability queries automatically exclude held stock:
 * a **take-away** is a `hold` entry with a NEGATIVE delta (sellable ↓, held ↑) and a **bring-back**
 * is an `unhold` entry with a POSITIVE delta (sellable ↑, held ↓). This function decides the deltas
 * and guards the two invariants — you cannot hold more than is sellable, nor bring back more than is
 * currently held — evaluated against the state at submit time. The Durable Object applies the result
 * under its serialization lock; this logic stays pure and testable.
 */

export interface HoldPlan {
  ok: boolean;
  /** Human-readable reason when ok is false; null when ok. */
  error: string | null;
  /** Ledger delta for the `hold` entry (≤ 0); 0 when nothing is taken away. */
  holdDelta: number;
  /** Ledger delta for the `unhold` entry (≥ 0); 0 when nothing is brought back. */
  unholdDelta: number;
  /** Resulting sellable (SUM after the entries) — the number every availability query will read. */
  sellableAfter: number;
  /** Resulting net held. */
  heldAfter: number;
}

export interface HoldMovementInput {
  /** Current sellable = SUM(quantity_delta) for the variant. */
  sellable: number;
  /** Current net held (≥ 0). */
  held: number;
  /** Box 1 — quantity to move from sellable into hold. */
  takeAway: number;
  /** Box 2 — quantity to move from hold back into sellable. */
  bringBack: number;
}

const isCount = (n: number): boolean => Number.isInteger(n) && n >= 0;

export function planHoldMovement(input: HoldMovementInput): HoldPlan {
  const { sellable, held, takeAway, bringBack } = input;
  const fail = (error: string): HoldPlan => ({
    ok: false,
    error,
    holdDelta: 0,
    unholdDelta: 0,
    sellableAfter: sellable,
    heldAfter: held,
  });

  if (!isCount(takeAway) || !isCount(bringBack)) {
    return fail("Amounts must be whole numbers of 0 or more.");
  }
  // Guards are evaluated against the state at submit time (not sequentially), so a row can never take
  // away more sellable than exists, nor bring back more than was already held before this submit.
  if (takeAway > sellable) {
    return fail(`Only ${sellable} sellable to put on hold.`);
  }
  if (bringBack > held) {
    return fail(`Only ${held} on hold to bring back.`);
  }

  return {
    ok: true,
    error: null,
    holdDelta: takeAway > 0 ? -takeAway : 0,
    unholdDelta: bringBack > 0 ? bringBack : 0,
    sellableAfter: sellable - takeAway + bringBack,
    heldAfter: held + takeAway - bringBack,
  };
}
