/**
 * Pure pricing math (satang). The cost base is the item cost plus 7% VAT when taxOnCost is on; every
 * tier's profit is its price minus that base, minus any Shopee commission (online tiers only).
 */
/** Coerce a possibly-missing/NaN value (e.g. a field absent from an older API response) to 0. */
const n = (x: number): number => (Number.isFinite(x) ? x : 0);

export function totalCostSatang(costSatang: number, taxOnCost: boolean): number {
  return taxOnCost ? Math.round(n(costSatang) * 1.07) : n(costSatang);
}

export function commissionFeeSatang(priceSatang: number, commissionBp: number): number {
  return Math.round((n(priceSatang) * n(commissionBp)) / 10000);
}

export function profitSatang(
  priceSatang: number,
  totalCostSatang: number,
  feeSatang: number,
): number {
  return n(priceSatang) - n(totalCostSatang) - n(feeSatang);
}

export function marginPct(profitSatang: number, priceSatang: number): number {
  const price = n(priceSatang);
  return price > 0 ? (n(profitSatang) / price) * 100 : 0;
}
