import { describe, it, expect } from "vitest";
import { totalCostSatang, commissionFeeSatang, profitSatang, marginPct } from "./pricing";

describe("pricing math (satang)", () => {
  it("totalCostSatang adds 7% VAT to the cost when taxOnCost is on", () => {
    expect(totalCostSatang(6000, true)).toBe(6420); // ฿60 + 7% = ฿64.20
    expect(totalCostSatang(6000, false)).toBe(6000);
  });

  it("commissionFeeSatang takes commission basis points off the price", () => {
    expect(commissionFeeSatang(12000, 1000)).toBe(1200); // 10% of ฿120 = ฿12.00
    expect(commissionFeeSatang(12000, 0)).toBe(0);
  });

  it("profitSatang is price minus cost base minus fee", () => {
    expect(profitSatang(12000, 6420, 1200)).toBe(4380); // ฿120 − ฿64.20 − ฿12 = ฿43.80
    expect(profitSatang(10700, 6420, 0)).toBe(4280); // on-site B2C: ฿107 − ฿64.20 = ฿42.80
  });

  it("marginPct is profit over price, and 0 when price is 0", () => {
    expect(Math.round(marginPct(4380, 12000))).toBe(37);
    expect(marginPct(100, 0)).toBe(0);
  });
});
