/**
 * Sales channels — the single source of truth. Every screen, query, and enum references these.
 *   onsite    — Den Air Service walk-in shop (B2C & B2B; sale_type is the sub-distinction, not a channel)
 *   shopee    — "AC on Sales" marketplace
 *   airplus   — AirPlus, the second online store
 *   affiliate — commission from promoting other sellers' products (money only: no order, no stock)
 */
export const CHANNELS = ["onsite", "shopee", "airplus", "affiliate"] as const;
export type Channel = (typeof CHANNELS)[number];

/** Channels that create external marketplace orders (rows in sales_orders). */
export const ORDER_CHANNELS = ["shopee", "airplus"] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

export function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value);
}
