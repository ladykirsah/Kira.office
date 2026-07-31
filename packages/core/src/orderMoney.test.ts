import { describe, it, expect } from "vitest";
import { orderMoney, type OrderMoneyFacts } from "./orderMoney";

/**
 * The owner's own correction, 30 Jul 2026: the detail page called one number "Total" while their
 * formula described a different number. So the money block became two books — what the customer was
 * charged, and what we kept — and this is the arithmetic behind both.
 *
 * The trap the tests below pin down: shipping must not be counted twice. The customer's fee lives in
 * the customer book; our book starts from goods AFTER discount, which excludes it, so our book may
 * only deduct the SHORTFALL (real carrier charge − what the customer paid). Deducting the full
 * carrier charge from a base that already contains the customer's fee, or the shortfall from one
 * that doesn't, puts profit out by exactly the fee.
 */

/** The worked example the owner signed off on, in satang. ฿4,500 order, ฿90 parcel, ฿50 charged. */
const SIGNED_OFF: OrderMoneyFacts = {
  subtotalSatang: 450_000,
  discountTotalSatang: 20_000,
  grandTotalSatang: 435_000,
  shippingChargedSatang: 5_000,
  shippingRealSatang: 9_000,
  lines: [
    { unitCostSatang: 100_000, quantity: 2 },
    { unitCostSatang: 90_000, quantity: 1 },
  ],
  storedProfitSatang: 140_000,
};

describe("orderMoney > the signed-off example", () => {
  it("given ฿4,500 goods, ฿200 coupon, ฿50 charged, ฿90 real > profit ฿1,360", () => {
    const m = orderMoney(SIGNED_OFF);
    expect(m.goodsAfterDiscountSatang).toBe(430_000);
    expect(m.itemCostSatang).toBe(290_000);
    expect(m.shippingShortfallSatang).toBe(4_000);
    expect(m.profitSatang).toBe(136_000);
  });

  it("customer book reads the authoritative charge, not a recomputation", () => {
    expect(orderMoney(SIGNED_OFF).customerPaidSatang).toBe(435_000);
  });

  it("given grand_total disagrees with its components > the stored total wins", () => {
    // The components summing to something else means the row is inconsistent — a hand-edited or
    // legacy order. grand_total is what the payment actually captured, so it is the figure that
    // wins; recomputing here would invent a charge the customer never saw. Without this case the
    // suite cannot tell the two apart, because on a healthy order they are the same number.
    const inconsistent: OrderMoneyFacts = { ...SIGNED_OFF, grandTotalSatang: 999_999 };
    expect(orderMoney(inconsistent).customerPaidSatang).toBe(999_999);
  });

  it("the customer book's own rows sum to what was charged", () => {
    // If this ever fails on a checkout-created order, grand_total and its components disagree —
    // which would mean the panel on screen does not add up.
    const { subtotalSatang, discountTotalSatang, shippingChargedSatang } = SIGNED_OFF;
    expect(subtotalSatang - discountTotalSatang + shippingChargedSatang).toBe(
      orderMoney(SIGNED_OFF).customerPaidSatang,
    );
  });

  it("our book's own rows sum to profit", () => {
    const m = orderMoney(SIGNED_OFF);
    expect(m.goodsAfterDiscountSatang - m.itemCostSatang - (m.shippingShortfallSatang ?? 0)).toBe(
      m.profitSatang,
    );
  });
});

describe("orderMoney > double-counting the shipping fee", () => {
  it("profit is NOT the naive customer-total minus cost minus shortfall", () => {
    // 435,000 − 290,000 − 4,000 = 141,000. That is the ฿50 the customer paid, counted twice.
    expect(orderMoney(SIGNED_OFF).profitSatang).not.toBe(141_000);
  });

  it("profit is NOT goods-after-discount minus cost minus the FULL carrier charge", () => {
    // 430,000 − 290,000 − 9,000 = 131,000. That drops the ฿50 the customer paid entirely.
    expect(orderMoney(SIGNED_OFF).profitSatang).not.toBe(131_000);
  });

  it("both correct pairings agree, which is what makes 136,000 the right answer", () => {
    const { grandTotalSatang, subtotalSatang, discountTotalSatang, shippingRealSatang } =
      SIGNED_OFF;
    const cost = 290_000;
    const shortfall = 4_000;
    const fromCustomerBase = grandTotalSatang - cost - (shippingRealSatang ?? 0);
    const fromGoodsBase = subtotalSatang - discountTotalSatang - cost - shortfall;
    expect(fromCustomerBase).toBe(fromGoodsBase);
    expect(orderMoney(SIGNED_OFF).profitSatang).toBe(fromGoodsBase);
  });
});

describe("orderMoney > before the parcel is dropped off", () => {
  const notYetShipped: OrderMoneyFacts = { ...SIGNED_OFF, shippingRealSatang: null };

  it("no real charge yet > shortfall is null, not zero", () => {
    // Null and zero mean different things: null is "we do not know yet", zero is "it cost us
    // nothing". Rendering an unknown as ฿0 would claim a shipping outcome we have not measured.
    expect(orderMoney(notYetShipped).shippingShortfallSatang).toBeNull();
  });

  it("no real charge yet > profit is goods margin alone", () => {
    expect(orderMoney(notYetShipped).profitSatang).toBe(140_000);
  });

  it("recording the drop-off lowers profit by the shortfall", () => {
    const before = orderMoney(notYetShipped).profitSatang!;
    const after = orderMoney(SIGNED_OFF).profitSatang!;
    expect(before - after).toBe(4_000);
  });
});

describe("orderMoney > the carrier billed less than we charged", () => {
  const overcharged: OrderMoneyFacts = { ...SIGNED_OFF, shippingRealSatang: 3_000 };

  it("shortfall goes negative rather than clamping to zero", () => {
    // We charged ฿50 and paid ฿30. That ฿20 is real and belongs in profit; clamping at zero would
    // quietly under-report what the order earned.
    expect(orderMoney(overcharged).shippingShortfallSatang).toBe(-2_000);
  });

  it("profit rises above the goods margin", () => {
    expect(orderMoney(overcharged).profitSatang).toBe(142_000);
  });
});

describe("orderMoney > item cost is not known", () => {
  const unmatched: OrderMoneyFacts = { ...SIGNED_OFF, storedProfitSatang: null };

  it("SKUs never matched to Kira products > profit is null, not a flattering number", () => {
    // unit_cost_satang defaults to 0, so summing the lines would report cost ฿0 and a profit equal
    // to the whole order. A null profit_satang is the signal that the cost snapshot is absent.
    expect(orderMoney(unmatched).profitSatang).toBeNull();
  });

  it("the customer book still reads in full", () => {
    const m = orderMoney(unmatched);
    expect(m.customerPaidSatang).toBe(435_000);
    expect(m.goodsAfterDiscountSatang).toBe(430_000);
  });

  it("the shipping shortfall is still known, because it does not depend on item cost", () => {
    expect(orderMoney(unmatched).shippingShortfallSatang).toBe(4_000);
  });
});

describe("orderMoney > a shared-fee order", () => {
  // The owner plans to absorb part of the fee on heavy orders. The offered figure is what we quoted
  // the customer; once they pay it, it IS shippingCharged. It must not enter the arithmetic twice.
  const shared: OrderMoneyFacts = {
    subtotalSatang: 890_000,
    discountTotalSatang: 0,
    grandTotalSatang: 902_000,
    shippingChargedSatang: 12_000,
    shippingRealSatang: 27_500,
    lines: [{ unitCostSatang: 610_000, quantity: 1 }],
    storedProfitSatang: 280_000,
  };

  it("฿11.8kg parcel, ฿260 quoted, ฿120 offered and paid, ฿275 real > profit ฿2,645", () => {
    const m = orderMoney(shared);
    expect(m.shippingShortfallSatang).toBe(15_500);
    expect(m.profitSatang).toBe(264_500);
  });

  it("cross-check against cash in and cash out", () => {
    // Cash in 902,000. Cash out: 610,000 goods + 27,500 carrier = 637,500. Difference 264,500.
    expect(orderMoney(shared).profitSatang).toBe(902_000 - 610_000 - 27_500);
  });
});

describe("orderMoney > edge values", () => {
  it("no coupon > goods after discount is the subtotal", () => {
    const m = orderMoney({ ...SIGNED_OFF, discountTotalSatang: 0, grandTotalSatang: 455_000 });
    expect(m.goodsAfterDiscountSatang).toBe(450_000);
  });

  it("free shipping offered to the customer > the whole carrier charge is on us", () => {
    const m = orderMoney({ ...SIGNED_OFF, shippingChargedSatang: 0, grandTotalSatang: 430_000 });
    expect(m.shippingShortfallSatang).toBe(9_000);
    expect(m.profitSatang).toBe(131_000);
  });

  it("no lines at all > item cost is zero, not NaN", () => {
    const m = orderMoney({ ...SIGNED_OFF, lines: [] });
    expect(m.itemCostSatang).toBe(0);
    expect(m.profitSatang).toBe(426_000);
  });

  it("a loss reads as a negative profit rather than being hidden", () => {
    const m = orderMoney({
      ...SIGNED_OFF,
      lines: [{ unitCostSatang: 500_000, quantity: 1 }],
    });
    expect(m.profitSatang).toBe(-74_000);
  });
});

describe("orderMoney > a fully refunded failed delivery", () => {
  // ตีกลับ: the parcel bounced, we refund the customer in full, and the goods come back into stock.
  // The sale unwinds — revenue returned, goods restocked — so the only cost we cannot recover is the
  // carrier charge already paid. Profit must read as that shipping loss, never the stale full margin.
  const refunded: OrderMoneyFacts = { ...SIGNED_OFF, refundedSatang: 435_000 };

  it("full refund, goods restocked > profit is the sunk carrier charge as a loss", () => {
    // 435,000 in, 435,000 back out → customer nets zero; the carrier billed 9,000 we can't recover.
    expect(orderMoney(refunded).profitSatang).toBe(-9_000);
  });

  it("no refund > profit is unchanged", () => {
    expect(orderMoney(SIGNED_OFF).profitSatang).toBe(136_000);
  });

  it("item cost never matched, but a full refund still shows the shipping loss", () => {
    // The bounce cost does not need the cost snapshot: the goods are back in stock, so their cost is
    // irrelevant to what the failed delivery cost us. Only the unrecoverable carrier charge remains.
    const m = orderMoney({ ...refunded, storedProfitSatang: null });
    expect(m.profitSatang).toBe(-9_000);
  });
});
