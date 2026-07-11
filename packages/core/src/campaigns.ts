/**
 * Flash-sale campaign pricing. ONE pure resolver used by both catalog display and checkout
 * re-pricing, so what the customer sees and what they are charged can never disagree. Purely
 * time-based — a campaign "ends" simply by its price no longer applying (no cron).
 */

export interface CampaignPriceInfo {
  campaignPriceSatang: number;
  startsAt: number;
  /** exclusive — at endsAt the price no longer applies */
  endsAt: number;
  status: "active" | "disabled";
  /** null = uncapped */
  stockCap: number | null;
  soldCount: number;
}

export interface EffectivePrice {
  priceSatang: number;
  onSale: boolean;
  /** the base price to strike through when onSale */
  compareAtSatang: number | null;
  /** countdown target when onSale */
  endsAt: number | null;
}

export function resolveEffectivePrice(
  basePriceSatang: number,
  campaign: CampaignPriceInfo | null | undefined,
  now: number,
): EffectivePrice {
  const base: EffectivePrice = {
    priceSatang: basePriceSatang,
    onSale: false,
    compareAtSatang: null,
    endsAt: null,
  };
  if (!campaign) return base;
  if (campaign.status !== "active") return base;
  if (now < campaign.startsAt || now >= campaign.endsAt) return base;
  if (campaign.stockCap !== null && campaign.soldCount >= campaign.stockCap) return base;
  // Flash sales only ever discount — a campaign price >= base is ignored, never shown.
  if (campaign.campaignPriceSatang >= basePriceSatang) return base;
  return {
    priceSatang: campaign.campaignPriceSatang,
    onSale: true,
    compareAtSatang: basePriceSatang,
    endsAt: campaign.endsAt,
  };
}
