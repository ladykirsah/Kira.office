/**
 * The single state the owner reads off the /orders Status column.
 *
 * This is NOT `sales_orders.order_status`. That column alone cannot answer "what do I do next":
 * new+pending is waiting on the customer to transfer, new+cod is waiting on the OWNER to approve
 * COD, and both have order_status 'new'. The seven values below are the owner's own vocabulary
 * (30 Jul 2026), and `fail` deliberately absorbs every way an order can end without the customer
 * getting the goods — cancelled, COD denied, payment window expired, delivery failed.
 */
export type OperationalStatus =
  "unpaid" | "cod_pending" | "to_ship" | "in_transit" | "complete" | "fail" | "return";

/** In the owner's stated order — the Status filter renders them in this sequence. */
export const OPERATIONAL_STATUSES: readonly OperationalStatus[] = [
  "unpaid",
  "cod_pending",
  "to_ship",
  "in_transit",
  "complete",
  "fail",
  "return",
];

const LABELS: Record<OperationalStatus, string> = {
  unpaid: "Unpaid",
  cod_pending: "COD pending",
  to_ship: "To ship",
  in_transit: "In transit",
  complete: "Complete",
  fail: "Fail",
  return: "Return",
};

export function operationalStatusLabel(s: OperationalStatus): string {
  return LABELS[s];
}

/** Order statuses that end the order without the goods landing. */
const FAILED_ORDER = new Set(["cancelled", "expired", "delivery_failed"]);
/** Payment statuses that end the order on their own, whatever the fulfillment axis says. */
const FAILED_PAYMENT = new Set(["cod_denied", "expired"]);
/** Payment statuses meaning the money is settled enough to pack and send. */
const CLEARED_PAYMENT = new Set(["paid", "cod_confirmed", "cod_collected"]);

/**
 * Which of the seven an order is in, or null when the data cannot say — a legacy row with null
 * statuses, or a Thai value from before migration 0069. Null is deliberate: mislabelling an order is
 * worse than admitting we do not know.
 *
 * Precedence, most specific first: a return outranks everything (the goods went out and came back);
 * then the failure modes; then movement; then the money.
 */
export function operationalStatus(
  orderStatus: string | null,
  paymentStatus: string | null,
): OperationalStatus | null {
  if (orderStatus === "returned") return "return";

  if (orderStatus && FAILED_ORDER.has(orderStatus)) return "fail";
  if (paymentStatus && FAILED_PAYMENT.has(paymentStatus)) return "fail";

  if (orderStatus === "delivered") return "complete";
  if (orderStatus === "shipped") return "in_transit";

  // Still with us: the money decides what the owner is waiting for.
  if (paymentStatus && CLEARED_PAYMENT.has(paymentStatus)) return "to_ship";
  if (paymentStatus === "cod") return "cod_pending";
  if (paymentStatus === "pending") return "unpaid";

  return null;
}
