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

export interface VariantMovement {
  productVariantId: string;
  quantityDelta: number;
}

export interface AppliedMovement extends VariantMovement {
  quantityAfter: number;
}

export interface ApplyMovementsResult {
  /** Available stock per variant after all movements. */
  available: Record<string, number>;
  /** Ledger entries to persist, in input order. */
  entries: AppliedMovement[];
}

/**
 * Apply an ordered list of variant movements (e.g. one sale's lines) against a starting
 * available-stock map. Movements accumulate as deltas; a missing variant starts at 0. Throws if any
 * movement would drive a variant negative, unless an owner override is set. Single-writer logic for
 * the stock-ledger Durable Object.
 */
export function applyMovements(
  available: Readonly<Record<string, number>>,
  movements: VariantMovement[],
  options: ApplyMovementOptions = {},
): ApplyMovementsResult {
  const next: Record<string, number> = { ...available };
  const entries: AppliedMovement[] = [];
  for (const movement of movements) {
    const current = next[movement.productVariantId] ?? 0;
    const quantityAfter = applyMovement(current, movement.quantityDelta, options);
    next[movement.productVariantId] = quantityAfter;
    entries.push({
      productVariantId: movement.productVariantId,
      quantityDelta: movement.quantityDelta,
      quantityAfter,
    });
  }
  return { available: next, entries };
}

export interface StockConflict extends VariantMovement {
  /** Available stock before this movement was attempted. */
  available: number;
  kind: "oversell";
}

export interface ApplyMovementsSafeResult {
  available: Record<string, number>;
  entries: AppliedMovement[];
  /** Movements that were skipped because they would oversell — surfaced for review, not thrown. */
  conflicts: StockConflict[];
}

/**
 * Like `applyMovements`, but instead of throwing on oversell it **skips** the offending movement and
 * records a conflict. The offline-sync Durable Object uses this to apply the safe lines and flag the
 * rest for review (REQUIREMENTS O5 / conflict surfacing) rather than aborting the whole batch.
 */
export function applyMovementsSafe(
  available: Readonly<Record<string, number>>,
  movements: VariantMovement[],
  options: ApplyMovementOptions = {},
): ApplyMovementsSafeResult {
  const next: Record<string, number> = { ...available };
  const entries: AppliedMovement[] = [];
  const conflicts: StockConflict[] = [];
  for (const movement of movements) {
    const current = next[movement.productVariantId] ?? 0;
    const after = current + movement.quantityDelta;
    if (after < 0 && !options.allowNegative) {
      conflicts.push({
        productVariantId: movement.productVariantId,
        quantityDelta: movement.quantityDelta,
        available: current,
        kind: "oversell",
      });
      continue;
    }
    next[movement.productVariantId] = after;
    entries.push({
      productVariantId: movement.productVariantId,
      quantityDelta: movement.quantityDelta,
      quantityAfter: after,
    });
  }
  return { available: next, entries, conflicts };
}

export interface StockState {
  onHand: number;
  reserved: number;
}

/** Available = on hand − reserved. */
export function availableOf(state: StockState): number {
  return state.onHand - state.reserved;
}

/** Reserve units for a pending order. Blocks if available would go negative (unless overridden). */
export function reserve(
  state: StockState,
  qty: number,
  options: ApplyMovementOptions = {},
): StockState {
  const reserved = state.reserved + qty;
  if (state.onHand - reserved < 0 && !options.allowNegative) {
    throw new Error("cannot reserve more than available stock without owner override");
  }
  return { onHand: state.onHand, reserved };
}

/** Release a prior reservation (e.g. order cancelled), never below 0 reserved. */
export function release(state: StockState, qty: number): StockState {
  return { onHand: state.onHand, reserved: Math.max(0, state.reserved - qty) };
}

/** Fulfill a reservation on sale completion: reduce both on hand and reserved. */
export function fulfillReservation(state: StockState, qty: number): StockState {
  return { onHand: state.onHand - qty, reserved: Math.max(0, state.reserved - qty) };
}
