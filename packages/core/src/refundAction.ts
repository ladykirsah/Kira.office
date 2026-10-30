/**
 * Does a bounced AirPlus order need a refund, and is it still ours to pay?
 *
 * Two paths get in-system money back, both on an order whose money we actually hold: a parcel that
 * failed delivery (`delivery_failed`, ตีกลับ), and an order the shop cancelled (`cancelled`, owner
 * 30 Oct 2026 — including a customer who transferred after the cancel). Every other return or claim
 * is handled off-system via LINE OA, so this never fires for them. Once we have paid the customer back (`refundedAt` set) the
 * action is done. And the obligation is not open forever: unclaimed for more than a year, we keep the
 * money — the order drops out of the refund queue rather than nagging indefinitely.
 */

export type RefundAction =
  /** delivery_failed or cancelled + money in hand + not yet refunded + within the 1-year window. */
  | "needs_refund"
  /** We have already paid the customer back. Show the evidence, take no action. */
  | "refunded"
  /** Not a refund case — wrong status, no money held, or the 1-year window has closed. */
  | "none";

export interface RefundActionInput {
  orderStatus: string;
  paymentStatus: string | null;
  /** `sales_orders.refunded_at`, ms. Non-null once we have paid the customer back. */
  refundedAt: number | null;
  /** When the refund became owed — the `delivery_failed` or `cancelled` history event — ms. Null if
   *  unknown. */
  failedAt: number | null;
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
/** Money actually in hand: a transfer that cleared, or COD we collected. A bounced COD was never paid. */
const CLEARED = new Set(["paid", "cod_collected"]);
const REFUND_STATUSES = new Set(["delivery_failed", "cancelled"]);

export function classifyRefundAction(input: RefundActionInput, now: number): RefundAction {
  // This classifies the bounce and cancel refunds ONLY. A claim resolved with money back also sets
  // refundedAt, but it sits at `claimed` — the claim section shows that refund, so gate the
  // "refunded" verdict on these two statuses too, or the wrong Zone A would claim it.
  if (!REFUND_STATUSES.has(input.orderStatus)) return "none";
  if (input.refundedAt != null) return "refunded";
  if (!CLEARED.has(input.paymentStatus ?? "")) return "none";
  // Forfeit only when we can PROVE a year has passed; an unknown date must not read as expired.
  if (input.failedAt != null && now - input.failedAt >= ONE_YEAR_MS) return "none";
  return "needs_refund";
}
