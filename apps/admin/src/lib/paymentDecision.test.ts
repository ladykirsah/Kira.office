import { describe, it, expect } from "vitest";
import { canDecidePayment } from "./paymentDecision";

describe("canDecidePayment", () => {
  it("given a slip and the right role > the decision is offered", () => {
    expect(canDecidePayment(true, "slip/o1/abc.jpg")).toBe(true);
  });

  it("given NO slip attached > the decision is not offered, whatever the role", () => {
    // The owner's rule, 27 Aug 2026: there is nothing to confirm or reject until the customer has
    // actually sent something. Approving an empty review is approving a payment nobody has evidence
    // of — and the order then walks forward into packing on that.
    expect(canDecidePayment(true, null)).toBe(false);
  });

  it("given an empty or blank key > treats it as no slip", () => {
    // A blank string is what an empty column reads as once it has been round-tripped through JSON
    // and a form; it is not a file.
    expect(canDecidePayment(true, "")).toBe(false);
    expect(canDecidePayment(true, "   ")).toBe(false);
  });

  it("given the wrong role > the decision is not offered even with a slip", () => {
    expect(canDecidePayment(false, "slip/o1/abc.jpg")).toBe(false);
  });
});
