import { describe, it, expect } from "vitest";
import { planHoldMovement } from "./stockHold";

describe("planHoldMovement", () => {
  it("given a take-away within sellable > moves stock to hold with a negative delta", () => {
    const p = planHoldMovement({ sellable: 5, held: 0, takeAway: 2, bringBack: 0 });
    expect(p.ok).toBe(true);
    expect(p.error).toBeNull();
    expect(p.holdDelta).toBe(-2);
    expect(p.unholdDelta).toBe(0);
    expect(p.sellableAfter).toBe(3);
    expect(p.heldAfter).toBe(2);
  });

  it("given a bring-back within held > returns stock with a positive delta", () => {
    const p = planHoldMovement({ sellable: 3, held: 2, takeAway: 0, bringBack: 2 });
    expect(p.ok).toBe(true);
    expect(p.holdDelta).toBe(0);
    expect(p.unholdDelta).toBe(2);
    expect(p.sellableAfter).toBe(5);
    expect(p.heldAfter).toBe(0);
  });

  it("given take-away greater than sellable > rejects (no oversell into hold)", () => {
    const p = planHoldMovement({ sellable: 1, held: 0, takeAway: 2, bringBack: 0 });
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/1 sellable/);
    expect(p.holdDelta).toBe(0);
    expect(p.sellableAfter).toBe(1); // unchanged
  });

  it("given bring-back greater than held > rejects", () => {
    const p = planHoldMovement({ sellable: 0, held: 1, takeAway: 0, bringBack: 2 });
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/1 on hold/);
    expect(p.unholdDelta).toBe(0);
    expect(p.heldAfter).toBe(1); // unchanged
  });

  it("given both boxes set > guards each against current state and nets the result", () => {
    // take 2 (≤ sellable 5), bring back 1 (≤ held 3), both valid vs the pre-submit state.
    const p = planHoldMovement({ sellable: 5, held: 3, takeAway: 2, bringBack: 1 });
    expect(p.ok).toBe(true);
    expect(p.holdDelta).toBe(-2);
    expect(p.unholdDelta).toBe(1);
    expect(p.sellableAfter).toBe(4); // 5 - 2 + 1
    expect(p.heldAfter).toBe(4); // 3 + 2 - 1
  });

  it("given both boxes zero > is a valid no-op", () => {
    const p = planHoldMovement({ sellable: 5, held: 2, takeAway: 0, bringBack: 0 });
    expect(p.ok).toBe(true);
    expect(p.holdDelta).toBe(0);
    expect(p.unholdDelta).toBe(0);
    expect(p.sellableAfter).toBe(5);
    expect(p.heldAfter).toBe(2);
  });

  it("can hold the entire sellable quantity (boundary)", () => {
    const p = planHoldMovement({ sellable: 4, held: 0, takeAway: 4, bringBack: 0 });
    expect(p.ok).toBe(true);
    expect(p.sellableAfter).toBe(0);
    expect(p.heldAfter).toBe(4);
  });

  it.each([
    ["negative take-away", { sellable: 5, held: 0, takeAway: -1, bringBack: 0 }],
    ["negative bring-back", { sellable: 5, held: 2, takeAway: 0, bringBack: -1 }],
    ["fractional take-away", { sellable: 5, held: 0, takeAway: 1.5, bringBack: 0 }],
  ])("rejects %s", (_label, input) => {
    const p = planHoldMovement(input);
    expect(p.ok).toBe(false);
    expect(p.error).toMatch(/whole numbers/);
  });
});
