import { operationalStatus, type OperationalStatus } from "@l-shopee/core";
import { ORDER_TAB_STATUSES, type OrderTab } from "./orderTabs";

/** The key a card is identified by in state and in the `?card=` deep-link. */
export type SummaryCardKey = OrderSummaryCard["key"];

/**
 * The four summary cards above the /orders table.
 *
 * The owner re-sectioned them, 2 Aug 2026: a card is now a **section** that can gather several
 * operational statuses, not one status apiece. "Pending" is COD pending + BC pending; "Refund"
 * is a bounced parcel (ตีกลับ) plus every claim order. "To ship" and "In transit" stay a single
 * status each. So the label is explicit here rather than derived — a group has no single status to
 * borrow a name from — and each card carries the *set* of statuses it counts.
 *
 * Two rules the tests still hold, because they are what keep a shortcut honest:
 *   - the sets are disjoint, so no order is counted by two cards and the numbers never double;
 *   - every status a card counts lives in the tab that card opens, so clicking a card can never land
 *     on a view that hides what it counted.
 */
export interface OrderSummaryCard {
  key: "pending" | "toship" | "intransit" | "refund";
  /** What the card says. Explicit because a multi-status section has no single status label to use. */
  label: string;
  /** The operational statuses this card counts. One for a single-status card, several for a group. */
  statuses: readonly OperationalStatus[];
  /** The tab this card opens — always one that contains every status in `statuses`. */
  tab: OrderTab;
  /** Colour for a non-zero count. Zero always reads faint — nothing is waiting, so nothing shouts. */
  activeColor: string;
}

export const ORDER_SUMMARY_CARDS: readonly OrderSummaryCard[] = [
  // Waiting on a payment decision — a slip to review (verifying) or a COD to approve.
  {
    key: "pending",
    label: "Pending",
    statuses: ["cod_pending", "verifying"],
    tab: "pending",
    activeColor: "var(--warn)",
  },
  { key: "toship", label: "To ship", statuses: ["to_ship"], tab: "toship", activeColor: "#2563eb" },
  {
    key: "intransit",
    label: "In transit",
    statuses: ["in_transit"],
    tab: "shipped",
    activeColor: "#2563eb",
  },
  // A paid parcel that bounced back, plus the whole claim lifecycle (pending → claimed → refunded /
  // rejected). Everything money might have to flow back out of — the one bucket `fail` stays out of.
  {
    key: "refund",
    label: "Refund",
    statuses: ["return", "claim_pending", "claimed", "refunded", "claim_rejected"],
    tab: "refundclaim",
    activeColor: "var(--danger)",
  },
];

/** What the card says — its explicit section name. */
export function orderSummaryCardLabel(card: OrderSummaryCard): string {
  return card.label;
}

/**
 * Is this card simply a shortcut to its whole tab, rather than a narrower slice of it?
 *
 * Since the 2 Aug tab re-section every card lines up with a tab exactly — Pending, To ship, In
 * transit and Refund are all whole-tab shortcuts — so this is true for each current card. It stays a
 * computed check rather than a flag because a later card that counts only part of a tab must still be
 * caught, and the tests lean on it to hold the "same label ⇒ same page" rule.
 */
export function cardIsWholeTab(card: OrderSummaryCard): boolean {
  const tabStatuses = ORDER_TAB_STATUSES[card.tab];
  return (
    tabStatuses.length === card.statuses.length &&
    tabStatuses.every((s) => card.statuses.includes(s))
  );
}

/** The order fields the counts read. Structural on purpose, so this stays free of api.ts (any
 *  OrderRow satisfies it) and the counter can be unit-tested on tiny literals. */
type SummaryCountable = {
  channel: string;
  orderStatus: string | null;
  paymentStatus: string | null;
};

/**
 * How many orders sit in each section — the dashboard's copy of the /orders frame reads these.
 *
 * Same rules the table's `countOf` follows: AirPlus only, and an order is placed by its DERIVED
 * operational status, not its raw order_status. `break` after the first owning card is safe because
 * the sections are disjoint (held by orderSummaryCards.test.ts) — a status lives under one card or
 * none (fail, and any underivable row, are counted by nobody). Every key is present, seeded to 0, so
 * the frame always has four numbers to render even on an empty shop.
 */
export function summaryCardCounts(
  orders: readonly SummaryCountable[],
): Record<SummaryCardKey, number> {
  const counts = Object.fromEntries(ORDER_SUMMARY_CARDS.map((c) => [c.key, 0])) as Record<
    SummaryCardKey,
    number
  >;
  for (const o of orders) {
    if (o.channel !== "airplus") continue;
    const s = operationalStatus(o.orderStatus, o.paymentStatus);
    if (s == null) continue;
    for (const card of ORDER_SUMMARY_CARDS) {
      if (card.statuses.includes(s)) {
        counts[card.key]++;
        break;
      }
    }
  }
  return counts;
}

/** Where a card links from the dashboard: /orders, carrying the key OrdersTable reads on load. */
export function summaryCardHref(card: OrderSummaryCard): string {
  return `/orders?card=${card.key}`;
}

/** The card a `?card=` value names, or undefined when it names nothing — so a junk param just
 *  falls back to the default /orders view instead of throwing. */
export function summaryCardFromKey(key: string | null | undefined): OrderSummaryCard | undefined {
  return ORDER_SUMMARY_CARDS.find((c) => c.key === key);
}
