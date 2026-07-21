/**
 * The two businesses that share this back office, and the KV key namespace that keeps them apart.
 *
 * Den Air Service (the workshop — POS, bills, quotations) and AirPlus (the online storefront) are
 * FULLY SEPARATE: different bank account, different LINE, different logo. Nothing is shared, so a
 * change to one can never surface on the other.
 *
 * Settings used to live at unnamespaced keys (`shop:name`) shared by both. Those keys are dead —
 * `shopKey` deliberately produces `shop:<profile>:<field>`, which cannot be mistaken for one, so a
 * reader that was never updated fails loudly (missing value) rather than quietly serving the wrong
 * shop's bank account.
 */

export const SHOP_PROFILES = ["denair", "airplus"] as const;

export type ShopProfile = (typeof SHOP_PROFILES)[number];

/** Display names for the admin's profile tabs. */
export const SHOP_PROFILE_LABELS: Record<ShopProfile, string> = {
  denair: "Den Air Service",
  airplus: "AirPlus",
};

export function isShopProfile(value: string): value is ShopProfile {
  return (SHOP_PROFILES as readonly string[]).includes(value);
}

/**
 * Validate a profile that arrived from a URL segment.
 *
 * Returns `null` rather than a default so the caller 404s on an unknown profile. Guessing would
 * mean writing one shop's settings into the other's namespace.
 */
export function parseShopProfile(value: string | undefined): ShopProfile | null {
  if (!value) return null;
  return isShopProfile(value) ? value : null;
}

/**
 * KV key for one field of one profile.
 *
 * `profile` must already be validated (see `parseShopProfile`) — it is concatenated into the key,
 * so an unvalidated value would let a crafted URL segment reach into another namespace.
 */
export function shopKey(profile: ShopProfile, field: string): string {
  return `shop:${profile}:${field}`;
}
