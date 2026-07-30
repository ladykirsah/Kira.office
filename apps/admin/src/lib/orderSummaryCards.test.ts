import { describe, it, expect } from "vitest";
import { OPERATIONAL_STATUSES, operationalStatusLabel } from "@l-shopee/core";
import { ORDER_SUMMARY_CARDS, cardIsWholeTab, orderSummaryCardLabel } from "./orderSummaryCards";
import { ORDER_TAB_LABELS, ORDER_TAB_STATUSES } from "./orderTabs";

/**
 * The owner's rule for the summary frame, 30 Jul 2026:
 *
 *   "all summary frame match a status as one of filter feature"
 *   "if they are the same label as the menu bar, they the same page —
 *    summary frame is just shortcut for some often use"
 *
 * These tests hold both halves of it, because the failure they prevent already happened: the cards
 * said "To be shipped" and "COD approval" while the statuses they filtered by were called "To ship"
 * and "COD pending", so a shortcut was labelled differently from the thing it was a shortcut to.
 */

describe("order summary cards > every card is one real status", () => {
  it("each card's status is one of the thirteen operational statuses", () => {
    for (const card of ORDER_SUMMARY_CARDS) {
      expect(OPERATIONAL_STATUSES).toContain(card.status);
    }
  });

  it("no two cards count the same status", () => {
    const statuses = ORDER_SUMMARY_CARDS.map((c) => c.status);
    expect(new Set(statuses).size).toBe(statuses.length);
  });

  it("keys are unique, so the active card can never be ambiguous", () => {
    const keys = ORDER_SUMMARY_CARDS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("order summary cards > the label comes from the status", () => {
  it("reads exactly what the Status column and the Filter dropdown read", () => {
    for (const card of ORDER_SUMMARY_CARDS) {
      expect(orderSummaryCardLabel(card)).toBe(operationalStatusLabel(card.status));
    }
  });

  it("the two the owner renamed now match their status", () => {
    // These are the actual corrections: "COD approval" → "COD pending", "To be shipped" → "To ship".
    const byKey = (k: string) => ORDER_SUMMARY_CARDS.find((c) => c.key === k)!;
    expect(orderSummaryCardLabel(byKey("cod"))).toBe("COD pending");
    expect(orderSummaryCardLabel(byKey("toship"))).toBe("To ship");
  });
});

describe("order summary cards > clicking one cannot land on a view that hides it", () => {
  it("every card's status lives in the tab that card opens", () => {
    // The bug this forbids: a card counting 1 that opens a tab whose filter excludes that order, so
    // the number says 1 and the table says none.
    for (const card of ORDER_SUMMARY_CARDS) {
      expect(ORDER_TAB_STATUSES[card.tab]).toContain(card.status);
    }
  });

  it("a card whose label matches its tab's label IS that whole tab", () => {
    // The owner's rule stated precisely: same label ⇒ same page. If a card ever gets a label equal to
    // a tab's while filtering to less than that tab holds, the two would disagree about what the page
    // shows, and this fails.
    for (const card of ORDER_SUMMARY_CARDS) {
      if (orderSummaryCardLabel(card) === ORDER_TAB_LABELS[card.tab]) {
        expect(ORDER_TAB_STATUSES[card.tab]).toEqual([card.status]);
        expect(cardIsWholeTab(card)).toBe(true);
      }
    }
  });

  it("To ship and In transit are whole tabs; COD pending and Return are slices", () => {
    const byKey = (k: string) => ORDER_SUMMARY_CARDS.find((c) => c.key === k)!;
    expect(cardIsWholeTab(byKey("toship"))).toBe(true);
    expect(cardIsWholeTab(byKey("shipped"))).toBe(true);
    // Both sit inside tabs that hold several statuses, so they show LESS than the tab — which is why
    // they keep their own highlight instead of just selecting the tab.
    expect(cardIsWholeTab(byKey("cod"))).toBe(false);
    expect(cardIsWholeTab(byKey("returns"))).toBe(false);
  });

  it("a slice card's label differs from its tab's label, so the rule stays consistent", () => {
    for (const card of ORDER_SUMMARY_CARDS) {
      if (!cardIsWholeTab(card)) {
        expect(orderSummaryCardLabel(card)).not.toBe(ORDER_TAB_LABELS[card.tab]);
      }
    }
  });
});
