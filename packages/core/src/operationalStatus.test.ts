import { describe, it, expect } from "vitest";
import {
  OPERATIONAL_STATUSES,
  operationalStatus,
  operationalStatusLabel,
  type OperationalStatus,
} from "./operationalStatus";

/**
 * The Status column on /orders shows the ONE state the owner cares about operationally, which is not
 * the same thing as the `order_status` column: an order sitting at new+pending is waiting on the
 * customer to pay, while new+cod is waiting on the owner to approve COD. Both have order_status
 * 'new', so rendering that column directly told the owner "New" for two situations needing opposite
 * actions. This function is the mapping, and the seven values are the owner's own vocabulary.
 *
 * Decided by the owner 30 Jul 2026: "fail" absorbs every way an order can end without the customer
 * getting the goods — cancelled, COD denied, payment window expired, delivery failed.
 */
describe("operationalStatus > waiting on money", () => {
  it("given new + pending > is unpaid (waiting on the customer's transfer)", () => {
    expect(operationalStatus("new", "pending")).toBe("unpaid");
  });

  it("given new + cod > is cod_pending (waiting on the OWNER to approve COD)", () => {
    // The bug this exists to kill: both this and the row above used to read "New".
    expect(operationalStatus("new", "cod")).toBe("cod_pending");
  });

  it("distinguishes the two 'new' orders from each other", () => {
    expect(operationalStatus("new", "pending")).not.toBe(operationalStatus("new", "cod"));
  });
});

describe("operationalStatus > ready to move", () => {
  it("given paid but not yet shipped > is to_ship", () => {
    expect(operationalStatus("new", "paid")).toBe("to_ship");
    expect(operationalStatus("confirmed", "paid")).toBe("to_ship");
    expect(operationalStatus("packing", "paid")).toBe("to_ship");
  });

  it("given COD approved but not yet shipped > is also to_ship", () => {
    expect(operationalStatus("confirmed", "cod_confirmed")).toBe("to_ship");
    expect(operationalStatus("packing", "cod_confirmed")).toBe("to_ship");
  });
});

describe("operationalStatus > on its way and done", () => {
  it("given shipped > is in_transit", () => {
    expect(operationalStatus("shipped", "paid")).toBe("in_transit");
    expect(operationalStatus("shipped", "cod_confirmed")).toBe("in_transit");
  });

  it("given delivered > is complete", () => {
    expect(operationalStatus("delivered", "paid")).toBe("complete");
  });

  it("given delivered on COD > is complete once the cash is collected", () => {
    expect(operationalStatus("delivered", "cod_collected")).toBe("complete");
  });
});

describe("operationalStatus > fail absorbs every way it ended without delivery", () => {
  it("given cancelled > is fail", () => {
    expect(operationalStatus("cancelled", "paid")).toBe("fail");
    expect(operationalStatus("cancelled", "pending")).toBe("fail");
  });

  it("given the payment window expired > is fail", () => {
    expect(operationalStatus("expired", "expired")).toBe("fail");
  });

  it("given COD was denied > is fail", () => {
    expect(operationalStatus("new", "cod_denied")).toBe("fail");
  });

  it("given a failed delivery > is fail", () => {
    expect(operationalStatus("delivery_failed", "paid")).toBe("fail");
  });
});

describe("operationalStatus > returns", () => {
  it("given returned > is return, which covers claims too", () => {
    expect(operationalStatus("returned", "paid")).toBe("return");
  });

  it("given a returned order already refunded > still reads return, not fail", () => {
    // The money coming back does not change what happened: the goods went out and came back.
    expect(operationalStatus("returned", "refunded")).toBe("return");
  });

  it("return outranks a cancelled order status", () => {
    // A return is recorded on an order that was delivered; if both are somehow set, the return is
    // the more specific and more recent truth.
    expect(operationalStatus("returned", "refunded")).not.toBe("fail");
  });
});

describe("operationalStatus > precedence between the axes", () => {
  it("a refund on a delivered order does not make it complete", () => {
    expect(operationalStatus("cancelled", "refunded")).toBe("fail");
  });

  it("COD denied outranks the order still sitting at new", () => {
    expect(operationalStatus("new", "cod_denied")).toBe("fail");
  });

  it("shipping outranks the payment axis", () => {
    // Once it is moving, "in transit" is what the owner needs to see, whatever payment says.
    expect(operationalStatus("shipped", "cod_confirmed")).toBe("in_transit");
  });
});

describe("operationalStatus > unknown and legacy data", () => {
  it("given null statuses > returns null rather than guessing", () => {
    expect(operationalStatus(null, null)).toBeNull();
  });

  it("given a leftover Thai status > returns null rather than mislabelling it", () => {
    // Migration 0069 converts these, but it has not run on prod yet.
    expect(operationalStatus("ใหม่", "รอชำระเงิน")).toBeNull();
  });
});

describe("operationalStatusLabel", () => {
  it("labels all seven the way the owner named them", () => {
    expect(operationalStatusLabel("unpaid")).toBe("Unpaid");
    expect(operationalStatusLabel("cod_pending")).toBe("COD pending");
    expect(operationalStatusLabel("to_ship")).toBe("To ship");
    expect(operationalStatusLabel("in_transit")).toBe("In transit");
    expect(operationalStatusLabel("complete")).toBe("Complete");
    expect(operationalStatusLabel("fail")).toBe("Fail");
    expect(operationalStatusLabel("return")).toBe("Return");
  });

  it("covers every listed status", () => {
    for (const s of OPERATIONAL_STATUSES) {
      expect(operationalStatusLabel(s).length).toBeGreaterThan(0);
    }
  });

  it("lists exactly the owner's seven, in their order", () => {
    const expected: OperationalStatus[] = [
      "unpaid",
      "cod_pending",
      "to_ship",
      "in_transit",
      "complete",
      "fail",
      "return",
    ];
    expect([...OPERATIONAL_STATUSES]).toEqual(expected);
  });
});
