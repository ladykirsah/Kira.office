import { describe, it, expect } from "vitest";
import { shopeeSign, buildShopeeRequest, shopeeAuthFromEnv } from "./shopee";

describe("shopee v2 signing", () => {
  it("shopeeSign is deterministic 64-char hex", async () => {
    const a = await shopeeSign("partner-key", "base-string");
    const b = await shopeeSign("partner-key", "base-string");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("public request carries partner_id, timestamp and sign (no token)", async () => {
    const url = await buildShopeeRequest(
      "https://partner.shopeemobile.com",
      "/api/v2/product/get_item_list",
      { partnerId: "123", partnerKey: "key" },
      1700000000,
    );
    expect(url).toContain("partner_id=123");
    expect(url).toContain("timestamp=1700000000");
    expect(url).toMatch(/sign=[0-9a-f]{64}/);
    expect(url).not.toContain("access_token");
  });

  it("shop-scoped request adds access_token + shop_id", async () => {
    const url = await buildShopeeRequest(
      "https://h",
      "/p",
      { partnerId: "1", partnerKey: "k", accessToken: "tok", shopId: "77" },
      1,
    );
    expect(url).toContain("access_token=tok");
    expect(url).toContain("shop_id=77");
  });

  it("shopeeAuthFromEnv returns null until configured", () => {
    expect(shopeeAuthFromEnv({})).toBeNull();
    expect(shopeeAuthFromEnv({ SHOPEE_PARTNER_ID: "1", SHOPEE_PARTNER_KEY: "k" })).toEqual({
      partnerId: "1",
      partnerKey: "k",
      shopId: undefined,
      accessToken: undefined,
    });
  });
});
