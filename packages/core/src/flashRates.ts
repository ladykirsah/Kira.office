import type { ShippingRateCard } from "./shipping";

/**
 * Flash Express Thailand domestic rate card — LAUNCH PLACEHOLDER.
 *
 * Transcribed from Flash's public "3/2568 – 1/2569" standard table (effective
 * 3 Dec 2025, general/Bangkok-metro column), volumetric divisor 5000 (cm), and
 * the published +฿50 remote-area surcharge. Flash's real pricing also varies by
 * origin↔destination zone and adds tourism/island surcharges; the AirPlus launch
 * calculator deliberately uses one national weight table (the owner absorbs any
 * small difference, or adds a zone table later).
 *
 * ⚠️ CONFIRM THESE NUMBERS against the shop's own Flash account before launch —
 * they come from a third-party rate list, not Flash's authenticated API. Editing
 * a fee is a one-line change here; the calculation logic in ./shipping is tested
 * against a separate fixture and does not depend on these values.
 *
 * fee is in satang (฿ × 100). `uptoKg` is the inclusive upper bound of a tier.
 */
export const FLASH_TH_RATE_CARD: ShippingRateCard = {
  tiers: [
    { uptoKg: 0.5, feeSatang: 2500 },
    { uptoKg: 1, feeSatang: 3000 },
    { uptoKg: 2, feeSatang: 3400 },
    { uptoKg: 3, feeSatang: 3500 },
    { uptoKg: 4, feeSatang: 5000 },
    { uptoKg: 5, feeSatang: 6100 },
    { uptoKg: 6, feeSatang: 7700 },
    { uptoKg: 7, feeSatang: 8900 },
    { uptoKg: 8, feeSatang: 10400 },
    { uptoKg: 9, feeSatang: 11600 },
    { uptoKg: 10, feeSatang: 13500 },
    { uptoKg: 11, feeSatang: 15800 },
    { uptoKg: 12, feeSatang: 16800 },
    { uptoKg: 13, feeSatang: 18100 },
    { uptoKg: 14, feeSatang: 19200 },
    { uptoKg: 15, feeSatang: 20400 },
    { uptoKg: 16, feeSatang: 22200 },
    { uptoKg: 17, feeSatang: 23300 },
    { uptoKg: 18, feeSatang: 24500 },
    { uptoKg: 19, feeSatang: 25700 },
  ],
  // Above 19 kg the published table climbs by roughly ฿12/kg; used for overflow.
  overflowPerKgSatang: 1200,
  volumetricDivisor: 5000,
  remoteSurchargeSatang: 5000, // ฿50
};

/**
 * Flash Express remote-area postcodes (the +฿50 surcharge) — distinct 5-digit
 * codes extracted from Flash's published "พื้นที่ห่างไกล/พื้นที่ท่องเที่ยวพิเศษ"
 * table (flashexpress.co.th/th/fle/outer/remote), captured 18 Jul 2026.
 *
 * Flash lists remote areas at the SUBDISTRICT (ตำบล) level; AirPlus collects only
 * a 5-digit postcode, so this is the postcode-level projection — 357 subdistrict
 * rows collapse to these 49 codes. A postcode shared between a remote and a
 * non-remote subdistrict is treated as remote (rare; over-charges a few edge
 * addresses by ฿50). Covers the deep south (Pattani/Yala/Narathiwat), far north
 * (Chiang Mai/Nan/Mae Hong Son remote districts), Tak, Phetchabun, Kanchanaburi.
 *
 * ⚠️ Re-capture periodically — Flash updates this table with the rate card.
 */
export const FLASH_TH_REMOTE_POSTCODES: ReadonlySet<string> = new Set([
  "50260",
  "50270",
  "50310",
  "50350",
  "55130",
  "55220",
  "58110",
  "58120",
  "58130",
  "58140",
  "58150",
  "63150",
  "63170",
  "67260",
  "71180",
  "71240",
  "82150",
  "94000",
  "94110",
  "94120",
  "94130",
  "94140",
  "94150",
  "94160",
  "94170",
  "94180",
  "94190",
  "94220",
  "94230",
  "95000",
  "95110",
  "95120",
  "95130",
  "95140",
  "95150",
  "95160",
  "95170",
  "96000",
  "96110",
  "96120",
  "96130",
  "96140",
  "96150",
  "96160",
  "96170",
  "96180",
  "96190",
  "96210",
  "96220",
]);

/**
 * Whether a destination postcode falls in Flash's remote-area list (the +฿50
 * surcharge). The remote list itself is injected — the caller loads it from the
 * published Flash remote-area data; an empty set means "no list loaded", which
 * simply applies no surcharge. Input is normalized to a bare 5-digit code.
 */
export function isRemotePostcode(postcode: string, remotePostcodes: ReadonlySet<string>): boolean {
  const normalized = postcode.trim();
  if (!/^\d{5}$/.test(normalized)) return false;
  return remotePostcodes.has(normalized);
}
