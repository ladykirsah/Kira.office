/**
 * The two books of one AirPlus order: what the customer was charged, and what we kept.
 *
 * Derived, never stored. `sales_orders.profit_satang` is written once at checkout as
 * `Σ(price − cost)×qty − discount` and nothing ever recomputes it, so it cannot account for shipping
 * we absorb — the carrier's real charge is unknowable until someone drops the parcel off, hours or
 * days later. A stored profit is therefore wrong for that whole window, on a number the owner reads
 * daily. Deriving it here means /orders and /orders/:id can never disagree either.
 *
 * The one thing to get right is not counting the shipping fee twice. The customer's fee is inside
 * `customerPaidSatang`; our book starts from goods AFTER discount, which excludes it, so our book
 * deducts only the SHORTFALL — real charge minus what the customer paid. The two valid pairings are:
 *
 *   customerPaid      − itemCost − realCharge   ≡   goodsAfterDiscount − itemCost − shortfall
 *
 * Mixing them puts profit out by exactly the fee, in one direction or the other.
 */

export interface OrderMoneyFacts {
  subtotalSatang: number;
  discountTotalSatang: number;
  /** The authoritative charge. Used as-is rather than recomputed — it is what the customer paid. */
  grandTotalSatang: number;
  /** `shipping_fee_satang` — what we billed the customer for delivery. */
  shippingChargedSatang: number;
  /** What the carrier actually charged, from the drop-off receipt. Null until a drop-off is recorded. */
  shippingRealSatang: number | null;
  lines: readonly { unitCostSatang: number; quantity: number }[];
  /**
   * `sales_orders.profit_satang`. Only its NULL-ness is read, never its value: null means the
   * order's SKUs were never matched to Kira products, so the per-line cost snapshot is absent and no
   * profit may be claimed. Its value is the stale checkout figure this function exists to replace.
   */
  storedProfitSatang: number | null;
  /**
   * Money returned to the customer, satang. Absent or 0 = not refunded. For a failed-delivery
   * refund it is the full grand total and the goods are restocked — so the sale unwinds and the
   * only cost we cannot recover is the carrier charge. Profit then reads as that shipping loss.
   */
  refundedSatang?: number;
}

export interface OrderMoney {
  /** Customer book, bottom line. */
  customerPaidSatang: number;
  /** Our book, top line: goods revenue after the coupon. The base margin is measured against. */
  goodsAfterDiscountSatang: number;
  itemCostSatang: number;
  /**
   * Real carrier charge minus what the customer paid. Negative when we charged more than the carrier
   * billed — that gain is real and is not clamped away. Null until a drop-off is recorded, which is
   * distinct from zero: null is "not measured yet", zero is "delivery cost us nothing".
   */
  shippingShortfallSatang: number | null;
  /** Null when item cost is unknown — see `storedProfitSatang`. */
  profitSatang: number | null;
}

export function orderMoney(facts: OrderMoneyFacts): OrderMoney {
  const goodsAfterDiscountSatang = facts.subtotalSatang - facts.discountTotalSatang;
  const itemCostSatang = facts.lines.reduce((n, l) => n + l.unitCostSatang * l.quantity, 0);
  const shippingShortfallSatang =
    facts.shippingRealSatang == null
      ? null
      : facts.shippingRealSatang - facts.shippingChargedSatang;

  // A refund unwinds the sale: the money goes back and the bounced goods are restocked, so their
  // cost is recovered and drops out. What remains is the carrier charge we already paid and cannot
  // claw back. Because item cost is no longer in play, this holds even when it was never known.
  const refundedSatang = facts.refundedSatang ?? 0;
  const profitSatang =
    refundedSatang > 0
      ? facts.grandTotalSatang - refundedSatang - (facts.shippingRealSatang ?? 0)
      : facts.storedProfitSatang == null
        ? null
        : goodsAfterDiscountSatang - itemCostSatang - (shippingShortfallSatang ?? 0);

  return {
    customerPaidSatang: facts.grandTotalSatang,
    goodsAfterDiscountSatang,
    itemCostSatang,
    shippingShortfallSatang,
    profitSatang,
  };
}
