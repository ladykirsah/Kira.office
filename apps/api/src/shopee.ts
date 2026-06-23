// Shopee Open Platform v2 adapter foundation. The live order-pull / stock-push calls are gated on
// the owner's managed-seller API eligibility + a v2 app (partner_id/key, shop access token). The
// request signing below is the verifiable core and is unit-tested; wire the higher-level calls once
// credentials exist. Stock deltas to push are computed by @l-shopee/core's computeShopeeStockUpdates.

/** HMAC-SHA256 hex signature, as Shopee's v2 API expects. */
export async function shopeeSign(partnerKey: string, baseString: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(partnerKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(baseString));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ShopeeAuth {
  partnerId: string;
  partnerKey: string;
  /** Shop-scoped APIs require both. */
  accessToken?: string;
  shopId?: string;
}

/**
 * Build a signed Shopee v2 API URL. Base string is partner_id + path + timestamp (+ access_token +
 * shop_id for shop-scoped calls); the sign is HMAC-SHA256(base, partner_key).
 */
export async function buildShopeeRequest(
  host: string,
  path: string,
  auth: ShopeeAuth,
  timestamp: number,
): Promise<string> {
  const base = `${auth.partnerId}${path}${timestamp}${auth.accessToken ?? ""}${auth.shopId ?? ""}`;
  const sign = await shopeeSign(auth.partnerKey, base);
  const params = new URLSearchParams({
    partner_id: auth.partnerId,
    timestamp: String(timestamp),
    sign,
  });
  if (auth.accessToken) params.set("access_token", auth.accessToken);
  if (auth.shopId) params.set("shop_id", auth.shopId);
  return `${host}${path}?${params.toString()}`;
}

/** Read Shopee credentials from the Worker env (set once the v2 app exists). null if not configured. */
export function shopeeAuthFromEnv(env: {
  SHOPEE_PARTNER_ID?: string;
  SHOPEE_PARTNER_KEY?: string;
  SHOPEE_SHOP_ID?: string;
  SHOPEE_ACCESS_TOKEN?: string;
}): ShopeeAuth | null {
  if (!env.SHOPEE_PARTNER_ID || !env.SHOPEE_PARTNER_KEY) return null;
  return {
    partnerId: env.SHOPEE_PARTNER_ID,
    partnerKey: env.SHOPEE_PARTNER_KEY,
    shopId: env.SHOPEE_SHOP_ID,
    accessToken: env.SHOPEE_ACCESS_TOKEN,
  };
}
