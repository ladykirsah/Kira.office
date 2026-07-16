import { describe, it, expect } from "vitest";
import { resolveEffectivePrice, type CampaignPriceInfo } from "./campaigns";

const NOW = 1_800_000_000_000;

const LIVE: CampaignPriceInfo = {
  campaignPriceSatang: 99000,
  startsAt: NOW - 1000,
  endsAt: NOW + 60_000,
  status: "active",
  stockCap: null,
  soldCount: 0,
};

describe("resolveEffectivePrice", () => {
  it("given no campaign > base price, not on sale", () => {
    expect(resolveEffectivePrice(145000, null, NOW)).toEqual({
      priceSatang: 145000,
      onSale: false,
      compareAtSatang: null,
      endsAt: null,
    });
  });

  it("given a live cheaper campaign > campaign price with the base as compare-at", () => {
    expect(resolveEffectivePrice(145000, LIVE, NOW)).toEqual({
      priceSatang: 99000,
      onSale: true,
      compareAtSatang: 145000,
      endsAt: LIVE.endsAt,
    });
  });

  it("given the window has not started or already ended > base price", () => {
    const early = { ...LIVE, startsAt: NOW + 1, endsAt: NOW + 100 };
    const ended = { ...LIVE, startsAt: NOW - 100, endsAt: NOW };
    expect(resolveEffectivePrice(145000, early, NOW).onSale).toBe(false);
    expect(resolveEffectivePrice(145000, ended, NOW).onSale).toBe(false); // endsAt exclusive
  });

  it("given a disabled campaign > base price", () => {
    expect(resolveEffectivePrice(145000, { ...LIVE, status: "disabled" }, NOW).onSale).toBe(false);
  });

  it("given the stock cap is sold out > base price", () => {
    const capped = { ...LIVE, stockCap: 5, soldCount: 5 };
    expect(resolveEffectivePrice(145000, capped, NOW).onSale).toBe(false);
    const remaining = { ...LIVE, stockCap: 5, soldCount: 4 };
    expect(resolveEffectivePrice(145000, remaining, NOW).onSale).toBe(true);
  });

  it("given a campaign price NOT cheaper than base > ignored (flash sales only discount)", () => {
    const notCheaper = { ...LIVE, campaignPriceSatang: 145000 };
    expect(resolveEffectivePrice(145000, notCheaper, NOW).onSale).toBe(false);
  });
});
