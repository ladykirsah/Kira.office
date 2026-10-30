import { EXPIRY_MS } from "./orderStatus";

/**
 * The shop cancelling an AirPlus order (owner, 30 Oct 2026). Pure rules only — the API does the
 * writing (status, stock back, coupon back, timeline) in one step.
 *
 * - Only an order that has not been sent. After drop-off it is a return or a claim, not a cancel.
 * - A slip still waiting to be checked is checked first, so we never cancel money we have not seen.
 * - The reason decides the customer's credit: "ลูกค้าขอยกเลิก" counts against them, the shop's own
 *   reasons do not (see creditEventFromOrder).
 */

export type CancelReason = "customer_request" | "out_of_stock" | "other";

/** Why an order cannot be cancelled. `null` from cancelBlock means it can. */
export type CancelBlock = "already_sent" | "already_closed" | "check_slip_first";

/** What the storefront does with a slip on this order. */
export type SlipAfterCancel = "not_cancelled" | "take_slip" | "contact_line";

export const CANCEL_REASONS: readonly CancelReason[] = [
  "customer_request",
  "out_of_stock",
  "other",
];

/** The statuses a cancel may leave — also the guard on the API's single UPDATE, so a race with the
 *  drop-off form loses cleanly instead of cancelling a parcel already handed to the carrier. */
export const CANCELLABLE_ORDER_STATUSES: readonly string[] = ["new", "confirmed", "packing"];

const CLOSED = new Set(["cancelled", "expired"]);
const REASON_SET = new Set<string>(CANCEL_REASONS);
const LABELS: Record<CancelReason, string> = {
  customer_request: "ลูกค้าขอยกเลิก",
  out_of_stock: "สินค้าหมด",
  other: "อื่นๆ",
};

export function isCancelReason(v: unknown): v is CancelReason {
  return typeof v === "string" && REASON_SET.has(v);
}

export function cancelReasonLabel(r: CancelReason): string {
  return LABELS[r];
}

export function cancelBlock(o: { orderStatus: string; paymentStatus: string }): CancelBlock | null {
  if (CLOSED.has(o.orderStatus)) return "already_closed";
  if (!CANCELLABLE_ORDER_STATUSES.includes(o.orderStatus)) return "already_sent";
  if (o.paymentStatus === "verifying") return "check_slip_first";
  return null;
}

/**
 * A customer who transferred after we cancelled (owner, 30 Oct 2026): while the order's own payment
 * deadline is still open the slip is taken, checked, and refunded in full; after it — or when there
 * was never anything to transfer — the storefront sends them to LINE OA instead.
 *
 * `payBy` is that deadline: `payment_expires_at` when set (a rejected slip restarts it), else the
 * order time + EXPIRY_MS — the same clock expireUnpaidOrders reads.
 */
export function slipAfterCancel(
  o: { orderStatus: string; paymentStatus: string; payBy: number | null },
  now: number,
): SlipAfterCancel {
  if (o.orderStatus !== "cancelled") return "not_cancelled";
  if (o.paymentStatus !== "pending") return "contact_line";
  if (o.payBy == null || now >= o.payBy) return "contact_line";
  return "take_slip";
}

/** `payment_expires_at` when set (a rejected slip restarts it), else the order time + 48 hours. */
export function paymentDeadline(o: {
  paymentExpiresAt: number | null;
  orderCreatedAt: number | null;
}): number | null {
  if (o.paymentExpiresAt != null) return o.paymentExpiresAt;
  return o.orderCreatedAt == null ? null : o.orderCreatedAt + EXPIRY_MS;
}
