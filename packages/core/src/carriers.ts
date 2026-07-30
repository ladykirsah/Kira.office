/**
 * The carriers a parcel can go out with.
 *
 * Shared because there are now two places that write `sales_orders.carrier` — the Sales → AirPlus
 * fulfilment editor and the drop-off form on /orders/:id. Two hardcoded copies would drift, and the
 * column is plain TEXT with no CHECK, so nothing downstream would notice a typo.
 *
 * Flash is first because it is the only one AirPlus actually uses today; the rest are here because
 * the owner asked for the carrier to be a choice rather than an assumption ("select Flash, in case we
 * provide more than Flash in the future").
 */
export const CARRIERS = [
  "Flash Express",
  "Kerry Express",
  "J&T Express",
  "ไปรษณีย์ไทย",
  "DHL",
] as const;

export type Carrier = (typeof CARRIERS)[number];

/** Pre-selected in the drop-off form: the one the owner uses. */
export const DEFAULT_CARRIER: Carrier = "Flash Express";

/**
 * The public tracking page for a carrier, or null when we have no link for it.
 *
 * Only reachable AFTER a drop-off: Flash issues the tracking number at the counter, so there is
 * nothing to link to while the order is still waiting to ship.
 */
export function trackingUrl(carrier: string | null, trackingNo: string | null): string | null {
  if (!carrier || !trackingNo) return null;
  const no = encodeURIComponent(trackingNo.trim());
  if (!no) return null;
  switch (carrier.trim()) {
    case "Flash Express":
      return `https://www.flashexpress.com/fle/tracking?se=${no}`;
    case "Kerry Express":
      return `https://th.kerryexpress.com/th/track/?track=${no}`;
    case "J&T Express":
      return `https://www.jtexpress.co.th/index/query/gzquery.html?bills=${no}`;
    case "ไปรษณีย์ไทย":
      return `https://track.thailandpost.co.th/?trackNumber=${no}`;
    default:
      return null;
  }
}
