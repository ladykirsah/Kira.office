import {
  cancelBlock,
  canCancelOrderRole,
  operationalStatus,
  operationalStatusPhrase,
  type CancelReason,
} from "@l-shopee/core";
import type { Phrase } from "@l-shopee/shared/lang";
import type { OrderAddress, OrderClaim, OrderDetail } from "./ordersApi";

/**
 * The rules behind one order's page (owner approved the drawing, 2026-10-29): which single job sits
 * at the top, who may do it, how far along the order is, and whether a drop-off form is complete.
 * The same rules as the web back office's order page, so the two never offer different jobs.
 * No screen code here.
 */

export type Job = "pay" | "cod" | "ship" | "refund" | "claim";

/** States in which a claim still asks the shop for something (the web's ClaimReview). */
const OPEN_CLAIM = new Set(["requested", "approved", "received", "mechanic_approved"]);

/** A rejected claim stays open until the part is sent back. */
const isOpen = (c: OrderClaim) =>
  OPEN_CLAIM.has(c.state) || (c.state === "mechanic_rejected" && !c.trackingNo);

/** The claim still in progress, if any. */
export function activeClaim(claims: readonly OrderClaim[]): OrderClaim | null {
  return claims.find(isOpen) ?? null;
}

type JobInput = {
  order: Pick<OrderDetail["order"], "orderStatus" | "paymentStatus">;
  claims: readonly OrderClaim[];
  refundAction: OrderDetail["refundAction"];
};

/** The one job at the top of the page, in the web's order; null when nothing waits on the shop. */
export function jobFor(page: JobInput): Job | null {
  // A slip sent after the shop cancelled is still checked (drawing 6, row 3): confirmed, it
  // becomes a full refund; rejected, the order stays cancelled and unpaid.
  if (page.order.orderStatus === "cancelled" && page.order.paymentStatus === "verifying") {
    return "pay";
  }
  const s = operationalStatus(page.order.orderStatus, page.order.paymentStatus);
  if (s === "to_ship") return "ship";
  if (s === "verifying") return "pay";
  if (s === "cod_pending") return "cod";
  if (activeClaim(page.claims)) return "claim";
  if (page.refundAction !== "none") return "refund";
  return null;
}

export type PageSection =
  "address" | "delivery" | "items" | "payment" | "files" | "customer" | "actions";

/**
 * What sits under the job, in Shopee's order (owner approved the drawing, 29 Oct 2026): where it
 * goes, the parcel now, what is in the box, how it was paid, the files, who bought it, then the
 * quiet actions. The timeline and the money detail sit behind › on pages of their own.
 */
export function pageSections(): PageSection[] {
  return ["address", "delivery", "items", "payment", "files", "customer", "actions"];
}

export type ClaimStep = "receive" | "review" | "refund" | "replace" | "sendBack";

export function claimStep(claim: OrderClaim): ClaimStep {
  if (claim.state === "received") return "review";
  if (claim.state === "mechanic_approved") {
    return claim.resolution === "refund" ? "refund" : "replace";
  }
  if (claim.state === "mechanic_rejected") return "sendBack";
  return "receive";
}

export type Role = OrderDetail["viewerRole"];

/** Who may act (packages/core access.ts): money decisions are the owner's and admins', claims
 *  the owner's and mechanics', a refund the owner's alone. The API checks again on every call. */
export function canDo(job: Job, role: Role): boolean {
  switch (job) {
    case "pay":
    case "cod":
      return role === "super_admin" || role === "admin";
    case "claim":
      return role === "super_admin" || role === "mechanic";
    case "refund":
      return role === "super_admin";
    case "ship":
      return true;
  }
}

/** สั่งซื้อ · ชำระเงิน · เตรียมจัดส่ง · กำลังจัดส่ง · จัดส่งสำเร็จ — the step the order is on, or
 *  null when it has left the main path (cancelled, bounced, claimed). */
export function progressStep(
  orderStatus: string | null,
  paymentStatus: string | null,
): number | null {
  switch (operationalStatus(orderStatus, paymentStatus)) {
    case "unpaid":
    case "verifying":
    case "cod_pending":
    case "cod_reject":
      return 1;
    case "to_ship":
      return 2;
    case "in_transit":
      return 3;
    case "complete":
      return 4;
    default:
      return null;
  }
}

export type DropOffRead =
  | { ok: true; value: { carrier: string; trackingNo: string; shippingRealSatang: number } }
  | { ok: false; missing: "tracking" | "fee" };

/** "1,060.5" → 106050 satang; null for anything that is not a cost. */
function bahtToSatang(text: string): number | null {
  const clean = text.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

/** The drop-off form, checked when บันทึก is pressed: the first missing field is named. */
export function readDropOff(carrier: string, trackingNo: string, realBaht: string): DropOffRead {
  const tracking = trackingNo.trim();
  if (!tracking) return { ok: false, missing: "tracking" };
  const satang = bahtToSatang(realBaht);
  if (satang == null) return { ok: false, missing: "fee" };
  return { ok: true, value: { carrier, trackingNo: tracking, shippingRealSatang: satang } };
}

/** The street, area, province and postcode as one line. */
export function addressLine(a: OrderAddress): string {
  return [a.addressLine1, a.subdistrict, a.district, a.province, a.postalCode]
    .filter((p): p is string => !!p && p.trim() !== "")
    .join(" ");
}

/** How a finished claim ended — what สรุปการเคลม says under it (the web's claim summary). */
export type ClaimOutcome = "replaced" | "returned" | "refunded" | "closed";

/** The claims that need nothing more from the shop: the page's record of them. */
export function finishedClaims(claims: readonly OrderClaim[]): OrderClaim[] {
  return claims.filter((c) => !isOpen(c));
}

/** A rejected claim's part going back is a return whatever the customer asked for; a refund
 *  counts only once the claim is done. */
export function claimOutcome(claim: OrderClaim): ClaimOutcome {
  if (claim.trackingNo) return claim.state === "mechanic_rejected" ? "returned" : "replaced";
  if (claim.state === "done" && claim.resolution === "refund") return "refunded";
  return "closed";
}

/** The slip's row in ไฟล์: none for cash on delivery; its own page opens for the owner only. */
export type SlipRow = { opens: boolean; note: "ownerOnly" | "none" } | null;

export function slipRow(slip: { available: boolean } | undefined, isOwner: boolean): SlipRow {
  if (!slip) return null;
  if (!slip.available) return { opens: false, note: "none" };
  return { opens: isOwner, note: "ownerOnly" };
}

/** The parcel's short line under ข้อมูลการจัดส่ง: where it is now, and since when. */
export type DeliveryStep = "notSent" | "inTransit" | "delivered" | "bounced" | "cancelled";

const DELIVERED = new Set(["complete", "claim_pending", "claimed", "refunded", "claim_rejected"]);

export function deliveryNow(
  order: Pick<
    OrderDetail["order"],
    "orderStatus" | "paymentStatus" | "carrier" | "trackingNo" | "shipTimeMs" | "cancelledAt"
  >,
  timeline: readonly { event: string; createdAt: number }[],
): { parcel: string | null; step: DeliveryStep; at: number | null } {
  const op = operationalStatus(order.orderStatus, order.paymentStatus) ?? "";
  const parcel = order.trackingNo
    ? [order.carrier, order.trackingNo].filter(Boolean).join(" · ")
    : null;
  // Only a time the order really recorded; none is made up.
  const atOf = (event: string) => timeline.find((e) => e.event === event)?.createdAt ?? null;
  if (order.orderStatus === "cancelled") {
    return { parcel, step: "cancelled", at: order.cancelledAt ?? atOf("cancelled") };
  }
  if (op === "return") return { parcel, step: "bounced", at: atOf("delivery_failed") };
  if (DELIVERED.has(op)) return { parcel, step: "delivered", at: atOf("delivered") };
  if (op === "in_transit") {
    return { parcel, step: "inTransit", at: order.shipTimeMs ?? atOf("shipped") };
  }
  return { parcel, step: "notSent", at: null };
}

/** In transit with nothing to do, the pinned button is the carrier's tracking page (drawing A3). */
export function pinsTracking(
  order: { orderStatus: string | null; paymentStatus: string | null; trackUrl: string | null },
  job: Job | null,
): boolean {
  return (
    job == null &&
    order.trackUrl != null &&
    operationalStatus(order.orderStatus, order.paymentStatus) === "in_transit"
  );
}

/**
 * ยกเลิกออเดอร์ at the foot of the page (owner, 30 Oct 2026): the owner and admins, before the
 * parcel is sent. A slip still waiting is checked first — the button then says so instead of
 * opening the sheet. The API checks all of it again.
 */
export function cancelButton(
  order: { orderStatus: string | null; paymentStatus: string | null },
  role: Role,
): "show" | "checkSlip" | null {
  if (!canCancelOrderRole(role)) return null;
  const block = cancelBlock({
    orderStatus: order.orderStatus ?? "",
    paymentStatus: order.paymentStatus ?? "",
  });
  if (block === "check_slip_first") return "checkSlip";
  return block ? null : "show";
}

/** The sheet's ลูกค้าโอนแล้ว row: a paid order comes back as a full refund job. */
export function refundOnCancel(order: {
  paymentStatus: string | null;
  grandTotalSatang: number;
}): number | null {
  return order.paymentStatus === "paid" ? order.grandTotalSatang : null;
}

/**
 * ยกเลิกเมื่อ … · <reason>. Only the shop's own cancel writes a reason, and only it gave the stock
 * and the coupon back — an older or customer-side cancel shows its time alone. An AirPlus order's
 * discount is its coupon (storefront checkout), so a discount says a coupon came back.
 */
export function cancelInfo(
  order: Pick<
    OrderDetail["order"],
    "orderStatus" | "cancelReason" | "cancelledAt" | "discountTotalSatang"
  >,
  timeline: readonly { event: string; createdAt: number }[],
): {
  at: number | null;
  reason: CancelReason | null;
  restocked: boolean;
  couponBack: boolean;
} | null {
  if (order.orderStatus !== "cancelled") return null;
  const at = order.cancelledAt ?? timeline.find((e) => e.event === "cancelled")?.createdAt ?? null;
  const restocked = order.cancelReason != null;
  return {
    at,
    reason: order.cancelReason,
    restocked,
    couponBack: restocked && order.discountTotalSatang > 0,
  };
}

const CANCELLED: Phrase = { th: "ยกเลิก", en: "Cancelled" };

/** The word beside the order number: the list's own word, except a cancel says ยกเลิก. */
export function statusWord(orderStatus: string | null, paymentStatus: string | null): Phrase {
  if (orderStatus === "cancelled") return CANCELLED;
  const op = operationalStatus(orderStatus, paymentStatus);
  return op ? operationalStatusPhrase(op) : { th: orderStatus ?? "—", en: orderStatus ?? "—" };
}
