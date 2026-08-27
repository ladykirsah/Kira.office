import type { Phrase } from "./lang";
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
const MOVEMENT_LABELS: Record<string, Phrase> = {
  opening_balance: { th: "ยอดยกมา", en: "Opening balance" },
  purchase_receipt: { th: "รับของเข้า", en: "Purchase receipt" },
  manual_adjustment: { th: "ปรับด้วยมือ", en: "Manual adjustment" },
  receive: { th: "รับเข้า", en: "Received" },
  write_off: { th: "ตัดออก", en: "Write-off" },
  correction: { th: "แก้ยอด", en: "Correction" },
  onsite_sale: { th: "ขายหน้าร้าน", en: "On-site sale" },
  online_sale: { th: "ขายออนไลน์", en: "Online sale" },
  refund_return: { th: "คืนเงิน / คืนของ", en: "Refund / return" },
  refund: { th: "คืนเงิน / คืนของ", en: "Refund / return" },
  damaged_lost: { th: "เสียหาย / สูญหาย", en: "Damaged / lost" },
  transfer: { th: "โอนย้าย", en: "Transfer" },
  hold: { th: "พักไว้", en: "Put on hold" },
  unhold: { th: "นำกลับจากที่พัก", en: "Brought back from hold" },
  reconciliation: { th: "กระทบยอด", en: "Reconciliation" },
};

export function movementLabel(type: string): Phrase {
  // An unknown type falls back to the raw enum in BOTH languages — a code is a code.
  return MOVEMENT_LABELS[type] ?? { th: type, en: type };
}

export type AdjustAction = "receive" | "write_off" | "correction";

/**
 * A relative movement (receive / write-off) carries a signed delta; a stocktake (correction)
 * carries the counted absolute instead, and the server derives the delta from its own read.
 */
export type AdjustPlan =
  { movementType: string; quantityDelta: number } | { movementType: string; countedOnHand: number };

/**
 * Turn a user action into a ledger movement. For receive/write_off, `amount` is a quantity (its
 * magnitude is used, so a stray minus never flips the direction). For correction, `amount` is the
 * counted on-hand and is sent as-is: the delta is the server's to compute, against a read taken in
 * the write path. Computing it here against a page-load on-hand silently writes the wrong stock
 * whenever anything moved in between — and reads back as a legitimate correction in the ledger.
 */
export function planAdjustment(action: AdjustAction, amount: number): AdjustPlan {
  if (action === "receive") return { movementType: "receive", quantityDelta: Math.abs(amount) };
  if (action === "write_off")
    return { movementType: "write_off", quantityDelta: -Math.abs(amount) };
  return { movementType: "correction", countedOnHand: amount };
}
