import { describe, it, expect } from "vitest";
import { FLASH_TH_RATE_CARD, isRemotePostcode } from "./flashRates";
import { quoteShippingSatang, feeForChargeableKg } from "./shipping";

describe("FLASH_TH_RATE_CARD", () => {
  it("is a well-formed card: non-empty tiers, positive fees, 5000 divisor", () => {
    expect(FLASH_TH_RATE_CARD.tiers.length).toBeGreaterThan(0);
    expect(FLASH_TH_RATE_CARD.volumetricDivisor).toBe(5000);
    expect(FLASH_TH_RATE_CARD.remoteSurchargeSatang).toBe(5000); // ฿50
    for (const tier of FLASH_TH_RATE_CARD.tiers) {
      expect(tier.uptoKg).toBeGreaterThan(0);
      expect(tier.feeSatang).toBeGreaterThan(0);
    }
  });

  it("tiers are sorted ascending and fees never decrease as weight grows", () => {
    const tiers = FLASH_TH_RATE_CARD.tiers;
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i]!.uptoKg).toBeGreaterThan(tiers[i - 1]!.uptoKg);
      expect(tiers[i]!.feeSatang).toBeGreaterThanOrEqual(tiers[i - 1]!.feeSatang);
    }
  });

  it("prices the base tier at ฿25 and a ~3kg parcel within the published band", () => {
    // A small light parcel -> base tier.
    expect(feeForChargeableKg(0.4, FLASH_TH_RATE_CARD)).toBe(2500);
    // ~3 kg chargeable should land in the published mid-range (฿34–฿50).
    const midFee = feeForChargeableKg(3, FLASH_TH_RATE_CARD);
    expect(midFee).toBeGreaterThanOrEqual(3400);
    expect(midFee).toBeLessThanOrEqual(5000);
  });

  it("plugs into quoteShippingSatang for a typical single-item cart", () => {
    const items = [
      {
        weightGrams: 1200,
        dims: { widthMm: 200, lengthMm: 200, heightMm: 150 },
        qty: 1,
      },
    ];
    const fee = quoteShippingSatang(items, false, FLASH_TH_RATE_CARD);
    expect(fee).toBeGreaterThan(0);
    // Remote adds exactly the ฿50 surcharge.
    expect(quoteShippingSatang(items, true, FLASH_TH_RATE_CARD)).toBe(fee + 5000);
  });
});

describe("isRemotePostcode", () => {
  const remote = new Set(["94110", "81000"]);

  it("returns true for a postcode in the remote set", () => {
    expect(isRemotePostcode("94110", remote)).toBe(true);
  });

  it("returns false for a non-remote postcode", () => {
    expect(isRemotePostcode("10110", remote)).toBe(false);
  });

  it("trims surrounding whitespace before matching", () => {
    expect(isRemotePostcode("  81000 ", remote)).toBe(true);
  });

  it("returns false for empty, malformed, or non-5-digit input", () => {
    expect(isRemotePostcode("", remote)).toBe(false);
    expect(isRemotePostcode("8100", remote)).toBe(false);
    expect(isRemotePostcode("abcde", remote)).toBe(false);
  });

  it("returns false when the remote set is empty (no list loaded yet)", () => {
    expect(isRemotePostcode("94110", new Set())).toBe(false);
  });
});
