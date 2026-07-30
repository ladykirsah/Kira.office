import type { OperationalStatus } from "@l-shopee/core";

export type OrderTab = "unpaid" | "toship" | "shipped" | "completed" | "unfinished";

/**
 * Which operational statuses each /orders tab holds — a partition, enforced by orderTabs.test.ts.
 *
 * This is data rather than a switch of hand-written predicates because the predicates drifted: when
 * the vocabulary grew the new statuses belonged to no tab, so they appeared in "All" and nowhere
 * else, and Unfinished under-counted. Keeping it as a table means the test can prove every status
 * has exactly one home.
 *
 * The "All" tab is deliberately absent: it is not a filter.
 */
/**
 * What each tab is called. Data rather than JSX literals because the owner's rule for the summary
 * cards is stated in terms of the LABEL — "if they are the same label as the menu bar, they are the
 * same page" — so label equality has to be something a test can check.
 */
export const ORDER_TAB_LABELS: Record<OrderTab, string> = {
  unpaid: "Unpaid",
  toship: "To ship",
  shipped: "In transit",
  completed: "Completed",
  unfinished: "Unfinished",
};

export const ORDER_TAB_STATUSES: Record<OrderTab, OperationalStatus[]> = {
  // The whole waiting-on-money stage: nothing paid, a slip under review, a COD decision outstanding,
  // or a COD we refused that the customer has yet to answer.
  unpaid: ["unpaid", "verifying", "cod_pending", "cod_reject"],
  toship: ["to_ship"],
  shipped: ["in_transit"],
  completed: ["complete"],
  // Anything that did not end cleanly: cancelled or expired, a parcel that bounced (ตีกลับ), and the
  // whole claim lifecycle — a claimed order was delivered, but it is not a clean completion.
  unfinished: ["fail", "return", "claim_pending", "claimed", "refunded", "claim_rejected"],
};
