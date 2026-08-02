import { describe, it, expect } from "vitest";
import { OPERATIONAL_STATUSES } from "@l-shopee/core";
import { ORDER_SUMMARY_CARDS, cardIsWholeTab, orderSummaryCardLabel } from "./orderSummaryCards";
import { ORDER_TAB_LABELS, ORDER_TAB_STATUSES } from "./orderTabs";

/**
 * The owner re-sectioned the summary frame, 2 Aug 2026: a card is now a section that may gather
 * several operational statuses (Pending = COD pending + Payment pending; Refund = a bounced parcel
 * plus every claim order), while To ship and In transit stay one status each.
 *
 * Two invariants keep a section honest, and both failures they guard against have bitten before: a
 * card must not count an order another card already counts (or the numbers double), and a card must
 * only count statuses that live in the tab it opens (or clicking it lands on a view that hides them).
 */

const byKey = (k: string) => ORDER_SUMMARY_CARDS.find((c) => c.key === k)!;

describe("order summary cards > every status a card counts is real", () => {
  it("each card counts at least one status, all of them real operational statuses", () => {
    for (const card of ORDER_SUMMARY_CARDS) {
      expect(card.statuses.length).toBeGreaterThan(0);
      for (const s of card.statuses) expect(OPERATIONAL_STATUSES).toContain(s);
    }
  });

  it("no status is counted by two cards, so a count can never double", () => {
    const seen = new Set<string>();
    for (const card of ORDER_SUMMARY_CARDS) {
      for (const s of card.statuses) {
        expect(seen.has(s)).toBe(false);
        seen.add(s);
      }
    }
  });

  it("keys are unique, so the active card can never be ambiguous", () => {
    const keys = ORDER_SUMMARY_CARDS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("order summary cards > the owner's sections", () => {
  it("reads Pending · To ship · In transit · Refund, in that order", () => {
    expect(ORDER_SUMMARY_CARDS.map(orderSummaryCardLabel)).toEqual([
      "Pending",
      "To ship",
      "In transit",
      "Refund",
    ]);
  });

  it("Pending gathers COD pending and Payment pending", () => {
    expect([...byKey("pending").statuses].sort()).toEqual(["cod_pending", "verifying"]);
  });

  it("Refund gathers the bounced parcel and every claim status, but not fail", () => {
    expect([...byKey("refund").statuses].sort()).toEqual([
      "claim_pending",
      "claim_rejected",
      "claimed",
      "refunded",
      "return",
    ]);
    expect(byKey("refund").statuses).not.toContain("fail");
  });

  it("To ship and In transit each count exactly their one status", () => {
    expect(byKey("toship").statuses).toEqual(["to_ship"]);
    expect(byKey("intransit").statuses).toEqual(["in_transit"]);
  });
});

describe("order summary cards > clicking one cannot land on a view that hides it", () => {
  it("every status a card counts lives in the tab that card opens", () => {
    for (const card of ORDER_SUMMARY_CARDS) {
      for (const s of card.statuses) {
        expect(ORDER_TAB_STATUSES[card.tab]).toContain(s);
      }
    }
  });

  it("To ship and In transit are whole tabs; Pending and Refund are slices", () => {
    expect(cardIsWholeTab(byKey("toship"))).toBe(true);
    expect(cardIsWholeTab(byKey("intransit"))).toBe(true);
    // Both sit inside tabs that hold more than they count, so they show LESS than the tab — which is
    // why they keep their own highlight instead of just selecting the tab.
    expect(cardIsWholeTab(byKey("pending"))).toBe(false);
    expect(cardIsWholeTab(byKey("refund"))).toBe(false);
  });

  it("a whole-tab card's label equals its tab's label; a slice's differs", () => {
    // The owner's original rule, still true: same label ⇒ same page. A whole-tab card is that tab, so
    // it may share its name; a slice must not, or the two would disagree about what the page shows.
    for (const card of ORDER_SUMMARY_CARDS) {
      if (cardIsWholeTab(card)) {
        expect(orderSummaryCardLabel(card)).toBe(ORDER_TAB_LABELS[card.tab]);
      } else {
        expect(orderSummaryCardLabel(card)).not.toBe(ORDER_TAB_LABELS[card.tab]);
      }
    }
  });
});
