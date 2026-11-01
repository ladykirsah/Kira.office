import { describe, it, expect } from "vitest";
import {
  applyCoupon,
  couponDiscountSatang,
  heldUntil,
  validateCoupon,
  type Coupon,
  type CouponLine,
} from "./coupons";

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

// ── the coupon rules the owner asked for on 1 Nov 2026 ─────────────────────────────────────────

const DAY = 86_400_000;
const NO_USE = { total: 0, byCustomer: 0 };

function line(over: Partial<CouponLine> = {}): CouponLine {
  return {
    subtotalSatang: 100_000,
    onFlashSale: false,
    productId: "p1",
    brandId: "b-denso",
    categoryId: "t-comp",
    carModelIds: ["cm-vios"],
    ...over,
  };
}

describe("applyCoupon > a coupon never cuts a แฟลชเซล price", () => {
  it("given a flash-priced line and a normal one > only the normal line is discounted", () => {
    const pct: Coupon = { ...BASE, type: "percent", value: 1000 };
    const out = applyCoupon(pct, [line(), line({ onFlashSale: true })], 0, NOW, NO_USE);
    expect(out).toEqual({ ok: true, discountSatang: 10_000 });
  });

  it("given only flash-priced lines > flash_only, so the customer is told why", () => {
    expect(applyCoupon(BASE, [line({ onFlashSale: true })], 0, NOW, NO_USE)).toEqual({
      ok: false,
      reason: "flash_only",
    });
  });

  it("given the minimum spend > flash-priced lines do not count toward it", () => {
    const min: Coupon = { ...BASE, minSubtotalSatang: 150_000 };
    const out = applyCoupon(min, [line(), line({ onFlashSale: true })], 0, NOW, NO_USE);
    expect(out).toEqual({ ok: false, reason: "min_subtotal" });
  });
});

describe("applyCoupon > ใช้กับ: a brand, a category, a car model or picked products", () => {
  const cart = [
    line({ productId: "p1", brandId: "b-denso", categoryId: "t-comp", carModelIds: ["cm-vios"] }),
    line({ productId: "p2", brandId: "b-sanden", categoryId: "t-fan", carModelIds: ["cm-city"] }),
  ];
  const pct: Coupon = { ...BASE, type: "percent", value: 1000 };

  it.each([
    ["brand", ["b-denso"]],
    ["category", ["t-comp"]],
    ["car_model", ["cm-vios"]],
    ["products", ["p1"]],
  ] as const)("given scope %s > only the matching line is discounted", (scope, targets) => {
    expect(applyCoupon({ ...pct, scope, targets }, cart, 0, NOW, NO_USE)).toEqual({
      ok: true,
      discountSatang: 10_000,
    });
  });

  it("given several targets > any of them counts", () => {
    const c: Coupon = { ...pct, scope: "brand", targets: ["b-denso", "b-sanden"] };
    expect(applyCoupon(c, cart, 0, NOW, NO_USE)).toEqual({ ok: true, discountSatang: 20_000 });
  });

  it("given nothing in the cart matches > no_items", () => {
    const c: Coupon = { ...pct, scope: "brand", targets: ["b-valeo"] };
    expect(applyCoupon(c, cart, 0, NOW, NO_USE)).toEqual({ ok: false, reason: "no_items" });
  });
});

describe("applyCoupon > ส่งฟรี and ลดค่าส่ง", () => {
  const free: Coupon = { ...BASE, appliesTo: "shipping", type: "percent", value: 10_000 };

  it("given free shipping > the whole shipping fee comes off", () => {
    expect(applyCoupon(free, [line()], 7_700, NOW, NO_USE)).toEqual({
      ok: true,
      discountSatang: 7_700,
    });
  });

  it("given ฿30 off shipping > never more than the fee", () => {
    const off: Coupon = { ...BASE, appliesTo: "shipping", type: "fixed", value: 3_000 };
    expect(applyCoupon(off, [line()], 7_700, NOW, NO_USE)).toEqual({
      ok: true,
      discountSatang: 3_000,
    });
    expect(applyCoupon(off, [line()], 2_500, NOW, NO_USE)).toEqual({
      ok: true,
      discountSatang: 2_500,
    });
  });

  it("given a cart of flash-priced items > free shipping still works (it is not the flash price)", () => {
    expect(applyCoupon(free, [line({ onFlashSale: true })], 7_700, NOW, NO_USE)).toEqual({
      ok: true,
      discountSatang: 7_700,
    });
  });
});

describe("applyCoupon > ลูกค้าใหม่: accounts made in the window, each for 1 year", () => {
  const welcome: Coupon = {
    ...BASE,
    signupFrom: NOW - 30 * DAY,
    signupTo: NOW - 1 * DAY,
    validDays: 365,
  };

  it("given an account made inside the window > it works, on any order", () => {
    const holder = { createdAt: NOW - 10 * DAY };
    expect(applyCoupon(welcome, [line()], 0, NOW, NO_USE, holder)).toEqual({
      ok: true,
      discountSatang: 5_000,
    });
  });

  it("given an account made before or after the window, or no account > not_eligible", () => {
    for (const holder of [{ createdAt: NOW - 31 * DAY }, { createdAt: NOW }, undefined]) {
      expect(applyCoupon(welcome, [line()], 0, NOW, NO_USE, holder)).toEqual({
        ok: false,
        reason: "not_eligible",
      });
    }
  });

  it("given a year has passed since the account was made > expired", () => {
    const holder = { createdAt: NOW - 10 * DAY };
    expect(applyCoupon(welcome, [line()], 0, holder.createdAt + 365 * DAY, NO_USE, holder)).toEqual(
      { ok: false, reason: "expired" },
    );
  });
});

describe("heldUntil > what a customer's My coupons page shows for a ลูกค้าใหม่ coupon", () => {
  const welcome: Coupon = {
    ...BASE,
    signupFrom: NOW - 30 * DAY,
    signupTo: NOW - 1 * DAY,
    validDays: 365,
  };

  it("given an account made inside the window > then it is theirs until a year after they joined", () => {
    expect(heldUntil(welcome, { createdAt: NOW - 10 * DAY })).toBe(NOW - 10 * DAY + 365 * DAY);
  });

  it("given an account made outside the window > then it is not theirs", () => {
    expect(heldUntil(welcome, { createdAt: NOW - 40 * DAY })).toBeNull();
  });

  it("given a coupon for everyone > then it is not a held coupon", () => {
    expect(heldUntil(BASE, { createdAt: NOW })).toBeNull();
  });
});
