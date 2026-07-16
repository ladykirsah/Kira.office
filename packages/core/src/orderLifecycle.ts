/**
 * AirPlus customer-facing order lifecycle rules (owner decisions, 2026-07-16).
 *
 * Pure functions ONLY — these are the single source of truth for what the storefront offers the
 * customer AND what the cancel/return endpoints allow. The UI and the endpoint must never disagree:
 * a button the API would reject is a broken promise, and an API that permits what the UI hides is a
 * hole. Both call the same function here.
 *
 * These decide ELIGIBILITY, never the effect: restoring stock and refunding money are the caller's
 * job. Nothing here touches D1, and every call is race-free by construction because the endpoints
 * re-check with a guarded UPDATE (`WHERE order_status IN (...)`) rather than trusting a prior read.
 */

/** The two-axis fulfilment statuses an AirPlus order moves through (see docs/STATE_OF_THE_BUILD). */
export const AIRPLUS_ORDER_STATUSES = [
  "ใหม่",
  "เตรียมจัดส่ง",
  "กำลังจัดส่ง",
  "สำเร็จ",
  "ยกเลิก",
  "คืนเงิน",
] as const;

/**
 * Statuses a customer may cancel from with NO shop approval. Owner's rule: cancel is free until the
 * parcel physically leaves the shop, matching what Shopee/Lazada train Thai buyers to expect. Once
 * it is with the carrier (กำลังจัดส่ง) the only route is คืนสินค้า.
 *
 * Deliberately independent of payment_status: a paid order can still be cancelled here (the shop
 * refunds and marks คืนเงิน), and — importantly — a COD order can too, which a payment-based rule
 * would have made impossible for a large share of Thai orders.
 */
const CANCELLABLE: ReadonlySet<string> = new Set(["ใหม่", "เตรียมจัดส่ง"]);

/**
 * Fail CLOSED: an unknown, legacy ("delivered") or missing status is never cancellable. Cancelling
 * returns stock to the shelf, so guessing here would corrupt inventory — the customer is told to
 * contact the shop instead, which costs one LINE message and nothing else.
 */
export function canCancelOrder(orderStatus: string | null): boolean {
  return orderStatus !== null && CANCELLABLE.has(orderStatus);
}

/** Maps to the .pill classes in globals.css. `ship` = the CI's emerald, already its shipping colour. */
export type OrderBadgeTone = "good" | "warn" | "bad" | "soft" | "ship";

export interface OrderBadge {
  tone: OrderBadgeTone;
  /** Thai, customer-facing. Never a carrier or tracking number — a badge states STATE, not payload. */
  label: string;
}

/**
 * The one-line status badge for an order in a list.
 *
 * ORDER OF CHECKS IS THE WHOLE FUNCTION — these Thai statuses are substrings of one another, and
 * the naive reading is wrong in two places:
 *   • "เตรียมจัดส่ง" (preparing) CONTAINS "จัดส่ง" (shipping)  → preparing must be tested first, or
 *     an order still sitting in the shop reports itself as in transit. This was a live bug: both
 *     states rendered the same amber pill.
 *   • "จัดส่งสำเร็จ" (delivered) also CONTAINS "จัดส่ง"        → completion must be tested before it.
 * Every branch below is pinned by a test; reordering them will fail loudly rather than silently
 * mislead a customer about where their parcel is.
 *
 * hasTracking only matters when the status is uninformative: a tracking number is proof the parcel
 * left, but an explicit status always outranks it (the shop may attach tracking while still packing).
 */
export function orderStatusBadge(o: {
  orderStatus: string | null;
  hasTracking: boolean;
}): OrderBadge {
  const s = o.orderStatus ?? "";
  if (s.includes("ยกเลิก") || s.includes("คืน")) return { tone: "bad", label: s };
  if (s.includes("สำเร็จ")) return { tone: "good", label: "สำเร็จ" };
  if (s.includes("เตรียม")) return { tone: "warn", label: "เตรียมจัดส่ง" };
  if (s.includes("จัดส่ง") || o.hasTracking) {
    return { tone: "ship", label: "อยู่ระหว่างการจัดส่ง" };
  }
  return { tone: "soft", label: "รอดำเนินการ" };
}

export interface PaymentShape {
  paymentStatus: string | null;
  /** true when a `payments` row exists for the order — checkout writes one for EVERY prepaid method
   *  (PromptPay/transfer) and never for COD, so its absence is the durable proof of COD. */
  hasPaymentRecord: boolean;
}

/**
 * Is this เก็บเงินปลายทาง? Two independent signals, because neither alone is trustworthy:
 *
 *  • payment_status === 'เก็บเงินปลายทาง' is what checkout writes — but the shop CAN overwrite
 *    payment_status from the admin, which would erase COD-ness if it were the only marker.
 *  • The absence of a payments row survives that: money never moves for COD until the courier
 *    collects, so checkout has nothing to record.
 *
 * Either signal is enough to call it COD; that is deliberate, since every consequence of a false
 * positive here is "we don't offer a slip button" and of a false negative is "we ask a COD customer
 * to prove a transfer they never made".
 */
export function isCodOrder(p: PaymentShape): boolean {
  return p.paymentStatus === "เก็บเงินปลายทาง" || !p.hasPaymentRecord;
}

/**
 * May the customer attach a transfer slip? Exactly one situation qualifies: a PREPAID order that is
 * still waiting for its money. COD is excluded outright (owner, 2026-07-16: "COD does not need
 * slip, this feature should not be available in the first place").
 *
 * Fails closed on any unknown status. Used by BOTH the order page (to render the block) and the
 * slip endpoint (to refuse), so the button and the API can never disagree — previously the page
 * inferred COD from the status while the API inferred it from a missing payments row, and each was
 * one admin edit away from telling the customer something untrue.
 */
export function canUploadSlip(p: PaymentShape): boolean {
  return !isCodOrder(p) && p.paymentStatus === "รอชำระเงิน";
}

/** Days after an order reaches สำเร็จ during which คืนสินค้า / เคลม may be requested (owner: 7). */
export const RETURN_WINDOW_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReturnEligibilityInput {
  orderStatus: string | null;
  /** epoch ms the order reached สำเร็จ; null when unknown (legacy rows) — see fail-open note below */
  completedAt: number | null;
  now: number;
  /** status of the order's most recent request, or null if none was ever filed. The STATUS, not a
   *  boolean: "open" and "rejected" both block, but they are different dead ends for the customer
   *  (wait for us / talk to us) and the page must be able to tell them apart. */
  latestRequestStatus: string | null;
}

export type ReturnEligibilityReason =
  | "ok"
  | "not-completed"
  | "window-expired"
  | "already-requested"
  /** the mechanic said no — the self-serve path is over, the page offers LINE instead */
  | "rejected";

export interface ReturnEligibility {
  allowed: boolean;
  /** why — the UI turns this into the Thai sentence it shows instead of the button */
  reason: ReturnEligibilityReason;
}

/**
 * Whether the customer may open a คืนสินค้า / เคลม request.
 *
 * Order of checks is deliberate — the customer sees the FIRST true reason, so the most explanatory
 * one must win: "your order hasn't arrived yet" beats "you already have a request open".
 *
 * completedAt === null fails OPEN. Unlike cancel (which moves stock on its own), a return request
 * changes nothing by itself — the shop's mechanic approves every one. So the cost of allowing a
 * request we cannot date is one conversation; the cost of refusing a legitimate claim on a legacy
 * order is a customer who cannot reach us at all. Cheap mistake beats expensive one.
 */
export function returnEligibility(input: ReturnEligibilityInput): ReturnEligibility {
  if (input.orderStatus !== "สำเร็จ") return { allowed: false, reason: "not-completed" };
  // A rejection is terminal for self-service and outranks the window: a customer whose claim was
  // refused an hour ago must not be handed the same button to file it again. Rejecting the same
  // claim repeatedly is not a workflow — it is the shop and the customer wasting each other's time.
  if (input.latestRequestStatus === "ปฏิเสธ") return { allowed: false, reason: "rejected" };
  if (isOpenReturnStatus(input.latestRequestStatus)) {
    return { allowed: false, reason: "already-requested" };
  }
  if (input.completedAt !== null && input.now - input.completedAt > RETURN_WINDOW_DAYS * DAY_MS) {
    return { allowed: false, reason: "window-expired" };
  }
  return { allowed: true, reason: "ok" };
}

/** What the customer is asking for. Both need the mechanic's approval; only the wording differs. */
export type ReturnKind = "return" | "claim";

/** Lifecycle of one request. The customer only ever sees these; the shop drives the transitions. */
export const RETURN_STATUSES = ["รอตรวจสอบ", "อนุมัติ", "ปฏิเสธ", "เสร็จสิ้น"] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

/** A request still occupies the order until the shop decides (or has finished acting on it). */
export function isOpenReturnStatus(status: string | null): boolean {
  return status === "รอตรวจสอบ" || status === "อนุมัติ";
}
