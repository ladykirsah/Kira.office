import { describe, it, expect } from "vitest";
import { productStatusTag, isNotLive } from "./productStatus";

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

  it("given an archived product > Archived, its own state — not lumped in with Paused", () => {
    // Archived and Paused are both "not live", but they are not the same thing: Paused is a
    // decision you can undo from the product page, Archived is what deleting leaves behind. The
    // merged "Not live" tab holds both, so the pill is the only thing left that tells them apart.
    expect(productStatusTag({ status: "archived" })).toEqual({ label: "Archived", cls: "bad" });
  });
});

/**
 * The "Not live" tab (owner, 2026-08-24) merges what used to be three separate tabs — Paused,
 * Draft and Archive — because from the shop's point of view they are one question: is this product
 * in front of a customer or not?
 *
 *   Draft    — not live, and not finished being written
 *   Paused   — not live, deliberately
 *   Archived — not live, because it was deleted
 *
 * Only `active` is live. Anything else is not, including a status nobody has invented yet: the
 * default has to be "not in front of customers", because the opposite default publishes something
 * by accident.
 */
describe("isNotLive", () => {
  it("given active > live, so NOT in the Not-live tab", () => {
    expect(isNotLive("active")).toBe(false);
  });

  for (const status of ["draft", "paused", "archived"]) {
    it(`given ${status} > not live`, () => {
      expect(isNotLive(status)).toBe(true);
    });
  }

  it("given an unrecognised status > not live, never assumed to be in front of customers", () => {
    expect(isNotLive("hidden")).toBe(true);
    expect(isNotLive("")).toBe(true);
  });
});
