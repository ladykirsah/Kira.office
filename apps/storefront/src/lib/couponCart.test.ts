import { describe, expect, it } from "vitest";
import {
  couponLinesOf,
  myCoupons,
  parseCartLines,
  webCoupons,
  type HeldCouponRow,
  type WebCouponRow,
} from "./couponCart";

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
      name: "ลูกค้าใหม่ ลด ฿100",
      type: "fixed",
      value: 10_000,
      minSubtotalSatang: 0,
      maxDiscountSatang: null,
      appliesTo: "order",
      scope: "all",
      targets: [],
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
        name: "ลูกค้าใหม่ ลด ฿100",
        type: "fixed",
        value: 10_000,
        minSubtotalSatang: 0,
        maxDiscountSatang: null,
        appliesTo: "order",
        scope: "all",
        targets: [],
        forLine: { th: "สำหรับลูกค้าใหม่", en: "For new customers" },
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

describe("webCoupons > the website's coupon list (plan 8.7, owner's pick A)", () => {
  const DAY = 86_400_000;
  const NOW = 1_800_000_000_000;
  function row(over: Partial<WebCouponRow> = {}): WebCouponRow {
    return {
      code: "DENSO300",
      name: "ลด ฿300 สินค้า DENSO",
      type: "fixed",
      value: 30_000,
      minSubtotalSatang: 300_000,
      maxDiscountSatang: null,
      appliesTo: "order",
      scope: "brand",
      targets: ["DENSO"],
      startsAt: NOW - DAY,
      endsAt: NOW + 10 * DAY,
      maxUses: 100,
      maxUsesPerCustomer: 1,
      total: 3,
      byCustomer: 0,
      ...over,
    };
  }

  it("given a coupon on the web, in use now > then it is listed with its name, end and what it is for", () => {
    expect(webCoupons([row()], NOW)).toEqual([
      {
        code: "DENSO300",
        name: "ลด ฿300 สินค้า DENSO",
        type: "fixed",
        value: 30_000,
        minSubtotalSatang: 300_000,
        maxDiscountSatang: null,
        appliesTo: "order",
        scope: "brand",
        targets: ["DENSO"],
        forLine: { th: "สำหรับสินค้า DENSO", en: "For DENSO products" },
        endsAt: NOW + 10 * DAY,
        usesLeft: 1,
      },
    ]);
  });

  it("given one not started, ended, used up by everyone, or used up by this customer > then not listed", () => {
    expect(
      webCoupons(
        [
          row({ startsAt: NOW + DAY }),
          row({ endsAt: NOW }),
          row({ maxUses: 3, total: 3 }),
          row({ byCustomer: 1 }),
        ],
        NOW,
      ),
    ).toEqual([]);
  });

  it("given no start, no end and no limit > then it is listed with no end date", () => {
    const [c] = webCoupons([row({ startsAt: null, endsAt: null, maxUses: null })], NOW);
    expect(c!.endsAt).toBeNull();
  });

  it("given several > then the one ending soonest comes first, no end date last", () => {
    const list = webCoupons(
      [
        row({ code: "NOEND", endsAt: null }),
        row({ code: "LATER", endsAt: NOW + 20 * DAY }),
        row({ code: "SOON", endsAt: NOW + 2 * DAY }),
      ],
      NOW,
    );
    expect(list.map((c) => c.code)).toEqual(["SOON", "LATER", "NOEND"]);
  });

  it("given free shipping on any order > then สำหรับทุกออเดอร์", () => {
    const [c] = webCoupons([row({ appliesTo: "shipping", scope: "all", targets: [] })], NOW);
    expect(c!.forLine.th).toBe("สำหรับทุกออเดอร์");
  });
});
