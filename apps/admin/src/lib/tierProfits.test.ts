import { describe, it, expect } from "vitest";
import { tierProfits, type TierPrices } from "./tierProfits";

/**
 * The four selling tiers and their profit (owner's rule, 2026-08-24):
 *
 *   "they are independent to calculate profit, they only based on the same cost."
 *
 * So the ONLY thing the four share is the cost base. Each tier's profit is its own price minus that
 * cost — and, for Shopee alone, minus a commission worked out from ITS OWN price. AirPlus is the
 * owner's own shop and pays no marketplace commission.
 *
 * This exists because the formula was written out three times — the edit form, the product page and
 * the products table — and two of the three had drifted in different directions:
 *
 *   · the edit form charged Shopee a commission calculated on the AIRPLUS price;
 *   · the table charged AIRPLUS a commission it does not pay.
 *
 * One function, one set of tests, three callers. The independence assertions below are the point:
 * they fail the moment one tier's number starts depending on another tier's price.
 */
const base: TierPrices = {
  costSatang: 40000,
  taxOnCost: false,
  b2cSatang: 90000,
  b2bSatang: 80000,
  airplusSatang: 95000,
  shopeeSatang: 120000,
  commissionBp: 500, // 5%
};

describe("tierProfits", () => {
  it("every tier is its own price minus the shared cost", () => {
    const p = tierProfits({ ...base, commissionBp: 0 });
    expect(p.b2c).toBe(90000 - 40000);
    expect(p.b2b).toBe(80000 - 40000);
    expect(p.airplus).toBe(95000 - 40000);
    expect(p.shopee).toBe(120000 - 40000);
  });

  it("commission comes off Shopee, worked out from the SHOPEE price", () => {
    // 5% of 120000 = 6000 — not 5% of the AirPlus 95000, which would be 4750.
    expect(tierProfits(base).shopee).toBe(120000 - 40000 - 6000);
  });

  it("AirPlus pays no commission — it is the owner's own shop", () => {
    expect(tierProfits(base).airplus).toBe(95000 - 40000);
    expect(tierProfits({ ...base, commissionBp: 9000 }).airplus).toBe(95000 - 40000);
  });

  it("B2C and B2B pay no commission either", () => {
    const p = tierProfits({ ...base, commissionBp: 9000 });
    expect(p.b2c).toBe(90000 - 40000);
    expect(p.b2b).toBe(80000 - 40000);
  });

  it("changing the AirPlus price moves NOTHING but the AirPlus profit", () => {
    // The exact bug this replaced: Shopee's commission was computed from this number.
    const before = tierProfits(base);
    const after = tierProfits({ ...base, airplusSatang: 500000 });
    expect(after.shopee).toBe(before.shopee);
    expect(after.b2c).toBe(before.b2c);
    expect(after.b2b).toBe(before.b2b);
    expect(after.airplus).not.toBe(before.airplus);
  });

  it("changing the Shopee price moves nothing but the Shopee profit", () => {
    const before = tierProfits(base);
    const after = tierProfits({ ...base, shopeeSatang: 500000 });
    expect(after.airplus).toBe(before.airplus);
    expect(after.b2c).toBe(before.b2c);
    expect(after.b2b).toBe(before.b2b);
    expect(after.shopee).not.toBe(before.shopee);
  });

  it("the cost IS shared — raising it moves all four", () => {
    const before = tierProfits(base);
    const after = tierProfits({ ...base, costSatang: 50000 });
    expect(after.b2c).toBe(before.b2c - 10000);
    expect(after.b2b).toBe(before.b2b - 10000);
    expect(after.airplus).toBe(before.airplus - 10000);
    expect(after.shopee).toBe(before.shopee - 10000);
  });

  it("VAT on cost raises the shared base for all four alike", () => {
    const p = tierProfits({ ...base, taxOnCost: true, commissionBp: 0 });
    const withVat = Math.round(40000 * 1.07);
    expect(p.b2c).toBe(90000 - withVat);
    expect(p.shopee).toBe(120000 - withVat);
  });

  it("a tier priced at zero reports a loss of the cost, not a fake profit", () => {
    // An unpriced tier is a real state — the table shows "—" for it, but the number must not lie.
    expect(tierProfits({ ...base, b2bSatang: 0 }).b2b).toBe(-40000);
  });
});
