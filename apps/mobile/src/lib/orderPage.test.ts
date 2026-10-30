import { describe, expect, it } from "vitest";
import {
  activeClaim,
  addressLine,
  canDo,
  claimOutcome,
  claimStep,
  deliveryNow,
  finishedClaims,
  jobFor,
  pageSections,
  pinsTracking,
  progressStep,
  readDropOff,
  slipRow,
} from "./orderPage";
import type { OrderClaim } from "./ordersApi";

const claim = (over: Partial<OrderClaim>): OrderClaim => ({
  id: "c1",
  kind: "defect",
  state: "requested",
  reasonNote: null,
  resolution: "exchange",
  mechanicName: null,
  adminNote: null,
  assigneeName: null,
  carrier: null,
  trackingNo: null,
  shippingFeeSatang: null,
  createdAt: 1,
  photoKeys: [],
  lines: [],
  replacementAddress: null,
  ...over,
});

const page = (
  orderStatus: string | null,
  paymentStatus: string | null,
  extra: { claims?: OrderClaim[]; refundAction?: "needs_refund" | "refunded" | "none" } = {},
) => ({
  order: { orderStatus, paymentStatus },
  claims: extra.claims ?? [],
  refundAction: extra.refundAction ?? "none",
});

describe("jobFor", () => {
  it("given each status that waits on the shop > then its one job is chosen", () => {
    expect(jobFor(page("new", "verifying"))).toBe("pay");
    expect(jobFor(page("new", "cod"))).toBe("cod");
    expect(jobFor(page("new", "paid"))).toBe("ship");
    expect(jobFor(page("delivery_failed", "paid", { refundAction: "needs_refund" }))).toBe(
      "refund",
    );
    expect(jobFor(page("claim_pending", "paid", { claims: [claim({ state: "received" })] }))).toBe(
      "claim",
    );
  });

  it("given an order nobody has to act on > then there is no job box", () => {
    expect(jobFor(page("new", "pending"))).toBeNull();
    expect(jobFor(page("shipped", "paid"))).toBeNull();
    expect(jobFor(page("delivered", "paid"))).toBeNull();
    expect(jobFor(page("cancelled", "pending"))).toBeNull();
    expect(jobFor(page("delivery_failed", "cod", { refundAction: "none" }))).toBeNull();
  });

  it("given a claim that is finished > then the claim no longer asks for anything", () => {
    expect(jobFor(page("claimed", "paid", { claims: [claim({ state: "done" })] }))).toBeNull();
  });
});

describe("activeClaim", () => {
  it("given a rejected claim not yet sent back > then it is still open", () => {
    const c = claim({ state: "mechanic_rejected" });
    expect(activeClaim([c])).toBe(c);
    expect(activeClaim([{ ...c, trackingNo: "TH1" }])).toBeNull();
  });
});

describe("claimStep", () => {
  it("given each claim state > then the next step is the one the web shows", () => {
    expect(claimStep(claim({ state: "requested" }))).toBe("receive");
    expect(claimStep(claim({ state: "received" }))).toBe("review");
    expect(claimStep(claim({ state: "mechanic_approved", resolution: "refund" }))).toBe("refund");
    expect(claimStep(claim({ state: "mechanic_approved", resolution: "exchange" }))).toBe(
      "replace",
    );
    expect(claimStep(claim({ state: "mechanic_rejected" }))).toBe("sendBack");
  });
});

describe("canDo", () => {
  it("given the web's roles > then payment and COD are owner or admin, claims owner or mechanic", () => {
    expect(canDo("pay", "admin")).toBe(true);
    expect(canDo("pay", "mechanic")).toBe(false);
    expect(canDo("cod", "super_admin")).toBe(true);
    expect(canDo("claim", "mechanic")).toBe(true);
    expect(canDo("claim", "admin")).toBe(false);
    expect(canDo("ship", "mechanic")).toBe(true);
  });

  it("given a refund > then only the owner may record it", () => {
    expect(canDo("refund", "super_admin")).toBe(true);
    expect(canDo("refund", "admin")).toBe(false);
  });
});

describe("progressStep", () => {
  it("given the main path > then the strip lights the step the order is on", () => {
    expect(progressStep("new", "pending")).toBe(1);
    expect(progressStep("new", "verifying")).toBe(1);
    expect(progressStep("new", "paid")).toBe(2);
    expect(progressStep("shipped", "paid")).toBe(3);
    expect(progressStep("delivered", "paid")).toBe(4);
  });

  it("given an order off the main path > then there is no strip", () => {
    expect(progressStep("delivery_failed", "paid")).toBeNull();
    expect(progressStep("claim_pending", "paid")).toBeNull();
    expect(progressStep("cancelled", "pending")).toBeNull();
  });
});

describe("readDropOff", () => {
  it("given a scanned number and a cost in baht > then it is ready to save, in satang", () => {
    expect(readDropOff("Flash Express", " TH0127 ", "1,060.5")).toEqual({
      ok: true,
      value: { carrier: "Flash Express", trackingNo: "TH0127", shippingRealSatang: 106050 },
    });
  });

  it("given no tracking number > then it says which field is missing", () => {
    expect(readDropOff("Flash Express", "  ", "60")).toEqual({ ok: false, missing: "tracking" });
  });

  it("given no cost, or a cost that is not a number > then the cost is missing", () => {
    expect(readDropOff("Flash Express", "TH1", "")).toEqual({ ok: false, missing: "fee" });
    expect(readDropOff("Flash Express", "TH1", "abc")).toEqual({ ok: false, missing: "fee" });
    expect(readDropOff("Flash Express", "TH1", "-5")).toEqual({ ok: false, missing: "fee" });
  });

  it("given a free drop-off > then zero is a real cost", () => {
    expect(readDropOff("Flash Express", "TH1", "0")).toMatchObject({ ok: true });
  });
});

describe("addressLine", () => {
  it("given an address > then it reads as one line, skipping empty parts", () => {
    expect(
      addressLine({
        recipientName: "สุดา",
        phone: "089",
        addressLine1: "45/7 ถ.รัตนาธิเบศร์",
        subdistrict: "บางกระสอ",
        district: null,
        province: "นนทบุรี",
        postalCode: "11000",
      }),
    ).toBe("45/7 ถ.รัตนาธิเบศร์ บางกระสอ นนทบุรี 11000");
  });
});

describe("finishedClaims", () => {
  it("given an open claim and finished ones > then only the finished ones are summed up", () => {
    const open = claim({ id: "open", state: "received" });
    const shipped = claim({ id: "shipped", state: "shipped", trackingNo: "TH1" });
    const returned = claim({ id: "returned", state: "mechanic_rejected", trackingNo: "TH2" });
    const owed = claim({ id: "owed", state: "mechanic_rejected" });
    expect(finishedClaims([open, shipped, returned, owed]).map((c) => c.id)).toEqual([
      "shipped",
      "returned",
    ]);
  });
});

describe("claimOutcome", () => {
  it("given a replacement handed to the carrier > then it was replaced", () => {
    expect(claimOutcome(claim({ state: "shipped", trackingNo: "TH1" }))).toBe("replaced");
  });

  it("given a rejected claim whose part went back > then it was returned, even if they asked for money", () => {
    expect(
      claimOutcome(claim({ state: "mechanic_rejected", resolution: "refund", trackingNo: "TH2" })),
    ).toBe("returned");
  });

  it("given a refund claim that finished > then it was refunded", () => {
    expect(claimOutcome(claim({ state: "done", resolution: "refund" }))).toBe("refunded");
  });

  it("given a claim closed without shipping or money > then it was only closed", () => {
    expect(claimOutcome(claim({ state: "cancelled", resolution: "refund" }))).toBe("closed");
  });
});

describe("pageSections", () => {
  it("given any order > then Shopee's order: where it goes, the parcel, items, payment, files, customer, then the quiet actions", () => {
    expect(pageSections()).toEqual([
      "address",
      "delivery",
      "items",
      "payment",
      "files",
      "customer",
      "actions",
    ]);
  });

  it("given any order > then the timeline and the money detail are not on the main page (they sit behind ›)", () => {
    expect(pageSections()).not.toContain("timeline");
    expect(pageSections()).not.toContain("money");
  });
});

describe("deliveryNow", () => {
  const order = (over: Partial<Parameters<typeof deliveryNow>[0]>) => ({
    orderStatus: "processing",
    paymentStatus: "paid",
    carrier: null,
    trackingNo: null,
    shipTimeMs: null,
    ...over,
  });

  it("given no parcel yet > then it says not sent, with no parcel line and no time", () => {
    expect(deliveryNow(order({}), [])).toEqual({ parcel: null, step: "notSent", at: null });
  });

  it("given a parcel on its way > then carrier and number, in transit, at the hand-over time", () => {
    expect(
      deliveryNow(
        order({
          orderStatus: "shipped",
          carrier: "Flash Express",
          trackingNo: "TH1",
          shipTimeMs: 50,
        }),
        [],
      ),
    ).toEqual({ parcel: "Flash Express · TH1", step: "inTransit", at: 50 });
  });

  it("given a delivered parcel > then delivered, at the delivered event", () => {
    expect(
      deliveryNow(
        order({ orderStatus: "delivered", carrier: "Flash Express", trackingNo: "TH1" }),
        [
          { event: "shipped", createdAt: 50 },
          { event: "delivered", createdAt: 90 },
        ],
      ),
    ).toEqual({ parcel: "Flash Express · TH1", step: "delivered", at: 90 });
  });

  it("given a claim after delivery > then the parcel still reads delivered", () => {
    expect(
      deliveryNow(
        order({ orderStatus: "claim_pending", carrier: "Flash Express", trackingNo: "TH1" }),
        [],
      ).step,
    ).toBe("delivered");
  });

  it("given a bounced parcel with no bounce event > then bounced, and no time is made up", () => {
    expect(
      deliveryNow(
        order({ orderStatus: "delivery_failed", carrier: "Flash Express", trackingNo: "TH1" }),
        [],
      ),
    ).toEqual({ parcel: "Flash Express · TH1", step: "bounced", at: null });
  });

  it("given a tracking number but no carrier > then the line is just the number", () => {
    expect(deliveryNow(order({ orderStatus: "shipped", trackingNo: "TH1" }), []).parcel).toBe(
      "TH1",
    );
  });
});

describe("pinsTracking", () => {
  it("given an order in transit with a trackable carrier and nothing to do > then the track button is pinned", () => {
    expect(
      pinsTracking({ orderStatus: "shipped", paymentStatus: "paid", trackUrl: "https://x" }, null),
    ).toBe(true);
  });

  it("given a carrier with no tracking page > then nothing is pinned", () => {
    expect(
      pinsTracking({ orderStatus: "shipped", paymentStatus: "paid", trackUrl: null }, null),
    ).toBe(false);
  });

  it("given a delivered order > then nothing is pinned", () => {
    expect(
      pinsTracking(
        { orderStatus: "delivered", paymentStatus: "paid", trackUrl: "https://x" },
        null,
      ),
    ).toBe(false);
  });

  it("given a job waiting > then the job's own buttons win", () => {
    expect(
      pinsTracking(
        { orderStatus: "shipped", paymentStatus: "paid", trackUrl: "https://x" },
        "claim",
      ),
    ).toBe(false);
  });
});

describe("slipRow", () => {
  it("given a slip and the owner > then the row opens the slip's own page", () => {
    expect(slipRow({ available: true }, true)).toEqual({ opens: true, note: "ownerOnly" });
  });

  it("given a slip and other staff > then the row says who may see it, with no way in", () => {
    expect(slipRow({ available: true }, false)).toEqual({ opens: false, note: "ownerOnly" });
  });

  it("given no slip sent yet > then the row says so and opens nothing", () => {
    expect(slipRow({ available: false }, true)).toEqual({ opens: false, note: "none" });
  });

  it("given cash on delivery > then there is no slip row at all", () => {
    expect(slipRow(undefined, true)).toBeNull();
  });
});
