import {
  isOrderStatus,
  isPaymentStatus,
  type OrderStatus,
  type PaymentStatus,
} from "./orderStatus";

/**
 * Bridge for the migration-0069 window: read a status that might still be stored in Thai.
 *
 * The code that reads statuses and the migration that rewrites them cannot land at the same instant.
 * A deploy that beats the migration would face Thai; a migration that beats the deploy would face
 * English. Rather than sequence the two perfectly, every reader normalizes first and accepts both —
 * which makes the deploy order irrelevant.
 *
 * This matters more than cosmetically on the storefront: the slip-upload block is gated on payment
 * status, so reading it wrong removes the only way an unpaid customer can send us a transfer slip.
 *
 * Once 0069 has run everywhere and no Thai remains in the column, both maps can be deleted.
 */

/** Legacy Thai order_status values → the English constant. Superset of what 0069 rewrites. */
export const LEGACY_ORDER_STATUS_TH: Record<string, OrderStatus> = {
  ใหม่: "new",
  ยืนยันแล้ว: "confirmed",
  เตรียมจัดส่ง: "packing",
  กำลังจัดส่ง: "shipped",
  สำเร็จ: "delivered",
  ยกเลิก: "cancelled",
  หมดอายุ: "expired",
  // The admin's Sales tab offers คืนเงิน as an ORDER status even though core treats it as a payment
  // label. 0069 folds it into cancelled + payment 'refunded', so a reader resolves it to cancelled.
  คืนเงิน: "cancelled",
  คืนสินค้า: "delivery_failed",
  จัดส่งไม่สำเร็จ: "delivery_failed",
  ตีกลับ: "delivery_failed",
};

/** Legacy Thai payment_status values → the English constant. */
export const LEGACY_PAYMENT_STATUS_TH: Record<string, PaymentStatus> = {
  รอชำระเงิน: "pending",
  ยังไม่ชำระเงิน: "pending",
  กำลังตรวจสอบ: "verifying",
  ชำระแล้ว: "paid",
  เก็บเงินปลายทาง: "cod",
  "COD อนุมัติ": "cod_confirmed",
  เก็บเงินแล้ว: "cod_collected",
  "COD ปฏิเสธ": "cod_denied",
  หมดอายุ: "expired",
  คืนเงิน: "refunded",
};

/**
 * An order_status as the English constant, whichever language it is stored in. Null when the value is
 * absent or belongs to neither vocabulary — the admin's free-text override can write anything, and a
 * wrong guess is worse than admitting we cannot classify it.
 */
export function normalizeOrderStatus(raw: string | null | undefined): OrderStatus | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (isOrderStatus(s)) return s;
  return LEGACY_ORDER_STATUS_TH[s] ?? null;
}

/** A payment_status as the English constant, whichever language it is stored in. */
export function normalizePaymentStatus(raw: string | null | undefined): PaymentStatus | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (isPaymentStatus(s)) return s;
  return LEGACY_PAYMENT_STATUS_TH[s] ?? null;
}
