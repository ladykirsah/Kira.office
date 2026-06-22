export interface LedgerEntry {
  /** Signed change in available stock (+receipt, -sale, etc.). */
  quantityDelta: number;
}

export interface ApplyMovementOptions {
  /** Owner override to permit overselling (negative available stock). */
  allowNegative?: boolean;
}

/** Available stock is the sum of ledger deltas (never an overwritten number). */
export function availableFromLedger(entries: LedgerEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantityDelta, 0);
}

/** Apply a single movement, blocking negative stock unless explicitly allowed. */
export function applyMovement(
  current: number,
  delta: number,
  options: ApplyMovementOptions = {},
): number {
  const next = current + delta;
  if (next < 0 && !options.allowNegative) {
    throw new Error("negative stock not allowed without owner override");
  }
  return next;
}
