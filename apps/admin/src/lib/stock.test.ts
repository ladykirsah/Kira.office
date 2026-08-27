import { describe, it, expect } from "vitest";
import { stockStatus, movementLabel, planAdjustment, LOW_STOCK_THRESHOLD } from "./stock";

describe("stockStatus", () => {
  it("given onHand of zero or less > flags out", () => {
    expect(stockStatus(0)).toBe("out");
    expect(stockStatus(-1)).toBe("out");
  });

  it("given onHand at or below the threshold > flags low", () => {
    expect(stockStatus(LOW_STOCK_THRESHOLD)).toBe("low");
    expect(stockStatus(1)).toBe("low");
  });

  it("given onHand above the threshold > flags ok", () => {
    expect(stockStatus(LOW_STOCK_THRESHOLD + 1)).toBe("ok");
    expect(stockStatus(50)).toBe("ok");
  });

  it("honors a custom threshold", () => {
    expect(stockStatus(5, 10)).toBe("low");
    expect(stockStatus(11, 10)).toBe("ok");
  });
});

describe("movementLabel", () => {
  it("maps both legacy 'refund' and schema 'refund_return' to the same label", () => {
    expect(movementLabel("refund_return")).toEqual(movementLabel("refund"));
    expect(movementLabel("refund_return").en).toBe("Refund / return");
    expect(movementLabel("refund_return").th).toBe("คืนเงิน / คืนของ");
  });

  it("labels the common movement types in both languages", () => {
    expect(movementLabel("onsite_sale").en).toBe("On-site sale");
    expect(movementLabel("onsite_sale").th).toBe("ขายหน้าร้าน");
    expect(movementLabel("online_sale").en).toBe("Online sale");
    expect(movementLabel("manual_adjustment").en).toBe("Manual adjustment");
    expect(movementLabel("receive").en).toBe("Received");
    expect(movementLabel("write_off").en).toBe("Write-off");
  });

  it("gives every known type a Thai label, not just an English one", () => {
    // The whole point of the map: a movement the ledger writes must be readable in either
    // language. A missing Thai side would silently fall back to English on a Thai screen.
    for (const type of ["opening_balance", "purchase_receipt", "correction", "hold", "unhold"]) {
      const label = movementLabel(type);
      expect(label.th).not.toBe(type);
      expect(label.th).not.toBe(label.en);
    }
  });

  it("falls back to the raw type, in both languages, for unknown values", () => {
    expect(movementLabel("something_new")).toEqual({ th: "something_new", en: "something_new" });
  });
});

describe("planAdjustment", () => {
  it("given receive > returns a positive delta tagged 'receive'", () => {
    expect(planAdjustment("receive", 5)).toEqual({ movementType: "receive", quantityDelta: 5 });
  });

  it("given receive with a negative amount > uses the magnitude (never removes stock)", () => {
    expect(planAdjustment("receive", -5)).toEqual({
      movementType: "receive",
      quantityDelta: 5,
    });
  });

  it("given write_off > returns a negative delta tagged 'write_off'", () => {
    expect(planAdjustment("write_off", 3)).toEqual({
      movementType: "write_off",
      quantityDelta: -3,
    });
  });

  // A stocktake sends the counted number and lets the server derive the delta from a fresh read.
  // Subtracting a page-load on-hand here is the lost update this shape exists to prevent.
  it("given correction > sends the counted on-hand, never a client-computed delta", () => {
    expect(planAdjustment("correction", 10)).toEqual({
      movementType: "correction",
      countedOnHand: 10,
    });
    expect(planAdjustment("correction", 5)).toEqual({
      movementType: "correction",
      countedOnHand: 5,
    });
  });
});
