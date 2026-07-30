import { describe, it, expect } from "vitest";
import {
  ORDER_HISTORY_EVENTS,
  isOrderHistoryEvent,
  orderHistoryEventLabel,
  historyEventFor,
  type OrderHistoryEvent,
} from "./orderHistory";

/**
 * Each status change becomes one timeline row, and `event` is the short reason the row exists —
 * it is what the detail page shows as the entry's title. Deriving it from (before → after) rather
 * than having each call site pass a string keeps the vocabulary closed: a caller cannot invent
 * "paid_maybe" and quietly land it in the timeline.
 */
describe("historyEventFor > order creation", () => {
  it("given no previous state > is a created event", () => {
    expect(historyEventFor(null, { orderStatus: "new", paymentStatus: "pending" })).toBe("created");
  });
});

describe("historyEventFor > payment transitions", () => {
  it("pending → paid is a paid event", () => {
    expect(
      historyEventFor(
        { orderStatus: "new", paymentStatus: "pending" },
        { orderStatus: "new", paymentStatus: "paid" },
      ),
    ).toBe("paid");
  });

  it("cod → cod_confirmed is a cod_approved event", () => {
    expect(
      historyEventFor(
        { orderStatus: "new", paymentStatus: "cod" },
        { orderStatus: "new", paymentStatus: "cod_confirmed" },
      ),
    ).toBe("cod_approved");
  });

  it("cod → cod_denied is a cod_denied event", () => {
    expect(
      historyEventFor(
        { orderStatus: "new", paymentStatus: "cod" },
        { orderStatus: "new", paymentStatus: "cod_denied" },
      ),
    ).toBe("cod_denied");
  });

  it("cod_confirmed → cod_collected is a cod_collected event", () => {
    expect(
      historyEventFor(
        { orderStatus: "shipped", paymentStatus: "cod_confirmed" },
        { orderStatus: "delivered", paymentStatus: "cod_collected" },
      ),
    ).toBe("cod_collected");
  });

  it("→ refunded is a refunded event, even when the order status also moved", () => {
    expect(
      historyEventFor(
        { orderStatus: "delivered", paymentStatus: "paid" },
        { orderStatus: "cancelled", paymentStatus: "refunded" },
      ),
    ).toBe("refunded");
  });
});

describe("historyEventFor > fulfillment transitions", () => {
  it("new → confirmed is a confirmed event", () => {
    expect(
      historyEventFor(
        { orderStatus: "new", paymentStatus: "paid" },
        { orderStatus: "confirmed", paymentStatus: "paid" },
      ),
    ).toBe("confirmed");
  });

  it("confirmed → packing is a packing event", () => {
    expect(
      historyEventFor(
        { orderStatus: "confirmed", paymentStatus: "paid" },
        { orderStatus: "packing", paymentStatus: "paid" },
      ),
    ).toBe("packing");
  });

  it("packing → shipped is a shipped event", () => {
    expect(
      historyEventFor(
        { orderStatus: "packing", paymentStatus: "paid" },
        { orderStatus: "shipped", paymentStatus: "paid" },
      ),
    ).toBe("shipped");
  });

  it("shipped → delivered is a delivered event", () => {
    expect(
      historyEventFor(
        { orderStatus: "shipped", paymentStatus: "paid" },
        { orderStatus: "delivered", paymentStatus: "paid" },
      ),
    ).toBe("delivered");
  });

  it("→ cancelled is a cancelled event", () => {
    expect(
      historyEventFor(
        { orderStatus: "packing", paymentStatus: "paid" },
        { orderStatus: "cancelled", paymentStatus: "paid" },
      ),
    ).toBe("cancelled");
  });

  it("the 48h sweep (new+pending → expired+expired) is an expired event", () => {
    expect(
      historyEventFor(
        { orderStatus: "new", paymentStatus: "pending" },
        { orderStatus: "expired", paymentStatus: "expired" },
      ),
    ).toBe("expired");
  });
});

describe("historyEventFor > precedence", () => {
  it("given payment AND fulfillment both moved > reports the money event", () => {
    // Money is the axis the owner chases; a combined move should read as "paid", not "confirmed".
    expect(
      historyEventFor(
        { orderStatus: "new", paymentStatus: "pending" },
        { orderStatus: "confirmed", paymentStatus: "paid" },
      ),
    ).toBe("paid");
  });

  it("given a refund on a cancelled order > refunded outranks cancelled", () => {
    expect(
      historyEventFor(
        { orderStatus: "delivered", paymentStatus: "paid" },
        { orderStatus: "cancelled", paymentStatus: "refunded" },
      ),
    ).toBe("refunded");
  });
});

describe("historyEventFor > non-events", () => {
  it("given nothing changed > returns null so no row is written", () => {
    // A carrier or tracking edit must not add a timeline entry.
    expect(
      historyEventFor(
        { orderStatus: "shipped", paymentStatus: "paid" },
        { orderStatus: "shipped", paymentStatus: "paid" },
      ),
    ).toBeNull();
  });

  it("given a move into a state with no entry of its own > falls back to updated", () => {
    // `pending` has no event: it is only ever the opening state, which `created` already covers.
    // Undoing a payment therefore has no dedicated label and must not be silently dropped.
    expect(
      historyEventFor(
        { orderStatus: "confirmed", paymentStatus: "paid" },
        { orderStatus: "confirmed", paymentStatus: "pending" },
      ),
    ).toBe("updated");
  });

  it("given a backwards fulfillment move > still names the state it landed in", () => {
    // delivered → packing is a correction, not an unknown: `packing` is a real state, and naming it
    // is more useful in the timeline than a generic "updated".
    expect(
      historyEventFor(
        { orderStatus: "delivered", paymentStatus: "paid" },
        { orderStatus: "packing", paymentStatus: "paid" },
      ),
    ).toBe("packing");
  });

  it("tolerates null statuses on legacy rows without throwing", () => {
    expect(
      historyEventFor(
        { orderStatus: null, paymentStatus: null },
        {
          orderStatus: "new",
          paymentStatus: "pending",
        },
      ),
    ).toBe("updated");
  });
});

describe("orderHistoryEventLabel", () => {
  it("gives every event a Thai label for the timeline", () => {
    for (const e of ORDER_HISTORY_EVENTS) {
      const label = orderHistoryEventLabel(e);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("labels created as คำสั่งซื้อใหม่, matching the Shopee reference wording", () => {
    expect(orderHistoryEventLabel("created")).toBe("คำสั่งซื้อใหม่");
  });
});

describe("isOrderHistoryEvent", () => {
  it("accepts every listed event", () => {
    for (const e of ORDER_HISTORY_EVENTS) expect(isOrderHistoryEvent(e)).toBe(true);
  });

  it("rejects an invented event", () => {
    expect(isOrderHistoryEvent("paid_maybe")).toBe(false);
  });

  it("narrows the type for callers", () => {
    const raw: string = "shipped";
    if (isOrderHistoryEvent(raw)) {
      const e: OrderHistoryEvent = raw;
      expect(e).toBe("shipped");
    }
  });
});
