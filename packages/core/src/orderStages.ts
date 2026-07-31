import { operationalStatus } from "./operationalStatus";

/**
 * The order timeline as a PROGRESS STEPPER (owner, 31 Jul 2026), not a raw event log.
 *
 * Oldest → newest. Every order opens with `สั่งซื้อสินค้า` — the customer's action, never a system
 * "new order" row. Each later milestone is `done`, the single `current` one, or `upcoming` (not yet
 * reached), derived from operationalStatus so the stepper always agrees with the status pill. Dates
 * come from order_status_history where a matching event exists; upcoming milestones have none.
 *
 * A `note` is the optional third line, used only where a step needed a person to approve it — COD
 * (admin) and a claim (mechanic). Until per-staff logins exist, the approver is the mock username `L`.
 */

export type StageState = "done" | "current" | "upcoming";

export interface OrderStage {
  key: string;
  label: string;
  state: StageState;
  /** Epoch ms from history, or null for an upcoming/undated step. */
  at: number | null;
  /** Optional third line — the approver, only on steps that required a sign-off. */
  note?: string;
}

export interface StageHistoryEntry {
  event: string;
  at: number;
}

const CLAIM_OPS = new Set(["claim_pending", "claimed", "refunded", "claim_rejected"]);
/** Operational statuses that mean the parcel has already been handed to the carrier. */
const SHIPPED_ONWARD = new Set(["in_transit", "complete", "return", ...CLAIM_OPS]);
/** Operational statuses that mean the customer has already received the goods. */
const DELIVERED_ONWARD = new Set(["complete", ...CLAIM_OPS]);

/** The mock approver until per-staff logins exist (Staff & Mechanic plan). */
const APPROVER = "L";

export interface OrderStagesOptions {
  /**
   * True when this COD order was approved automatically (best/good tier, `codApproval === "auto"`)
   * rather than by a staff member. Only affects the approval step's note line.
   */
  codAutoApproved?: boolean;
}

/**
 * Build the stepper for one order. `history` is order_status_history rows ({event, at}); order need
 * not have every event — labels and states come from the current status, dates from history.
 */
export function orderStages(
  orderStatus: string | null,
  paymentStatus: string | null,
  history: StageHistoryEntry[] = [],
  opts: OrderStagesOptions = {},
): OrderStage[] {
  const op = operationalStatus(orderStatus, paymentStatus) ?? "";

  // Latest timestamp recorded for an event, or null.
  const atOf = (event: string): number | null => {
    let best: number | null = null;
    for (const h of history) {
      if (h.event === event) best = best == null ? h.at : Math.max(best, h.at);
    }
    return best;
  };

  const isCod =
    paymentStatus === "cod" ||
    paymentStatus === "cod_confirmed" ||
    paymentStatus === "cod_collected";
  const stages: OrderStage[] = [];
  const add = (key: string, label: string, state: StageState, at: number | null, note?: string) =>
    stages.push(note ? { key, label, state, at, note } : { key, label, state, at });

  // 1 — always: the customer placed the order.
  add("placed", "สั่งซื้อสินค้า", "done", atOf("created"));

  // Terminal: cancelled / expired. The flow stops; no upcoming steps.
  if (op === "fail") {
    const cancelled = orderStatus === "cancelled";
    add(
      cancelled ? "cancelled" : "expired",
      cancelled ? "ยกเลิกคำสั่งซื้อ" : "หมดอายุ (ไม่ชำระใน 48 ชม.)",
      "current",
      atOf(cancelled ? "cancelled" : "expired"),
    );
    return stages;
  }

  // 2 — payment. COD is an approval step (records who approved); prepaid is just "paid".
  const paymentPending =
    op === "unpaid" || op === "verifying" || op === "cod_pending" || op === "cod_reject";
  const payLabel = paymentPending
    ? op === "unpaid"
      ? "รอชำระเงิน"
      : op === "verifying"
        ? "รอตรวจสอบสลิป"
        : op === "cod_pending"
          ? "รออนุมัติเก็บเงินปลายทาง"
          : "ปฏิเสธเก็บเงินปลายทาง" // cod_reject
    : isCod
      ? "อนุมัติเก็บเงินปลายทาง"
      : "ชำระเงินแล้ว";
  const payAt = atOf(isCod ? "cod_approved" : "paid") ?? atOf("paid");
  // COD approval note: auto-approved (best/good tier) says so; a staff approval names the approver.
  const payNote =
    isCod && !paymentPending
      ? opts.codAutoApproved
        ? "อนุมัติอัตโนมัติ"
        : `อนุมัติโดย ${APPROVER}`
      : undefined;
  add("payment", payLabel, paymentPending ? "current" : "done", payAt, payNote);

  if (paymentPending) {
    add("to_ship", "เตรียมจัดส่ง", "upcoming", null);
    add("in_transit", "กำลังจัดส่ง", "upcoming", null);
    add("complete", "จัดส่งสำเร็จ", "upcoming", null);
    return stages;
  }

  // 3 — to ship (paid & confirmed, waiting to go out).
  const shipReached = SHIPPED_ONWARD.has(op);
  add(
    "to_ship",
    "เตรียมจัดส่ง",
    op === "to_ship" ? "current" : shipReached ? "done" : "upcoming",
    atOf("confirmed"),
  );
  if (op === "to_ship") {
    add("in_transit", "กำลังจัดส่ง", "upcoming", null);
    add("complete", "จัดส่งสำเร็จ", "upcoming", null);
    return stages;
  }

  // 4 — in transit (handed to the carrier).
  const deliveredReached = DELIVERED_ONWARD.has(op);
  add(
    "in_transit",
    "กำลังจัดส่ง",
    op === "in_transit" ? "current" : deliveredReached || op === "return" ? "done" : "upcoming",
    atOf("shipped"),
  );
  if (op === "in_transit") {
    add("complete", "จัดส่งสำเร็จ", "upcoming", null);
    return stages;
  }

  // Return branch: the parcel bounced (ตีกลับ) before it was ever delivered.
  if (op === "return") {
    add("return", "ตีกลับ (ส่งไม่สำเร็จ)", "current", atOf("shipped"));
    return stages;
  }

  // 5 — delivered.
  add("complete", "จัดส่งสำเร็จ", op === "complete" ? "current" : "done", atOf("delivered"));
  if (op === "complete") return stages;

  // Claim branch (op ∈ claim_pending | claimed | refunded | claim_rejected).
  add("claim_open", "แจ้งเคลม", "done", atOf("claim_pending"));
  if (op === "claim_pending") {
    add("claim_review", "รอช่างตรวจสอบ", "current", null);
    return stages;
  }
  if (op === "claim_rejected") {
    add(
      "claim_reject",
      "ปฏิเสธการเคลม",
      "current",
      atOf("claim_rejected"),
      `ปฏิเสธโดย ${APPROVER}`,
    );
    return stages;
  }
  // claimed or refunded — the mechanic approved the claim.
  add("claim_review", "อนุมัติการเคลม", "done", null, `อนุมัติโดย ${APPROVER}`);
  if (op === "refunded") {
    add("refunded", "คืนเงินแล้ว", "current", atOf("refunded"));
  } else {
    add("claimed", "เปลี่ยนสินค้า", "current", atOf("claimed"));
  }
  return stages;
}
