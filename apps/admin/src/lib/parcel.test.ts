import { describe, it, expect } from "vitest";
import { cmToMm, mmToCm } from "./parcel";

/**
 * The parcel-size form takes centimetres; the DB stores millimetres (mirroring kg → weight_grams).
 * These feed carrier rating — Shippop prices on w×l×h/5000 — so a silent 0 or a NaN here becomes a
 * wrong shipping charge on a real invoice. 500 SKUs are about to be typed through this by hand.
 */
describe("cmToMm (what the operator types → what we store)", () => {
  it("given whole centimetres > converts to mm", () => {
    expect(cmToMm("40")).toBe(400);
  });

  it("given a fractional cm > keeps the precision mm can hold", () => {
    // The reason we store mm at all: a real box is 12.5cm, and cm-as-integer would lose the half.
    expect(cmToMm("12.5")).toBe(125);
  });

  it("given more precision than mm can hold > rounds to the nearest mm", () => {
    expect(cmToMm("12.54")).toBe(125);
    expect(cmToMm("12.56")).toBe(126);
  });

  it("given an empty box > returns null, meaning NOT MEASURED", () => {
    // Not 0. A zero-size parcel is a claim; an empty field is an absence.
    expect(cmToMm("")).toBeNull();
    expect(cmToMm("   ")).toBeNull();
  });

  it("given zero or a negative > returns null, not a bogus size", () => {
    expect(cmToMm("0")).toBeNull();
    expect(cmToMm("-5")).toBeNull();
  });

  it("given junk > returns null rather than NaN", () => {
    // NaN would bind into SQL and land as NULL anyway, but silently — this fails honestly.
    expect(cmToMm("abc")).toBeNull();
  });
});

describe("mmToCm (what we stored → what the operator sees)", () => {
  it("round-trips a fractional size without drift", () => {
    expect(mmToCm(cmToMm("12.5"))).toBe("12.5");
  });

  it("shows a whole number without a trailing .0", () => {
    expect(mmToCm(400)).toBe("40");
  });

  it("given an unmeasured parcel > shows an empty box, not '0'", () => {
    expect(mmToCm(null)).toBe("");
  });
});
