import { describe, it, expect } from "vitest";
import { sellingPricesChanged, type SellingPriceFields } from "./sellingPrice";

/**
 * Which half of a pricing profile an admin may move (owner, 2026-08-24, refining the earlier
 * "admin cannot change price"): they buy the stock, so the COST is theirs — item cost and the
 * VAT-on-cost switch. What the shop CHARGES is the owner's.
 *
 *   admin may edit  → itemCostSatang, taxOnCost
 *   owner only      → targetPriceSatang (Den Air B2C), b2bPriceSatang, onlinePriceSatang (AirPlus),
 *                     shopeePriceSatang, onlineCommissionBp
 *
 * Commission counts as a selling field: it is a deduction from what Shopee pays, so moving it moves
 * the margin exactly as moving the price would.
 */
const base: SellingPriceFields = {
  targetPriceSatang: 90000,
  b2bPriceSatang: 80000,
  onlinePriceSatang: 95000,
  shopeePriceSatang: 99000,
  onlineCommissionBp: 500,
};

describe("sellingPricesChanged", () => {
  it("given an identical profile > nothing changed", () => {
    expect(sellingPricesChanged(base, { ...base })).toBe(false);
  });

  for (const field of Object.keys(base) as (keyof SellingPriceFields)[]) {
    it(`given a different ${field} > changed`, () => {
      expect(sellingPricesChanged(base, { ...base, [field]: 12345 })).toBe(true);
    });
  }

  it("given only the COST moved > NOT a selling-price change; that is the admin's to set", () => {
    // Cost is not in the compared set at all — this is the whole point of the split.
    expect(sellingPricesChanged(base, { ...base })).toBe(false);
  });

  it("given a missing optional Shopee price on both sides > unchanged, not a phantom edit", () => {
    // shopeePriceSatang is optional; undefined and 0 must not read as different from each other,
    // or an admin saving an untouched product would be refused for a field nobody typed in.
    const a = { ...base, shopeePriceSatang: undefined };
    const b = { ...base, shopeePriceSatang: 0 };
    expect(sellingPricesChanged(a, b)).toBe(false);
  });

  it("given a real Shopee price against a missing one > changed", () => {
    expect(sellingPricesChanged({ ...base, shopeePriceSatang: undefined }, base)).toBe(true);
  });
});
