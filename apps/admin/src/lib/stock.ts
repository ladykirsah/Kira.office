/** Global low-stock threshold for Phase 1. Per-product thresholds are a later phase. */
export const LOW_STOCK_THRESHOLD = 3;

export type StockStatus = "out" | "low" | "ok";

/** Classify on-hand into out (≤0) / low (≤threshold) / ok. */
export function stockStatus(onHand: number, threshold = LOW_STOCK_THRESHOLD): StockStatus {
  if (onHand <= 0) return "out";
  if (onHand <= threshold) return "low";
  return "ok";
}

/**
 * Human label for a ledger movement_type. Tolerant of both the schema enum and the descriptive
 * sub-types the app writes (receive/write_off/correction), and maps the legacy "refund" and the
 * current "refund_return" to one label so old rows still read correctly.
 */
const MOVEMENT_LABELS: Record<string, string> = {
  opening_balance: "Opening balance",
  purchase_receipt: "Purchase receipt",
  manual_adjustment: "Manual adjustment",
  receive: "Received",
  write_off: "Write-off",
  correction: "Correction",
  onsite_sale: "On-site sale",
  online_sale: "Online sale",
  refund_return: "Refund / return",
  refund: "Refund / return",
  damaged_lost: "Damaged / lost",
  transfer: "Transfer",
  reconciliation: "Reconciliation",
};

export function movementLabel(type: string): string {
  return MOVEMENT_LABELS[type] ?? type;
}
