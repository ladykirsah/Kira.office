import { describe, it, expect } from "vitest";
import { availableFromLedger, applyMovement } from "./stock";

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
