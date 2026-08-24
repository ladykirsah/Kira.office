import { describe, it, expect } from "vitest";
import { nextProductStatus } from "./airplusStatus";

/**
 * What the "Live on AirPlus" switch does to `products.status` when saved.
 *
 * ON is simple — the product goes live. OFF is the interesting half, because "not live" has two
 * meanings and they are not interchangeable:
 *
 *   draft  — never finished. Switching AirPlus off must NOT promote it to paused, or a half-written
 *            product would start looking like something you deliberately took off the shop.
 *   paused — deliberately off the shop.
 *
 * So OFF only ever moves a LIVE product to paused; anything already not-live keeps the status it
 * has. Before this (2026-08-24) there was no AirPlus switch at all — "Active on Shopee" doubled as
 * the publish button, which is why turning Shopee on silently put a product in front of AirPlus
 * customers.
 */
describe("nextProductStatus", () => {
  it("given live ON > active, whatever it was before", () => {
    expect(nextProductStatus("draft", true)).toBe("active");
    expect(nextProductStatus("paused", true)).toBe("active");
    expect(nextProductStatus("active", true)).toBe("active");
  });

  it("given live OFF on a product that was live > paused", () => {
    expect(nextProductStatus("active", false)).toBe("paused");
  });

  it("given live OFF on a DRAFT > stays draft, never promoted to paused", () => {
    // A half-written product is not something you took off the shop.
    expect(nextProductStatus("draft", false)).toBe("draft");
  });

  it("given live OFF on an already-paused product > stays paused", () => {
    expect(nextProductStatus("paused", false)).toBe("paused");
  });

  it("given an unrecognised stored status and OFF > left exactly as found", () => {
    // Never invent a state for a row we do not understand.
    expect(nextProductStatus("archived", false)).toBe("archived");
    expect(nextProductStatus("", false)).toBe("");
  });
});
