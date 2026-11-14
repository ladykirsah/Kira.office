import { describe, it, expect } from "vitest";
import { cartTitle, cartTotals, minusStep, plusStep, MAX_QTY } from "./cartPage";
import type { CartLine } from "./cart";

/** Board 4 · ตะกร้า (4.1–4.3), drawn 5 Nov 2026, Apple text 14 Nov; owner: "Yes, build board 4". */
const line = (over: Partial<CartLine>): CartLine => ({
  variantId: "v1",
  productId: "p1",
  name: "ตู้แอร์ คอยล์เย็น Toyota Vigo / Fortuner Gen 1 / Altis | Cool Gear TG447610-08504W",
  productRef: "TG447610-08504W",
  priceSatang: 165000,
  imageKey: null,
  qty: 1,
  ...over,
});
const cart = [line({}), line({ variantId: "v2", priceSatang: 45000, qty: 2 })];

describe("cartTitle", () => {
  it("cartTitle > given 3 pieces in the cart > ตะกร้า (3)", () => {
    expect(cartTitle(cart)).toBe("ตะกร้า (3)");
  });
  it("cartTitle > given an empty cart > ตะกร้า", () => {
    expect(cartTitle([])).toBe("ตะกร้า");
  });
});

describe("cartTotals", () => {
  it("cartTotals > given 3 pieces worth ฿2,550 > รวม 3 ชิ้น · ฿2,550 · ยังไม่รวมค่าส่ง", () => {
    expect(cartTotals(cart)).toEqual({
      countLine: "รวม 3 ชิ้น",
      total: "฿2,550",
      note: "ยังไม่รวมค่าส่ง",
    });
  });
});

describe("quantity steps (4.1 · − / +, at most 99)", () => {
  it("minusStep > given 2 > 1", () => {
    expect(minusStep(2)).toBe(1);
  });
  it("minusStep > given 1 > asks to remove it (4.2)", () => {
    expect(minusStep(1)).toBe("ask-remove");
  });
  it("plusStep > given 1 > 2", () => {
    expect(plusStep(1)).toBe(2);
  });
  it("plusStep > given 99 > stays 99", () => {
    expect(MAX_QTY).toBe(99);
    expect(plusStep(99)).toBe(99);
  });
});
