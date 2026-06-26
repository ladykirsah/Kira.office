import { describe, it, expect } from "vitest";
import { lineTotalSatang, cartTotalSatang, discountSatangOf, distributeDiscount } from "./posCart";

describe("posCart", () => {
  it("lineTotalSatang > given quantity and unit price > multiplies them", () => {
    expect(lineTotalSatang({ quantity: 3, unitPriceSatang: 5000 })).toBe(15000);
  });

  it("lineTotalSatang > given negative quantity or price > clamps to zero", () => {
    expect(lineTotalSatang({ quantity: -2, unitPriceSatang: 5000 })).toBe(0);
    expect(lineTotalSatang({ quantity: 1, unitPriceSatang: -100 })).toBe(0);
  });

  it("cartTotalSatang > given mixed part and service lines > sums every line total", () => {
    expect(
      cartTotalSatang([
        { quantity: 2, unitPriceSatang: 5000 }, // 10000
        { quantity: 1, unitPriceSatang: 30000 }, // 30000
      ]),
    ).toBe(40000);
  });

  it("cartTotalSatang > given an empty cart > is zero", () => {
    expect(cartTotalSatang([])).toBe(0);
  });
});

describe("discountSatangOf", () => {
  it("given a THB amount > converts baht to satang", () => {
    expect(discountSatangOf(100000, "thb", "50")).toBe(5000);
  });
  it("given a percentage > applies it to the subtotal", () => {
    expect(discountSatangOf(100000, "pct", "10")).toBe(10000);
  });
  it("given a value above the subtotal > clamps to the subtotal", () => {
    expect(discountSatangOf(5000, "thb", "100")).toBe(5000);
  });
  it("given empty / zero / junk > is zero", () => {
    expect(discountSatangOf(100000, "thb", "")).toBe(0);
    expect(discountSatangOf(100000, "pct", "0")).toBe(0);
    expect(discountSatangOf(100000, "thb", "-5")).toBe(0);
  });
});

describe("distributeDiscount", () => {
  it("given clean ratios > splits proportionally to each line subtotal", () => {
    expect(distributeDiscount([6000, 4000], 1000)).toEqual([600, 400]);
  });
  it("given rounding remainder > assigns it to the largest line so the sum is exact", () => {
    expect(distributeDiscount([100, 100, 100], 10)).toEqual([4, 3, 3]);
    expect(distributeDiscount([333, 333, 334], 100)).toEqual([33, 33, 34]);
  });
  it("the distributed parts always sum to the total discount", () => {
    const parts = distributeDiscount([1234, 5678, 999], 777);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(777);
  });
  it("given zero discount or zero subtotal > all zeros", () => {
    expect(distributeDiscount([6000, 4000], 0)).toEqual([0, 0]);
    expect(distributeDiscount([0, 0], 1000)).toEqual([0, 0]);
  });
});
