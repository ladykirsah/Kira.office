import { describe, expect, it } from "vitest";
import { couponLinesOf, myCoupons, parseCartLines, type HeldCouponRow } from "./couponCart";

describe("couponLinesOf", () => {
  it("given priced cart lines > then what the coupon rules read: amount, flash price, and what it is", () => {
    expect(
      couponLinesOf([
        {
          qty: 2,
          priceSatang: 299_000,
          onFlashSale: true,
          productId: "p1",
          brandId: "br-denso",
          categoryId: "t-comp",
          carModelIds: ["cm-vios"],
        },
        {
          qty: 1,
          priceSatang: 48_000,
          onFlashSale: false,
          productId: "p2",
          brandId: null,
          categoryId: null,
          carModelIds: [],
        },
      ]),
    ).toEqual([
      {
        subtotalSatang: 598_000,
        onFlashSale: true,
        productId: "p1",
        brandId: "br-denso",
        categoryId: "t-comp",
        carModelIds: ["cm-vios"],
      },
      {
        subtotalSatang: 48_000,
        onFlashSale: false,
        productId: "p2",
        brandId: null,
        categoryId: null,
        carModelIds: [],
      },
    ]);
  });
});

describe("parseCartLines", () => {
  it("given the cart as the page sends it > then each line with a whole quantity", () => {
    expect(parseCartLines([{ variantId: "v1", qty: 2.7 }])).toEqual([{ variantId: "v1", qty: 2 }]);
  });

  it("given anything else > then null, so the route answers 400", () => {
    expect([
      parseCartLines("v1"),
      parseCartLines([{ qty: 1 }]),
      parseCartLines([{ variantId: "v1", qty: 0 }]),
    ]).toEqual([null, null, null]);
  });
});

describe("myCoupons > a customer's My coupons page", () => {
  const DAY = 86_400_000;
  const NOW = 1_800_000_000_000;
  const JOINED = NOW - 10 * DAY;
  function row(over: Partial<HeldCouponRow> = {}): HeldCouponRow {
    return {
      code: "WELCOME100",
      type: "fixed",
      value: 10_000,
      minSubtotalSatang: 0,
      maxDiscountSatang: null,
      appliesTo: "order",
      scope: "all",
      signupFrom: NOW - 30 * DAY,
      signupTo: NOW - 1 * DAY,
      validDays: 365,
      maxUses: null,
      maxUsesPerCustomer: 1,
      total: 0,
      byCustomer: 0,
      ...over,
    };
  }

  it("given a ลูกค้าใหม่ coupon their account earned > then it is listed with its own end date", () => {
    expect(myCoupons([row()], JOINED, NOW)).toEqual([
      {
        code: "WELCOME100",
        type: "fixed",
        value: 10_000,
        minSubtotalSatang: 0,
        maxDiscountSatang: null,
        appliesTo: "order",
        scope: "all",
        expiresAt: JOINED + 365 * DAY,
        usesLeft: 1,
      },
    ]);
  });

  it("given one already used, used up by everyone, past its year, or not theirs > then not listed", () => {
    expect(
      myCoupons(
        [
          row({ byCustomer: 1 }),
          row({ maxUses: 5, total: 5 }),
          row({ validDays: 5 }),
          row({ signupFrom: NOW - 5 * DAY }),
        ],
        JOINED,
        NOW,
      ),
    ).toEqual([]);
  });
});
