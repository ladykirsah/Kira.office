import { describe, expect, it } from "vitest";
import { readinessNote, readinessValues } from "./readiness";
import type { ProductRow } from "./api";

/**
 * The second line in the products table's Status cell (owner, 2026-08-24).
 *
 * The tab it was asked for: after migration 0088 all eight not-live products read "Paused" — the
 * name of the tab you are already looking at. Nothing said which one could go back on the shop this
 * afternoon and which needed a photo shoot first. The owner then asked for it on EVERY tab, so a
 * live product missing a photo says so too.
 *
 * It never repeats what the pill already says: a live product with no stock is pilled "Out", so the
 * line stays quiet about stock. A paused one is pilled "Paused", which says nothing about stock, so
 * there the line does mention it.
 */
const base: ProductRow = {
  id: "p1",
  variantId: "v1",
  productRef: "REF-1",
  name: "ตู้แอร์ คอยล์เย็น Toyota Tiger D4D",
  status: "active",
  imageKey: "img/1.jpg",
  shopeeListed: 0,
  brandName: "DENSO",
  typeName: null,
  usageName: null,
  carBrands: [],
  offlinePriceSatang: 250000,
  onlinePriceSatang: 250000,
  itemCostSatang: 100000,
  onlineCommissionBp: 0,
  taxOnCost: 0,
  onHand: 3,
  held: 0,
};
const row = (over: Partial<ProductRow>): ProductRow => ({ ...base, ...over });

describe("readinessNote", () => {
  it("given a live product with nothing missing > then says nothing", () => {
    // It is already selling. A line here would be noise on every healthy row in the table.
    expect(readinessNote(row({}))).toBeNull();
  });

  it("given a paused product with nothing missing > then ready to sell", () => {
    expect(readinessNote(row({ status: "paused" }))).toEqual({
      text: "ready to sell",
      ready: true,
    });
  });

  it("given a draft with nothing missing > then ready to sell", () => {
    expect(readinessNote(row({ status: "draft" }))).toEqual({ text: "ready to sell", ready: true });
  });

  it("given a paused product with no photo > then says no photo", () => {
    expect(readinessNote(row({ status: "paused", imageKey: null }))).toEqual({
      text: "no photo",
      ready: false,
    });
  });

  it("given a LIVE product with no photo > then still says no photo", () => {
    // The owner asked for every tab: a product selling without a picture is worth flagging.
    expect(readinessNote(row({ imageKey: null }))).toEqual({ text: "no photo", ready: false });
  });

  it("given a paused product with no stock > then says no stock", () => {
    // "Paused" says nothing about stock, so the line has to.
    expect(readinessNote(row({ status: "paused", onHand: 0 }))).toEqual({
      text: "no stock",
      ready: false,
    });
  });

  it("given a LIVE product with no stock > then says nothing — the pill already reads Out", () => {
    expect(readinessNote(row({ onHand: 0 }))).toBeNull();
  });

  it("given a live product with low stock > then says nothing — the pill already reads Low", () => {
    expect(readinessNote(row({ onHand: 1 }))).toBeNull();
  });

  it("given no online price > then says no price, live or not", () => {
    expect(readinessNote(row({ onlinePriceSatang: 0 }))).toEqual({
      text: "no price",
      ready: false,
    });
  });

  it("given several gaps > then lists them photo, price, stock in that order", () => {
    expect(
      readinessNote(row({ status: "paused", imageKey: null, onlinePriceSatang: 0, onHand: 0 })),
    ).toEqual({ text: "no photo · no price · no stock", ready: false });
  });

  it("given the real Isuzu D-Max row > then no photo and no stock", () => {
    // Verified against production, 24 Aug 2026: paused, no image_key, 0 on hand, ฿2,490 online.
    expect(
      readinessNote(
        row({ status: "paused", imageKey: null, onHand: 0, onlinePriceSatang: 249000 }),
      ),
    ).toEqual({ text: "no photo · no stock", ready: false });
  });

  it("given negative stock > then still counts as no stock", () => {
    // A ledger can go negative on a miscount; it is not "some stock".
    expect(readinessNote(row({ status: "paused", onHand: -2 }))).toEqual({
      text: "no stock",
      ready: false,
    });
  });
});

/**
 * The same facts as Sort by / Filter options, so "show me everything missing a photo" is one click.
 * A healthy live product has no value and therefore sorts last, which is the existing behaviour for
 * every other dimension.
 */
describe("readinessValues", () => {
  it("given a healthy live product > then no values, so it sorts last", () => {
    expect(readinessValues(row({}))).toEqual([]);
  });

  it("given a paused product with nothing missing > then Ready to sell", () => {
    expect(readinessValues(row({ status: "paused" }))).toEqual(["Ready to sell"]);
  });

  it("given several gaps > then one filterable value each", () => {
    expect(readinessValues(row({ status: "paused", imageKey: null, onHand: 0 }))).toEqual([
      "No photo",
      "No stock",
    ]);
  });

  it("given a live product with no photo > then No photo", () => {
    expect(readinessValues(row({ imageKey: null }))).toEqual(["No photo"]);
  });
});
