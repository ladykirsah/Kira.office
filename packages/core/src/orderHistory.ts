/**
 * The closed vocabulary of order-timeline entries. `event` is derived from (before → after) rather
 * than passed in by each call site, so a caller cannot invent a label and quietly land it in a
 * customer-facing timeline.
 */
export type OrderHistoryEvent =
  | "created"
  | "paid"
  | "cod_approved"
  | "cod_denied"
  | "cod_collected"
  | "refunded"
  | "confirmed"
  | "packing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "expired"
  // Claim lifecycle. Present here so a raised claim or a mechanic verdict reads as itself on the
  // timeline instead of falling through to the generic "updated".
  | "claim_pending"
  | "claimed"
  | "claim_rejected"
  | "updated";

export const ORDER_HISTORY_EVENTS: readonly OrderHistoryEvent[] = [
  "created",
  "paid",
  "cod_approved",
  "cod_denied",
  "cod_collected",
  "refunded",
  "confirmed",
  "packing",
  "shipped",
  "delivered",
  "cancelled",
  "expired",
  "claim_pending",
  "claimed",
  "claim_rejected",
  "updated",
];

const EVENT_SET = new Set<string>(ORDER_HISTORY_EVENTS);

const EVENT_LABELS: Record<OrderHistoryEvent, string> = {
  created: "คำสั่งซื้อใหม่",
  paid: "ชำระเงินแล้ว",
  cod_approved: "อนุมัติเก็บเงินปลายทาง",
  cod_denied: "ปฏิเสธเก็บเงินปลายทาง",
  cod_collected: "เก็บเงินปลายทางแล้ว",
  refunded: "คืนเงินแล้ว",
  confirmed: "ยืนยันคำสั่งซื้อ",
  packing: "เตรียมจัดส่ง",
  shipped: "จัดส่งแล้ว",
  delivered: "ได้รับสินค้าแล้ว",
  cancelled: "ยกเลิกคำสั่งซื้อ",
  expired: "หมดเวลาชำระเงิน",
  claim_pending: "แจ้งเคลม รอตรวจสอบ",
  claimed: "ช่างอนุมัติการเคลม",
  claim_rejected: "ช่างปฏิเสธการเคลม",
  updated: "อัปเดตคำสั่งซื้อ",
};

export function isOrderHistoryEvent(v: string): v is OrderHistoryEvent {
  return EVENT_SET.has(v);
}

export function orderHistoryEventLabel(e: OrderHistoryEvent): string {
  return EVENT_LABELS[e];
}

/** Both status axes as they stood at one point in time. */
export interface OrderStatusSnapshot {
  orderStatus: string | null;
  paymentStatus: string | null;
}

/** payment_status → its event, for the values that mean something on their own. */
const PAYMENT_EVENTS: Record<string, OrderHistoryEvent> = {
  paid: "paid",
  cod_confirmed: "cod_approved",
  cod_denied: "cod_denied",
  cod_collected: "cod_collected",
  refunded: "refunded",
};

/** order_status → its event. */
const ORDER_EVENTS: Record<string, OrderHistoryEvent> = {
  confirmed: "confirmed",
  packing: "packing",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
  expired: "expired",
  claim_pending: "claim_pending",
  claimed: "claimed",
  claim_rejected: "claim_rejected",
};

/**
 * Which timeline entry a transition deserves, or null when it deserves none.
 *
 * Money wins over fulfillment when both axes move in one write: the owner is chasing payment, so a
 * combined new+pending → confirmed+paid should read as "paid", not "confirmed". Returns null when
 * neither status actually changed, which is what keeps carrier and tracking edits out of the
 * timeline.
 */
export function historyEventFor(
  before: OrderStatusSnapshot | null,
  after: OrderStatusSnapshot,
): OrderHistoryEvent | null {
  if (before === null) return "created";

  const paymentMoved = before.paymentStatus !== after.paymentStatus;
  const orderMoved = before.orderStatus !== after.orderStatus;
  if (!paymentMoved && !orderMoved) return null;

  if (paymentMoved && after.paymentStatus) {
    const ev = PAYMENT_EVENTS[after.paymentStatus];
    if (ev) return ev;
  }
  if (orderMoved && after.orderStatus) {
    const ev = ORDER_EVENTS[after.orderStatus];
    if (ev) return ev;
  }
  // Something moved, but into a state with no dedicated entry (or out of a legacy null).
  return "updated";
}
