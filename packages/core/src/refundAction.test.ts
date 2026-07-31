import { describe, it, expect } from "vitest";
import { classifyRefundAction, type RefundActionInput } from "./refundAction";

/**
 * The narrowed refund rule the owner set: ONLY a failed delivery of a paid order gets money back in
 * the system; everything else is handled via LINE OA. A refund we have paid shows as done, and one
 * left unclaimed for over a year is forfeited — we keep the money and it leaves the queue.
 */

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const NOW = 1_785_000_000_000; // a fixed clock; no Date.now in tests

/** A paid parcel that bounced an hour ago and has not been refunded. */
const BOUNCED_PAID: RefundActionInput = {
  orderStatus: "delivery_failed",
  paymentStatus: "paid",
  refundedAt: null,
  failedAt: NOW - 60 * 60 * 1000,
};

describe("classifyRefundAction > the one refund path", () => {
  it("delivery_failed + paid + not refunded + fresh > needs refund", () => {
    expect(classifyRefundAction(BOUNCED_PAID, NOW)).toBe("needs_refund");
  });

  it("already paid back (refundedAt set) > refunded, no action", () => {
    expect(classifyRefundAction({ ...BOUNCED_PAID, refundedAt: NOW - 1000 }, NOW)).toBe("refunded");
  });
});

describe("classifyRefundAction > when it must NOT fire", () => {
  it("a bounce we were never paid for (unpaid COD) > none", () => {
    // COD that bounced was never collected — there is no money of theirs to return.
    expect(classifyRefundAction({ ...BOUNCED_PAID, paymentStatus: "cod_denied" }, NOW)).toBe(
      "none",
    );
  });

  it("a paid order that did NOT fail delivery > none (handled via LINE OA if a return/claim)", () => {
    expect(classifyRefundAction({ ...BOUNCED_PAID, orderStatus: "claim_pending" }, NOW)).toBe(
      "none",
    );
  });
});

describe("classifyRefundAction > the 1-year forfeiture window", () => {
  it("just under a year unclaimed > still needs refund", () => {
    expect(classifyRefundAction({ ...BOUNCED_PAID, failedAt: NOW - (YEAR_MS - 1000) }, NOW)).toBe(
      "needs_refund",
    );
  });

  it("over a year unclaimed > none, we keep the money", () => {
    expect(classifyRefundAction({ ...BOUNCED_PAID, failedAt: NOW - (YEAR_MS + 1000) }, NOW)).toBe(
      "none",
    );
  });

  it("failed date unknown > still needs refund, never silently forfeited", () => {
    // We only keep the money when we can PROVE a year has passed; an absent timestamp must not read
    // as expired, or a real obligation to the customer would vanish on missing data.
    expect(classifyRefundAction({ ...BOUNCED_PAID, failedAt: null }, NOW)).toBe("needs_refund");
  });
});
