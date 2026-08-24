import { totalCostSatang, commissionFeeSatang, profitSatang } from "./pricing";

/** What a product is priced at across the four selling tiers, plus the one shared cost base. */
export interface TierPrices {
  costSatang: number;
  /** Add 7% VAT to the cost before any profit is figured. Applies to all four tiers alike. */
  taxOnCost: boolean;
  /** On-site B2C — the Den Air Service counter price. */
  b2cSatang: number;
  b2bSatang: number;
  /** The owner's own storefront. */
  airplusSatang: number;
  /** "AC on Sales" — the Shopee reference price, kept by hand. */
  shopeeSatang: number;
  /** Shopee's marketplace commission, basis points. Applies to the Shopee tier ONLY. */
  commissionBp: number;
}

export interface TierProfit {
  b2c: number;
  b2b: number;
  airplus: number;
  shopee: number;
}

/**
 * Profit for each selling tier. The owner's rule, 2026-08-24:
 *
 *   "they are independent to calculate profit, they only based on the same cost."
 *
 * So the cost base is the single shared input. Each tier is its own price minus that cost — and
 * Shopee alone also pays a commission, worked out from ITS OWN price, because that is a marketplace
 * fee. AirPlus is the owner's shop and pays none; the two on-site tiers pay none.
 *
 * WHY THIS IS ONE FUNCTION. The formula used to be written out three times — the edit form, the
 * product page and the products table — and two of the three had drifted, in different directions:
 * the edit form charged Shopee a commission calculated on the AIRPLUS price, and the table charged
 * AIRPLUS a commission it does not pay. Three copies of a formula is three chances to disagree, and
 * they took two of them. The independence tests are what stop it happening again.
 */
export function tierProfits(p: TierPrices): TierProfit {
  const cost = totalCostSatang(p.costSatang, p.taxOnCost);
  return {
    b2c: profitSatang(p.b2cSatang, cost, 0),
    b2b: profitSatang(p.b2bSatang, cost, 0),
    airplus: profitSatang(p.airplusSatang, cost, 0),
    shopee: profitSatang(p.shopeeSatang, cost, commissionFeeSatang(p.shopeeSatang, p.commissionBp)),
  };
}
