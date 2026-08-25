import { describe, it, expect } from "vitest";
import { productStatusTag, isNotLive, channelTags } from "./productStatus";

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
    expect(of("active", 10)).toEqual({ label: { th: "วางขาย", en: "Live" }, cls: "on" });
  });

  it("given active but out of stock > Out — live, and customers cannot buy it", () => {
    expect(of("active", 0)).toEqual({ label: { th: "หมด", en: "Out" }, cls: "bad" });
    expect(of("active", -2)).toEqual({ label: { th: "หมด", en: "Out" }, cls: "bad" });
  });

  it("given active and running low > Low", () => {
    expect(of("active", 1)).toEqual({ label: { th: "เหลือน้อย", en: "Low" }, cls: "warn" });
    expect(of("active", 3)).toEqual({ label: { th: "เหลือน้อย", en: "Low" }, cls: "warn" });
  });

  it("given draft > Draft, whatever the stock says", () => {
    // Not live means stock is not the headline: nobody can buy it either way.
    expect(of("draft", 0).label).toEqual({ th: "ฉบับร่าง", en: "Draft" });
    expect(of("draft", 50).label).toEqual({ th: "ฉบับร่าง", en: "Draft" });
  });

  it("given paused > Paused, whatever the stock says", () => {
    expect(of("paused", 0).label).toEqual({ th: "หยุดขาย", en: "Paused" });
    expect(of("paused", 50).label).toEqual({ th: "หยุดขาย", en: "Paused" });
  });

  it("given the old 'archived' value > Paused; the two were collapsed into one state", () => {
    // Owner, 2026-08-24: "Archived = Paused globally, and delete = gone." Migration 0088 rewrites
    // every stored 'archived' to 'paused'; this is the belt-and-braces reading of a stale row.
    expect(of("archived", 0).label).toEqual({ th: "หยุดขาย", en: "Paused" });
    expect(of("archived", 50).label).toEqual({ th: "หยุดขาย", en: "Paused" });
  });

  it("given an unrecognised status > Paused, never Live", () => {
    // Same reasoning as isNotLive: the safe default is "not in front of customers".
    expect(of("hidden", 10).label).toEqual({ th: "หยุดขาย", en: "Paused" });
  });

  it("every label matches a tab, so the column explains where a row lives", () => {
    const labels = [
      of("active", 10).label,
      of("active", 1).label,
      of("active", 0).label,
      of("paused").label,
      of("draft").label,
    ];
    expect(labels.map((l) => l.en)).toEqual(["Live", "Low", "Out", "Paused", "Draft"]);
    expect(labels.map((l) => l.th)).toEqual(["วางขาย", "เหลือน้อย", "หมด", "หยุดขาย", "ฉบับร่าง"]);
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

/**
 * The Status field on a product's page: one tag per sales channel, so you can see at a glance where
 * the product is and is not being sold (owner, 2026-08-24).
 *
 * It replaced a field labelled "Shopee" that showed a single Shopee tag, next to a "Shopee ID" field
 * that was always "—" — there is no Shopee API, so no id is ever linked. Naming the field "Status"
 * and giving AirPlus a matching tag makes it answer the question people actually open the page with.
 *
 * The two channels are genuinely separate: AirPlus is live when the storefront would show it
 * (`status === "active"`), Shopee when the listing flag is set. Neither implies the other.
 */
describe("channelTags", () => {
  it("given live on both > both tags read Active", () => {
    expect(channelTags("active", 1)).toEqual([
      { label: { th: "วางขายบน AirPlus", en: "Active on AirPlus" }, cls: "on" },
      { label: { th: "วางขายบน Shopee", en: "Active on Shopee" }, cls: "on" },
    ]);
  });

  it("given live on neither > both tags read Not on", () => {
    expect(channelTags("draft", 0)).toEqual([
      { label: { th: "ไม่ได้วางขายบน AirPlus", en: "Not on AirPlus" }, cls: "off" },
      { label: { th: "ไม่ได้วางขายบน Shopee", en: "Not on Shopee" }, cls: "off" },
    ]);
  });

  it("given AirPlus only > the channels are reported independently", () => {
    expect(channelTags("active", 0)).toEqual([
      { label: { th: "วางขายบน AirPlus", en: "Active on AirPlus" }, cls: "on" },
      { label: { th: "ไม่ได้วางขายบน Shopee", en: "Not on Shopee" }, cls: "off" },
    ]);
  });

  it("given Shopee only > likewise, and being on Shopee never implies being live in the shop", () => {
    expect(channelTags("draft", 1)).toEqual([
      { label: { th: "ไม่ได้วางขายบน AirPlus", en: "Not on AirPlus" }, cls: "off" },
      { label: { th: "วางขายบน Shopee", en: "Active on Shopee" }, cls: "on" },
    ]);
  });

  it("given paused > not on AirPlus; only `active` counts as live", () => {
    expect(channelTags("paused", 0)[0]).toEqual({
      label: { th: "ไม่ได้วางขายบน AirPlus", en: "Not on AirPlus" },
      cls: "off",
    });
  });

  it("AirPlus is always listed first — it is the owner's own shop", () => {
    expect(channelTags("active", 1).map((t) => t.label.en)).toEqual([
      "Active on AirPlus",
      "Active on Shopee",
    ]);
  });
});
