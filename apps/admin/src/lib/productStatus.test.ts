import { describe, it, expect } from "vitest";
import { productStatusTag, isNotLive } from "./productStatus";

// The "AirPlus" column shows one of three states, read straight off the product's `status` field.
describe("productStatusTag", () => {
  /**
   * The "Status" column (owner, 2026-08-24) — renamed from "AirPlus" and now showing one word per
   * row that matches the tab it would be found under:
   *
   *   Live · Low · Out · Paused · Draft
   *
   * A product can qualify for two at once — live AND out of stock — and the column shows one pill,
   * so precedence is the whole design:
   *
   *   1. Not live at all (Draft → Paused). If customers cannot see it, its stock level is not the
   *      thing to tell someone about.
   *   2. Out, then Low. It IS live, so stock is now the most urgent fact about it.
   *   3. Live. Nothing to flag.
   *
   * This deliberately REVERSES the 2 Aug 2026 decision that folded "Out" into Active because stock
   * had its own column. The owner asked for the column to mirror the tabs instead.
   */
  const of = (status: string, onHand = 10) => productStatusTag({ status, onHand });

  it("given active with healthy stock > Live", () => {
    expect(of("active", 10)).toEqual({ label: "Live", cls: "on" });
  });

  it("given active but out of stock > Out — live, and customers cannot buy it", () => {
    expect(of("active", 0)).toEqual({ label: "Out", cls: "bad" });
    expect(of("active", -2)).toEqual({ label: "Out", cls: "bad" });
  });

  it("given active and running low > Low", () => {
    expect(of("active", 1)).toEqual({ label: "Low", cls: "warn" });
    expect(of("active", 3)).toEqual({ label: "Low", cls: "warn" });
  });

  it("given draft > Draft, whatever the stock says", () => {
    // Not live means stock is not the headline: nobody can buy it either way.
    expect(of("draft", 0).label).toBe("Draft");
    expect(of("draft", 50).label).toBe("Draft");
  });

  it("given paused > Paused, whatever the stock says", () => {
    expect(of("paused", 0).label).toBe("Paused");
    expect(of("paused", 50).label).toBe("Paused");
  });

  it("given the old 'archived' value > Paused; the two were collapsed into one state", () => {
    // Owner, 2026-08-24: "Archived = Paused globally, and delete = gone." Migration 0088 rewrites
    // every stored 'archived' to 'paused'; this is the belt-and-braces reading of a stale row.
    expect(of("archived", 0).label).toBe("Paused");
    expect(of("archived", 50).label).toBe("Paused");
  });

  it("given an unrecognised status > Paused, never Live", () => {
    // Same reasoning as isNotLive: the safe default is "not in front of customers".
    expect(of("hidden", 10).label).toBe("Paused");
  });

  it("every label matches a tab, so the column explains where a row lives", () => {
    const labels = [
      of("active", 10).label,
      of("active", 1).label,
      of("active", 0).label,
      of("paused").label,
      of("draft").label,
    ];
    expect(labels).toEqual(["Live", "Low", "Out", "Paused", "Draft"]);
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
    // "archived" is retired (migration 0088) but a stale row must still never read as live.
    it(`given ${status} > not live`, () => {
      expect(isNotLive(status)).toBe(true);
    });
  }

  it("given an unrecognised status > not live, never assumed to be in front of customers", () => {
    expect(isNotLive("hidden")).toBe(true);
    expect(isNotLive("")).toBe(true);
  });
});
