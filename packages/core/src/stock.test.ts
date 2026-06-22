import { describe, it, expect } from "vitest";
import {
  availableFromLedger,
  applyMovement,
  applyMovements,
  applyMovementsSafe,
  availableOf,
  reserve,
  release,
  fulfillReservation,
} from "./stock";

describe("stock ledger", () => {
  it("available = sum of deltas", () => {
    expect(
      availableFromLedger([{ quantityDelta: 10 }, { quantityDelta: -3 }, { quantityDelta: -2 }]),
    ).toBe(5);
  });

  it("applies a movement", () => {
    expect(applyMovement(5, -2)).toBe(3);
  });

  it("blocks negative stock by default", () => {
    expect(() => applyMovement(1, -5)).toThrow(/negative/i);
  });

  it("allows negative stock with owner override", () => {
    expect(applyMovement(1, -5, { allowNegative: true })).toBe(-4);
  });
});

describe("applyMovements > a sale's lines against per-variant stock", () => {
  it("accumulates deltas in order and records quantityAfter", () => {
    const r = applyMovements({ v1: 5, v2: 3 }, [
      { productVariantId: "v1", quantityDelta: -2 },
      { productVariantId: "v2", quantityDelta: -1 },
      { productVariantId: "v1", quantityDelta: -1 },
    ]);
    expect(r.available).toEqual({ v1: 2, v2: 2 });
    expect(r.entries).toEqual([
      { productVariantId: "v1", quantityDelta: -2, quantityAfter: 3 },
      { productVariantId: "v2", quantityDelta: -1, quantityAfter: 2 },
      { productVariantId: "v1", quantityDelta: -1, quantityAfter: 2 },
    ]);
  });

  it("does not mutate the input available map", () => {
    const start = { v1: 5 };
    applyMovements(start, [{ productVariantId: "v1", quantityDelta: -2 }]);
    expect(start).toEqual({ v1: 5 });
  });

  it("throws when a line would oversell (missing variant starts at 0)", () => {
    expect(() => applyMovements({}, [{ productVariantId: "v1", quantityDelta: -1 }])).toThrow(
      /negative/i,
    );
  });

  it("permits overselling with an owner override", () => {
    const r = applyMovements({ v1: 1 }, [{ productVariantId: "v1", quantityDelta: -5 }], {
      allowNegative: true,
    });
    expect(r.available).toEqual({ v1: -4 });
  });
});

describe("applyMovementsSafe > flag-and-continue for the sync path", () => {
  it("applies safe movements and surfaces oversell conflicts instead of throwing", () => {
    const r = applyMovementsSafe({ v1: 5 }, [
      { productVariantId: "v1", quantityDelta: -2 },
      { productVariantId: "v1", quantityDelta: -10 },
      { productVariantId: "v2", quantityDelta: -1 },
    ]);
    expect(r.available).toEqual({ v1: 3 }); // only -2 applied; -10 and v2's -1 skipped as conflicts
    expect(r.entries).toEqual([{ productVariantId: "v1", quantityDelta: -2, quantityAfter: 3 }]);
    expect(r.conflicts).toEqual([
      { productVariantId: "v1", quantityDelta: -10, available: 3, kind: "oversell" },
      { productVariantId: "v2", quantityDelta: -1, available: 0, kind: "oversell" },
    ]);
  });

  it("no conflicts when everything fits", () => {
    const r = applyMovementsSafe({ v1: 5 }, [{ productVariantId: "v1", quantityDelta: -5 }]);
    expect(r.conflicts).toEqual([]);
    expect(r.available).toEqual({ v1: 0 });
  });
});

describe("reserved/available stock model", () => {
  it("available = on hand − reserved", () => {
    expect(availableOf({ onHand: 10, reserved: 3 })).toBe(7);
  });

  it("reserve reduces available, blocks over-reservation", () => {
    expect(reserve({ onHand: 10, reserved: 0 }, 4)).toEqual({ onHand: 10, reserved: 4 });
    expect(() => reserve({ onHand: 5, reserved: 3 }, 5)).toThrow(/negative|reserve/i);
  });

  it("reserve permits over-reservation with owner override", () => {
    expect(reserve({ onHand: 5, reserved: 3 }, 5, { allowNegative: true })).toEqual({
      onHand: 5,
      reserved: 8,
    });
  });

  it("release lowers reservation, never below zero", () => {
    expect(release({ onHand: 10, reserved: 4 }, 2)).toEqual({ onHand: 10, reserved: 2 });
    expect(release({ onHand: 10, reserved: 1 }, 5)).toEqual({ onHand: 10, reserved: 0 });
  });

  it("fulfillReservation reduces both on hand and reserved", () => {
    expect(fulfillReservation({ onHand: 10, reserved: 4 }, 4)).toEqual({ onHand: 6, reserved: 0 });
  });
});
