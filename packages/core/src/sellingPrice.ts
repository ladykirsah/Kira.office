/**
 * The half of a pricing profile that says what the shop CHARGES.
 *
 * Split out on 2026-08-24 when the owner refined "an admin cannot change price": an admin buys the
 * stock, so the COST is theirs to record — item cost and the VAT-on-cost switch. What the shop sells
 * at stays the owner's.
 *
 * `onlineCommissionBp` belongs here, not with cost: it is a deduction from what Shopee pays, so
 * moving it moves the margin exactly as moving a price would.
 */
export interface SellingPriceFields {
  /** On-site B2C — the Den Air Service counter price. */
  targetPriceSatang: number;
  b2bPriceSatang: number;
  /** The AirPlus storefront price. */
  onlinePriceSatang: number;
  /** "AC on Sales" reference price — optional, kept by hand, there is no Shopee API. */
  shopeePriceSatang?: number;
  onlineCommissionBp: number;
}

/** Absent and zero are the same thing here — see `sellingPricesChanged`. */
const n = (v: number | undefined) => v ?? 0;

/**
 * Would saving `incoming` move any price the shop sells at?
 *
 * Used to let a non-price-editor save a product whose selling prices they did not touch — an admin
 * editing a name, a fitment or the cost sends the whole profile back, and refusing that would make
 * the edit page useless to them. Only an actual difference is refused.
 *
 * Optional fields are compared through `?? 0`: a form that never filled in the Shopee price sends
 * `undefined` where the database holds `0`, and treating those as different would refuse an admin
 * for a field nobody typed in.
 */
export function sellingPricesChanged(
  stored: SellingPriceFields,
  incoming: SellingPriceFields,
): boolean {
  return (
    n(stored.targetPriceSatang) !== n(incoming.targetPriceSatang) ||
    n(stored.b2bPriceSatang) !== n(incoming.b2bPriceSatang) ||
    n(stored.onlinePriceSatang) !== n(incoming.onlinePriceSatang) ||
    n(stored.shopeePriceSatang) !== n(incoming.shopeePriceSatang) ||
    n(stored.onlineCommissionBp) !== n(incoming.onlineCommissionBp)
  );
}
