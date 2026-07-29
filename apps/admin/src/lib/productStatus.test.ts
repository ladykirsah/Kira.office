import { describe, it, expect } from "vitest";
import { productStatusTag } from "./productStatus";

// Live on AirPlus, in stock — the all-good baseline. (shopeeListed is legacy data, no longer read.)
const base = { status: "active", shopeeListed: 1, onHand: 5 };

describe("productStatusTag", () => {
  it("given an active in-stock product > it is on AirPlus (green)", () => {
    expect(productStatusTag(base)).toEqual({ label: "On AirPlus", cls: "on" });
  });

  it("given a draft product > returns Draft (gray)", () => {
    expect(productStatusTag({ ...base, status: "draft" })).toEqual({ label: "Draft", cls: "off" });
  });

  it("given a paused product > returns Paused (yellow) — the storefront hides it", () => {
    expect(productStatusTag({ ...base, status: "paused" })).toEqual({
      label: "Paused",
      cls: "pause",
    });
  });

  it("given an active product with no stock > returns Out (red): live but unfulfillable", () => {
    expect(productStatusTag({ ...base, onHand: 0 })).toEqual({ label: "Out", cls: "bad" });
  });

  it("given a draft that is also out of stock > Draft wins", () => {
    expect(productStatusTag({ status: "draft", shopeeListed: 0, onHand: 0 }).label).toBe("Draft");
  });

  it("given a paused product that is also out of stock > Paused wins over Out", () => {
    expect(productStatusTag({ status: "paused", shopeeListed: 1, onHand: 0 }).label).toBe("Paused");
  });

  it("no longer reads the Shopee listing flag — there is no Shopee API", () => {
    // Same status and stock, opposite Shopee flags → identical result.
    expect(productStatusTag({ ...base, shopeeListed: 0 })).toEqual(
      productStatusTag({ ...base, shopeeListed: 1 }),
    );
  });
});
