import { isCodOrder } from "./orderLifecycle";

/**
 * The customer-facing order timeline (owner-designed, 2026-07-16). ONE pure function so every order
 * tells its story in the same shape, and so the states can be tested — the old version derived each
 * step inline from substring checks and got COD wrong in a way nobody could see by reading it.
 *
 * The shape the owner specified:
 *   1 สั่งซื้อสินค้า → 2 รอชำระเงิน/ชำระเงิน → 3 เตรียมจัดส่ง/จัดส่งแล้ว → 4 อยู่ระหว่างทาง → 5 จัดส่งสำเร็จ
 *
 * Two rules make it honest rather than decorative:
 *
 *  • COD MOVES THE PAYMENT STEP to just before delivery. This is the whole reason for the redesign:
 *    the old timeline drew a green, completed ชำระเงิน on a COD order at step 2 — announcing that
 *    money had been received when literally none had. For COD the money changes hands at the door,
 *    so the step belongs at the door.
 *  • Steps 2 and 3 RENAME themselves on completion (รอชำระเงิน→ชำระเงิน, เตรียมจัดส่ง→จัดส่งแล้ว),
 *    so a step's title always describes reality rather than an intention.
 *
 * `at` is null wherever we do not yet record that transition (the shop has no preparing/cancelled
 * timestamp). Owner's call: render the step now, fill the time in when the shipping system lands.
 * NOTHING here invents a timestamp — a plausible-but-wrong delivery time is worse than a blank.
 */

export type TimelineTone = "done" | "current" | "future" | "bad";

export interface TimelineStep {
  /** stable id for React keys + tests; never shown */
  key: string;
  title: string;
  /** second line: carrier · tracking id, an instruction, or a rejection reason */
  detail: string | null;
  /** epoch ms, or null when that transition is not recorded yet */
  at: number | null;
  tone: TimelineTone;
}

export interface ReturnRequestShape {
  status: string;
  createdAt: number;
  decidedAt: number | null;
  decisionNote: string | null;
}

export interface TimelineInput {
  orderStatus: string | null;
  paymentStatus: string | null;
  hasPaymentRecord: boolean;
  createdAt: number | null;
  /** payments.confirmed_at — only set when a slip auto-verifies; null otherwise */
  paidAt: number | null;
  shipTimeMs: number | null;
  completedAt: number | null;
  carrier: string | null;
  trackingNo: string | null;
  returnRequest: ReturnRequestShape | null;
}

const step = (
  key: string,
  title: string,
  tone: TimelineTone,
  at: number | null = null,
  detail: string | null = null,
): TimelineStep => ({ key, title, detail, at, tone });

export function buildOrderTimeline(i: TimelineInput): TimelineStep[] {
  const s = i.orderStatus ?? "";
  const cod = isCodOrder({ paymentStatus: i.paymentStatus, hasPaymentRecord: i.hasPaymentRecord });

  // Check completion BEFORE shipping: "จัดส่งสำเร็จ" contains "จัดส่ง", the same substring trap that
  // made เตรียมจัดส่ง masquerade as in-transit on the history page.
  const cancelled = s.includes("ยกเลิก");
  const refundedStatus = s.includes("คืนเงิน");
  // A refund PROVES delivery. order_status holds a single value, so 'คืนเงิน' overwrites the
  // 'สำเร็จ' that necessarily preceded it (refunds start at delivery — owner's rule), and reading
  // the status literally would draw "จัดส่งสำเร็จ [ยังไม่ถึง]" directly above "คืนเงินสำเร็จ [แล้ว]":
  // money returned for a parcel the same timeline claims never arrived.
  const delivered = s.includes("สำเร็จ") || refundedStatus;
  const shipped = delivered || Boolean(i.carrier || i.trackingNo || i.shipTimeMs);
  const preparing = s.includes("เตรียม");
  const paid = i.paymentStatus === "ชำระแล้ว";

  const ordered = step("ordered", "สั่งซื้อสินค้า", "done", i.createdAt);

  // --- payment -------------------------------------------------------------------------------
  // COD is timed at delivery because that is when the courier collects; prepaid uses the slip's
  // confirmation time. Either way the step is only "done" once money genuinely moved.
  const payment: TimelineStep = cod
    ? delivered
      ? step("payment", "ชำระเงินแล้ว", "done", i.completedAt, "เก็บเงินปลายทาง (จ่ายตอนรับของ)")
      : step("payment", "ชำระเงินปลายทาง", "future", null, "จ่ายตอนรับของ")
    : paid
      ? step("payment", "ชำระเงิน", "done", i.paidAt)
      : step("payment", "รอชำระเงิน", "current", null);

  // --- packing / handover --------------------------------------------------------------------
  const packing: TimelineStep = shipped
    ? step("packing", "จัดส่งแล้ว", "done", i.shipTimeMs)
    : preparing
      ? step("packing", "เตรียมจัดส่ง", "current")
      : step("packing", "เตรียมจัดส่ง", "future");

  // --- in transit ----------------------------------------------------------------------------
  const shipDetail = [i.carrier, i.trackingNo].filter(Boolean).join(" · ") || null;
  const transit: TimelineStep = delivered
    ? step("transit", "อยู่ระหว่างทาง", "done", null, shipDetail)
    : shipped
      ? step("transit", "อยู่ระหว่างทาง", "current", null, shipDetail)
      : step("transit", "อยู่ระหว่างทาง", "future");

  const deliveredStep: TimelineStep = delivered
    ? step("delivered", "จัดส่งสำเร็จ", "done", i.completedAt)
    : step("delivered", "จัดส่งสำเร็จ", "future");

  // COD reorders, it does not add or remove: payment slots in after transit, before delivery.
  const main = cod
    ? [ordered, packing, transit, payment, deliveredStep]
    : [ordered, payment, packing, transit, deliveredStep];

  // --- cancelled -----------------------------------------------------------------------------
  // Keep only what actually happened, then end. Drawing เตรียมจัดส่ง / อยู่ระหว่างทาง / จัดส่งสำเร็จ
  // in grey under a cancelled order would promise a future that is never coming.
  if (cancelled) {
    return [
      ...main.filter((x) => x.tone === "done"),
      step("cancelled", "ยกเลิกคำสั่งซื้อ", "bad", null),
    ];
  }

  const req = i.returnRequest;
  if (!req && !refundedStatus) return main;

  // --- refund, continuing on from จัดส่งสำเร็จ -------------------------------------------------
  // A refunded order with no request row predates the คืนสินค้า flow (or the shop refunded by hand),
  // so it gets the ending without inventing a request that was never filed.
  if (!req) return [...main, step("refundResult", "คืนเงินสำเร็จ", "done", null)];

  const decided = req.status === "อนุมัติ" || req.status === "ปฏิเสธ" || req.status === "เสร็จสิ้น";

  const refundRequested = step("refundRequested", "ทำเรื่องคืนเงิน", "done", req.createdAt);
  const refundReview = decided
    ? step("refundReview", "ร้านค้าตรวจสอบ", "done", req.decidedAt)
    : step(
        "refundReview",
        "ร้านค้าตรวจสอบ",
        "current",
        null,
        "กรุณาส่งสินค้ากลับมาให้ทีมช่างตรวจสอบ",
      );

  let refundResult: TimelineStep;
  if (req.status === "ปฏิเสธ") {
    // A rejection with no explanation is what customers escalate over — always say something.
    refundResult = step(
      "refundResult",
      "คืนเงินไม่สำเร็จ",
      "bad",
      req.decidedAt,
      req.decisionNote || "ไม่ผ่านการตรวจสอบจากทีมช่าง — กรุณาติดต่อร้านทาง LINE",
    );
  } else if (req.status === "เสร็จสิ้น") {
    refundResult = step("refundResult", "คืนเงินสำเร็จ", "done", req.decidedAt);
  } else if (req.status === "อนุมัติ") {
    refundResult = step(
      "refundResult",
      "คืนเงินสำเร็จ",
      "current",
      null,
      "อนุมัติแล้ว รอโอนเงินคืน",
    );
  } else {
    refundResult = step("refundResult", "คืนเงินสำเร็จ", "future");
  }

  return [...main, refundRequested, refundReview, refundResult];
}
