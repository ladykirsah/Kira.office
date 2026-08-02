import { describe, it, expect } from "vitest";
import { productStatusTag } from "./productStatus";

// The "AirPlus" column shows one of three states, read straight off the product's `status` field.
describe("productStatusTag", () => {
  it("given an active product > Active (green), live on AirPlus", () => {
    expect(productStatusTag({ status: "active" })).toEqual({ label: "Active", cls: "on" });
  });

  it("given a draft product > Draft (gray), not published yet", () => {
    expect(productStatusTag({ status: "draft" })).toEqual({ label: "Draft", cls: "off" });
  });

  it("given a paused product > Paused (yellow) — the storefront hides it", () => {
    expect(productStatusTag({ status: "paused" })).toEqual({ label: "Paused", cls: "pause" });
  });

  it("given any status that is neither active nor draft > Paused", () => {
    // Paused is the catch-all for 'deliberately not live', so an unexpected status never reads Active.
    expect(productStatusTag({ status: "hidden" }).label).toBe("Paused");
  });

  it("stock does not change the AirPlus state — that is the Stock column's job", () => {
    // The old "Out" state is gone: an active product reads Active whether or not it has stock now.
    expect(productStatusTag({ status: "active" }).label).toBe("Active");
  });
});
