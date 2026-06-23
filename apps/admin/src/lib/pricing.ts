/**
 * Pure pricing math (satang). The cost base is the item cost plus 7% VAT when taxOnCost is on; every
 * tier's profit is its price minus that base, minus any Shopee commission (online tiers only).
 */
export function totalCostSatang(costSatang: number, taxOnCost: boolean): number {
  return taxOnCost ? Math.round(costSatang * 1.07) : costSatang;
}

export function commissionFeeSatang(priceSatang: number, commissionBp: number): number {
  return Math.round((priceSatang * commissionBp) / 10000);
}

export function profitSatang(
  priceSatang: number,
  totalCostSatang: number,
  feeSatang: number,
): number {
  return priceSatang - totalCostSatang - feeSatang;
}

export function marginPct(profitSatang: number, priceSatang: number): number {
  return priceSatang > 0 ? (profitSatang / priceSatang) * 100 : 0;
}
