import { describe, it, expect } from "vitest";
import { OPERATIONAL_STATUSES } from "@l-shopee/core";
import {
  ORDER_SUMMARY_CARDS,
  cardIsWholeTab,
  orderSummaryCardLabel,
  summaryCardCounts,
  summaryCardHref,
  summaryCardFromKey,
} from "./orderSummaryCards";
import { ORDER_TAB_LABELS, ORDER_TAB_STATUSES } from "./orderTabs";

/**
 * The owner re-sectioned the summary frame, 2 Aug 2026: a card is now a section that may gather
 * several operational statuses (Pending = COD pending + BC pending; Refund = a bounced parcel
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
      { th: "รอดำเนินการ", en: "Pending" },
      { th: "เตรียมจัดส่ง", en: "To ship" },
      { th: "กำลังจัดส่ง", en: "In transit" },
      { th: "คืนเงิน", en: "Refund" },
    ]);
  });

  it("Pending gathers COD pending and BC pending", () => {
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

  it("every card is a whole-tab shortcut after the 2 Aug re-section", () => {
    // Each card's statuses are now exactly one tab's, so clicking a card just selects that tab.
    for (const card of ORDER_SUMMARY_CARDS) {
      expect(cardIsWholeTab(card)).toBe(true);
    }
  });

  it("a card that reads the same as its tab IS that whole tab", () => {
    // The owner's rule, one-directional: same label ⇒ same page. A card MAY name itself differently
    // from the tab it opens (Refund → the "Refund & claim" tab), but if the names match the card must
    // show exactly what that tab shows, or two things with one name would disagree about the page.
    for (const card of ORDER_SUMMARY_CARDS) {
      const label = orderSummaryCardLabel(card);
      const tab = ORDER_TAB_LABELS[card.tab];
      if (label.en === tab.en && label.th === tab.th) {
        expect(cardIsWholeTab(card)).toBe(true);
      }
    }
  });
});

/**
 * The dashboard duplicates this frame, so it needs the same three answers, from pure code the way the
 * /orders table gets them: how many orders sit in each section, where a card links, and — for the
 * reverse trip — which card a `?card=` deep-link names. Counting here rather than on the page keeps
 * the dashboard and the table reading one number for one status.
 */
const mk = (channel: string, orderStatus: string | null, paymentStatus: string | null) => ({
  channel,
  orderStatus,
  paymentStatus,
});

describe("summaryCardCounts > groups the same way the /orders cards do", () => {
  it("counts each airplus order under exactly the card that owns its status", () => {
    const orders = [
      mk("airplus", "new", "cod"), // cod_pending → Pending
      mk("airplus", "new", "verifying"), // verifying   → Pending
      mk("airplus", "new", "paid"), // to_ship     → To ship
      mk("airplus", "shipped", "paid"), // in_transit  → In transit
      mk("airplus", "delivery_failed", "paid"), // return      → Refund
      mk("airplus", "claim_pending", "paid"), // claim_pending → Refund
    ];
    expect(summaryCardCounts(orders)).toEqual({
      pending: 2,
      toship: 1,
      intransit: 1,
      refund: 2,
    });
  });

  it("ignores non-airplus orders even when their status would match a card", () => {
    const orders = [mk("shopee", "new", "cod"), mk("airplus", "new", "cod")];
    expect(summaryCardCounts(orders).pending).toBe(1);
  });

  it("counts nothing for a status no card owns (fail) or that cannot be derived (null)", () => {
    const orders = [
      mk("airplus", "cancelled", "paid"), // fail — belongs to no card
      mk("airplus", null, null), // underivable
    ];
    expect(summaryCardCounts(orders)).toEqual({
      pending: 0,
      toship: 0,
      intransit: 0,
      refund: 0,
    });
  });

  it("returns a zero for every card key, so the frame always has all four to render", () => {
    const counts = summaryCardCounts([]);
    for (const card of ORDER_SUMMARY_CARDS) {
      expect(counts[card.key]).toBe(0);
    }
  });
});

describe("summaryCardHref + summaryCardFromKey > the deep-link round-trips", () => {
  it("a card links to /orders carrying its own key", () => {
    for (const card of ORDER_SUMMARY_CARDS) {
      expect(summaryCardHref(card)).toBe(`/orders?card=${card.key}`);
    }
  });

  it("the key a card links with resolves back to that same card", () => {
    for (const card of ORDER_SUMMARY_CARDS) {
      expect(summaryCardFromKey(card.key)).toBe(card);
    }
  });

  it("an unknown or missing key resolves to no card, so a junk ?card= just falls back", () => {
    expect(summaryCardFromKey("nope")).toBeUndefined();
    expect(summaryCardFromKey(null)).toBeUndefined();
    expect(summaryCardFromKey(undefined)).toBeUndefined();
  });
});
