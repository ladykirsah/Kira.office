/**
 * The single state the /orders Status column shows, following the owner's flow (30 Jul 2026):
 *
 *   checkout > pay > delivery > done
 *
 * This is NOT `sales_orders.order_status`. That column alone cannot answer "what do I do next":
 * new+pending waits on the customer to transfer, new+cod waits on the OWNER to approve COD, and
 * new+verifying means they already paid and are waiting on us. All three are order_status 'new'.
 *
 * Kira.office is English today, so `operationalStatusLabel` is the one the UI renders;
 * `operationalStatusLabelTh` carries the owner's Thai so the planned bilingual switch is a toggle
 * rather than a rewrite. AirPlus (the storefront) is Thai.
 */
export type OperationalStatus =
  // ── payment ──
  | "unpaid"
  | "verifying"
  | "cod_pending"
  | "cod_reject"
  | "to_ship"
  // ── delivery ──
  | "in_transit"
  | "complete"
  | "return"
  // ── claim ──
  | "claim_pending"
  | "claimed"
  | "refunded"
  | "claim_rejected"
  // ── ended badly ──
  | "fail";

/** Flow order: payment, then delivery, then claim. The Status filter renders this sequence. */
export const OPERATIONAL_STATUSES: readonly OperationalStatus[] = [
  "unpaid",
  "verifying",
  "cod_pending",
  "cod_reject",
  "to_ship",
  "in_transit",
  "complete",
  "return",
  "claim_pending",
  "claimed",
  "refunded",
  "claim_rejected",
  "fail",
];

const EN: Record<OperationalStatus, string> = {
  unpaid: "Unpaid",
  verifying: "Pending",
  cod_pending: "COD pending",
  cod_reject: "COD reject",
  to_ship: "To ship",
  in_transit: "In transit",
  complete: "Complete",
  return: "Return",
  claim_pending: "Claim pending",
  claimed: "Claimed",
  refunded: "Refund",
  claim_rejected: "Claim rejected",
  fail: "Fail",
};

const TH: Record<OperationalStatus, string> = {
  unpaid: "ยังไม่ชำระเงิน",
  verifying: "กำลังตรวจสอบ",
  cod_pending: "รอการอนุมัติ",
  cod_reject: "ปฏิเสธเก็บเงินปลายทาง",
  to_ship: "เตรียมจัดส่ง",
  in_transit: "กำลังจัดส่ง",
  complete: "สำเร็จ",
  return: "ตีกลับ",
  claim_pending: "รอการอนุมัติจากช่าง",
  claimed: "เคลม",
  refunded: "คืนเงิน",
  claim_rejected: "ปฏิเสธการเคลม",
  fail: "ไม่สำเร็จ",
};

export function operationalStatusLabel(s: OperationalStatus): string {
  return EN[s];
}

export function operationalStatusLabelTh(s: OperationalStatus): string {
  return TH[s];
}

/** Payment values meaning the money is settled enough to pack and send. */
const CLEARED = new Set(["paid", "cod_confirmed", "cod_collected"]);

/**
 * Which of the thirteen an order is in, or null when the data cannot say — a null status, a Thai
 * value from before migration 0069, or a status we have retired. Null is deliberate: mislabelling an
 * order is worse than admitting we do not know.
 *
 * Precedence runs newest-truth-first. A claim outranks the delivery that preceded it; a bounced
 * parcel outranks the payment that is still sitting on the order; COD denial outranks the order
 * still being 'new'.
 */
export function operationalStatus(
  orderStatus: string | null,
  paymentStatus: string | null,
): OperationalStatus | null {
  // ── claim: the newest thing that happened, and it happens after delivery ──
  if (orderStatus === "claim_pending") return "claim_pending";
  if (orderStatus === "claim_rejected") return "claim_rejected";
  if (orderStatus === "claimed") {
    // Two resolutions share one order status; the money axis says which. Money back vs a
    // replacement sent are different outcomes for the customer and for the till.
    return paymentStatus === "refunded" ? "refunded" : "claimed";
  }

  // ── ended badly ──
  if (orderStatus === "cancelled" || orderStatus === "expired") return "fail";
  if (paymentStatus === "expired") return "fail";

  // ── parcel came back without ever arriving (ตีกลับ). Not `fail`: the money is still live and the
  //    order can be re-sent, so it needs its own bucket. `returned` is a retired alias kept only so
  //    a stray row from before the vocabulary settled reads as a return rather than falling through
  //    to the payment axis and claiming to be "To ship". ──
  if (orderStatus === "delivery_failed" || orderStatus === "returned") return "return";

  // ── COD refused. A decision point, not a death: the customer is offered PromptPay or cancel. ──
  if (paymentStatus === "cod_denied") return "cod_reject";

  // ── delivery ──
  if (orderStatus === "delivered") return "complete";
  if (orderStatus === "shipped") return "in_transit";

  // ── still with us: the money decides what we are waiting for ──
  if (paymentStatus && CLEARED.has(paymentStatus)) return "to_ship";
  if (paymentStatus === "verifying") return "verifying";
  if (paymentStatus === "cod") return "cod_pending";
  if (paymentStatus === "pending") return "unpaid";

  return null;
}
