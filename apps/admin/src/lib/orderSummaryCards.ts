import { operationalStatusLabel, type OperationalStatus } from "@l-shopee/core";
import { ORDER_TAB_STATUSES, type OrderTab } from "./orderTabs";

/**
 * The four summary cards above the /orders table.
 *
 * The owner's rule, 30 Jul 2026: **every card is one status**, the same status the Filter dropdown
 * offers and the Status column prints — and where a card's label matches a tab's label, the card and
 * the tab are the same page. So the label is DERIVED from the status, never typed here. Hand-written
 * labels are what let "To be shipped" and "COD approval" drift away from the "To ship" and "COD
 * pending" they were meant to be a shortcut to.
 *
 * `tab` is the tab that contains the card's status — never a guess: orderSummaryCards.test.ts proves
 * the status really is in that tab, so a card can never open a view that excludes what it counted.
 */
export interface OrderSummaryCard {
  key: "cod" | "toship" | "shipped" | "returns";
  status: OperationalStatus;
  tab: OrderTab;
  /** Colour for a non-zero count. Zero always reads faint — nothing is waiting, so nothing shouts. */
  activeColor: string;
}

export const ORDER_SUMMARY_CARDS: readonly OrderSummaryCard[] = [
  { key: "cod", status: "cod_pending", tab: "unpaid", activeColor: "var(--warn)" },
  { key: "toship", status: "to_ship", tab: "toship", activeColor: "#2563eb" },
  { key: "shipped", status: "in_transit", tab: "shipped", activeColor: "#2563eb" },
  { key: "returns", status: "return", tab: "unfinished", activeColor: "var(--danger)" },
];

/** What the card says — the status's own label, so it can never disagree with the column or the tab. */
export function orderSummaryCardLabel(card: OrderSummaryCard): string {
  return operationalStatusLabel(card.status);
}

/**
 * Is this card simply a shortcut to its whole tab, rather than a narrower slice of it?
 *
 * True when the tab holds exactly this one status — To ship and In transit. False for COD pending and
 * Return, which are single statuses inside tabs that hold several, so clicking them shows less than
 * the tab does.
 */
export function cardIsWholeTab(card: OrderSummaryCard): boolean {
  const statuses = ORDER_TAB_STATUSES[card.tab];
  return statuses.length === 1 && statuses[0] === card.status;
}
