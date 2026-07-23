import { describe, it, expect } from "vitest";
import { validateCoupon, couponDiscountSatang, type Coupon } from "./coupons";

const NOW = 1_800_000_000_000;

const BASE: Coupon = {
  code: "SAVE50",
  type: "fixed",
  value: 5000, // ฿50
  minSubtotalSatang: 0,
  startsAt: null,
  endsAt: null,
  maxUses: null,
  maxUsesPerCustomer: 1,
  maxDiscountSatang: null,
  status: "active",
};

describe("validateCoupon", () => {
  it("given no coupon row > not_found", () => {
    expect(validateCoupon(null, 100000, NOW, { total: 0, byCustomer: 0 })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("given a disabled coupon > disabled", () => {
    const c = { ...BASE, status: "disabled" as const };
    expect(validateCoupon(c, 100000, NOW, { total: 0, byCustomer: 0 })).toEqual({
      ok: false,
      reason: "disabled",
    });
  });

  it("given now before startsAt > not_started; after endsAt > expired", () => {
    const early = { ...BASE, startsAt: NOW + 1000 };
    const late = { ...BASE, endsAt: NOW - 1000 };
    expect(validateCoupon(early, 100000, NOW, { total: 0, byCustomer: 0 })).toEqual({
      ok: false,
      reason: "not_started",
    });
    expect(validateCoupon(late, 100000, NOW, { total: 0, byCustomer: 0 })).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("given subtotal below the minimum > min_subtotal", () => {
    const c = { ...BASE, minSubtotalSatang: 200000 };
    expect(validateCoupon(c, 199999, NOW, { total: 0, byCustomer: 0 })).toEqual({
      ok: false,
      reason: "min_subtotal",
    });
    expect(validateCoupon(c, 200000, NOW, { total: 0, byCustomer: 0 })).toEqual({ ok: true });
  });

  it("given total uses at max_uses > exhausted", () => {
    const c = { ...BASE, maxUses: 10 };
    expect(validateCoupon(c, 100000, NOW, { total: 10, byCustomer: 0 })).toEqual({
      ok: false,
      reason: "exhausted",
    });
  });

  it("given this customer already used it max_uses_per_customer times > customer_limit", () => {
    expect(validateCoupon(BASE, 100000, NOW, { total: 3, byCustomer: 1 })).toEqual({
      ok: false,
      reason: "customer_limit",
    });
  });

  it("given an active, in-window coupon over the minimum > ok", () => {
    const c = { ...BASE, startsAt: NOW - 1000, endsAt: NOW + 1000, maxUses: 10 };
    expect(validateCoupon(c, 100000, NOW, { total: 9, byCustomer: 0 })).toEqual({ ok: true });
  });
});

describe("couponDiscountSatang", () => {
  it("fixed: takes value off, capped at the subtotal (never negative totals)", () => {
    expect(couponDiscountSatang(BASE, 100000)).toBe(5000);
    expect(couponDiscountSatang(BASE, 3000)).toBe(3000); // cap
  });

  it("percent: value is basis points of the subtotal, rounded to whole satang", () => {
    const c: Coupon = { ...BASE, type: "percent", value: 1000 }; // 10%
    expect(couponDiscountSatang(c, 145000)).toBe(14500);
    const odd: Coupon = { ...BASE, type: "percent", value: 333 }; // 3.33%
    expect(couponDiscountSatang(odd, 10001)).toBe(Math.round((10001 * 333) / 10000));
  });

  it("percent: capped at 100% of the subtotal even with silly basis points", () => {
    const c: Coupon = { ...BASE, type: "percent", value: 15000 }; // "150%"
    expect(couponDiscountSatang(c, 10000)).toBe(10000);
  });
});

describe("couponDiscountSatang > max cap", () => {
  const pct: Coupon = {
    code: "TEN",
    type: "percent",
    value: 1000, // 10%
    minSubtotalSatang: 0,
    startsAt: null,
    endsAt: null,
    maxUses: null,
    maxUsesPerCustomer: 1,
    maxDiscountSatang: null,
    status: "active",
  };

  it("given a cap > never gives more than the cap", () => {
    // 10% of ฿30,000 would be ฿3,000; the cap holds it to ฿200.
    expect(couponDiscountSatang({ ...pct, maxDiscountSatang: 20_000 }, 3_000_000)).toBe(20_000);
  });

  it("given a cap larger than the discount > the cap does nothing", () => {
    expect(couponDiscountSatang({ ...pct, maxDiscountSatang: 20_000 }, 100_000)).toBe(10_000);
  });

  it("given no cap > behaves as before", () => {
    expect(couponDiscountSatang(pct, 3_000_000)).toBe(300_000);
  });

  it("caps fixed coupons too", () => {
    expect(
      couponDiscountSatang(
        { ...pct, type: "fixed", value: 50_000, maxDiscountSatang: 20_000 },
        3_000_000,
      ),
    ).toBe(20_000);
  });

  it("still never exceeds the subtotal, even with a huge cap", () => {
    expect(couponDiscountSatang({ ...pct, maxDiscountSatang: 999_999_999 }, 5_000)).toBe(500);
  });
});
