import { creditScoreFromEvents, type CreditEvent } from "./customerTier";

export type OrderStatus =
  | "new"
  | "confirmed"
  | "packing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "expired"
  // Set by hand from the admin, never by an automatic transition. `delivery_failed` is a parcel that
  // came back undelivered; `returned` is the customer contacting us to send something back — wrong
  // item sent, or a claim. Both surface via operationalStatus (fail / return) on the orders page.
  // No migration needed: sales_orders.order_status is plain TEXT with no CHECK constraint.
  | "delivery_failed"
  | "returned";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "cod"
  | "cod_confirmed"
  | "cod_collected"
  | "cod_denied"
  | "expired"
  | "refunded";

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "new",
  "confirmed",
  "packing",
  "shipped",
  "delivered",
  "cancelled",
  "expired",
  "delivery_failed",
  "returned",
];

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "pending",
  "paid",
  "cod",
  "cod_confirmed",
  "cod_collected",
  "cod_denied",
  "expired",
  "refunded",
];

const ORDER_LABELS: Record<OrderStatus, string> = {
  new: "ใหม่",
  confirmed: "ยืนยันแล้ว",
  packing: "เตรียมจัดส่ง",
  shipped: "กำลังจัดส่ง",
  delivered: "สำเร็จ",
  cancelled: "ยกเลิก",
  expired: "หมดอายุ",
  delivery_failed: "จัดส่งไม่สำเร็จ",
  returned: "คืนสินค้า",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: "รอชำระเงิน",
  paid: "ชำระแล้ว",
  cod: "เก็บเงินปลายทาง",
  cod_confirmed: "COD อนุมัติ",
  cod_collected: "เก็บเงินแล้ว",
  cod_denied: "COD ปฏิเสธ",
  expired: "หมดอายุ",
  refunded: "คืนเงิน",
};

const ORDER_SET = new Set<string>(ORDER_STATUSES);
const PAYMENT_SET = new Set<string>(PAYMENT_STATUSES);

export function orderStatusLabel(s: OrderStatus): string {
  return ORDER_LABELS[s];
}

export function paymentStatusLabel(s: PaymentStatus): string {
  return PAYMENT_LABELS[s];
}

export function isOrderStatus(v: string): v is OrderStatus {
  return ORDER_SET.has(v);
}

export function isPaymentStatus(v: string): v is PaymentStatus {
  return PAYMENT_SET.has(v);
}

export function isCreditEvent(orderStatus: OrderStatus): boolean {
  return orderStatus === "delivered" || orderStatus === "expired" || orderStatus === "cancelled";
}

export function computeCreditFromOrders(
  orders: { orderStatus: string | null; paymentStatus: string | null }[],
): number {
  const events: CreditEvent[] = [];
  for (const o of orders) {
    if (!o.orderStatus || !o.paymentStatus) continue;
    if (!isOrderStatus(o.orderStatus) || !isPaymentStatus(o.paymentStatus)) continue;
    const ev = creditEventFromOrder(o.orderStatus, o.paymentStatus);
    if (ev) events.push(ev);
  }
  return creditScoreFromEvents(events);
}

export const EXPIRY_MS = 48 * 60 * 60 * 1000;

export function isOrderExpirable(
  order: { orderStatus: string; paymentStatus: string; orderCreatedAt: number },
  now: number,
): boolean {
  return (
    order.orderStatus === "new" &&
    order.paymentStatus === "pending" &&
    now - order.orderCreatedAt >= EXPIRY_MS
  );
}

export function creditEventFromOrder(
  orderStatus: OrderStatus,
  paymentStatus: PaymentStatus,
): CreditEvent | null {
  if (orderStatus === "delivered") return { type: "complete" };

  if (orderStatus === "expired") return { type: "incomplete" };

  if (orderStatus === "cancelled") {
    if (paymentStatus === "pending" || paymentStatus === "cod_denied") {
      return { type: "incomplete" };
    }
    return null;
  }

  return null;
}
