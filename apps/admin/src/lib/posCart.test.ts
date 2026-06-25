import { describe, it, expect } from "vitest";
import { lineTotalSatang, cartTotalSatang } from "./posCart";

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
