import type { OperationalStatus } from "@l-shopee/core";
import type { Phrase } from "./lang";

export type OrderTab =
  "unpaid" | "pending" | "toship" | "shipped" | "completed" | "cancelfail" | "refundclaim";

/**
 * What each /orders tab is called. Data rather than JSX literals because the summary cards' rule is
 * stated in terms of the LABEL — "if a card reads the same as a tab, it is that tab" — so label
 * equality has to be something a test can check.
 */
export const ORDER_TAB_LABELS: Record<OrderTab, Phrase> = {
  // From the project's documented lifecycle (docs/knowledge/commerce/order-lifecycle.md) wherever it
  // has a word, so a tab, a dashboard card and the docs cannot call one state three things.
  unpaid: { th: "รอชำระเงิน", en: "Unpaid" },
  pending: { th: "รอดำเนินการ", en: "Pending" },
  toship: { th: "เตรียมจัดส่ง", en: "To ship" },
  shipped: { th: "กำลังจัดส่ง", en: "In transit" },
  completed: { th: "สำเร็จ", en: "Completed" },
  cancelfail: { th: "ยกเลิก & ส่งไม่สำเร็จ", en: "Cancel & fail" },
  refundclaim: { th: "คืนเงิน & เคลม", en: "Refund & claim" },
};

/**
 * Which operational statuses each /orders tab holds — a partition, enforced by orderTabs.test.ts.
 *
 * The owner re-sectioned the bar, 2 Aug 2026: the old "Unpaid" waiting-on-money stage splits in two
 * (money not in yet vs a payment decision owed), and the old "Unfinished" grab-bag splits in two
 * (dead orders vs money that may flow back out). It stays a table, not a switch of hand-written
 * predicates, because those predicates drifted before — new statuses belonged to no tab, so they
 * showed in "All" and nowhere else. The table lets the test prove every status has exactly one home.
 *
 * The "All" tab is deliberately absent: it is not a filter.
 */
export const ORDER_TAB_STATUSES: Record<OrderTab, OperationalStatus[]> = {
  // Chose a prepaid method (bank transfer) but the money has not arrived yet.
  unpaid: ["unpaid"],
  // Payment awaiting OUR decision: a COD to approve, or a transfer slip to verify.
  pending: ["cod_pending", "verifying"],
  toship: ["to_ship"],
  shipped: ["in_transit"],
  completed: ["complete"],
  // Never shipped: cancelled or expired (fail), plus a COD the customer refused — a decision point
  // that, left unanswered, ends the same way, so it waits here rather than looking like a live order.
  cancelfail: ["fail", "cod_reject"],
  // Money may have to flow back out: a paid parcel that bounced (ตีกลับ) and the whole claim
  // lifecycle — a claimed order was delivered, but it is not a clean completion.
  refundclaim: ["return", "claim_pending", "claimed", "refunded", "claim_rejected"],
};
