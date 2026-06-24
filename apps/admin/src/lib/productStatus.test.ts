import { describe, it, expect } from "vitest";
import { productStatusTag } from "./productStatus";

// Listed on Shopee, in stock — the all-good baseline.
const base = { status: "active", shopeeListed: 1, onHand: 5 };

describe("productStatusTag", () => {
  it("given a listed in-stock product > returns Active (green)", () => {
    expect(productStatusTag(base)).toEqual({ label: "Active", cls: "on" });
  });

  it("given a draft product > returns Draft (gray)", () => {
    expect(productStatusTag({ ...base, status: "draft" })).toEqual({ label: "Draft", cls: "off" });
  });

  it("given an active product not listed on Shopee > returns Pause (yellow)", () => {
    expect(productStatusTag({ ...base, shopeeListed: 0 })).toEqual({
      label: "Pause",
      cls: "pause",
    });
  });

  it("given a listed product with zero stock > returns Out (red)", () => {
    expect(productStatusTag({ ...base, onHand: 0 })).toEqual({ label: "Out", cls: "bad" });
  });

  it("given a draft that is also out of stock > Draft wins", () => {
    expect(productStatusTag({ status: "draft", shopeeListed: 0, onHand: 0 }).label).toBe("Draft");
  });

  it("given an unlisted product that is also out of stock > Pause wins over Out", () => {
    expect(productStatusTag({ status: "active", shopeeListed: 0, onHand: 0 }).label).toBe("Pause");
  });
});
