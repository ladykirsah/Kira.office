import { SITE_ORIGIN } from "./seo";
import { LINE_OA_URL } from "./links";

/**
 * Single source of truth for the shop's real-world identity (NAP: name / address / phone), used to
 * emit LocalBusiness structured data. Keep these IDENTICAL to the Google Business Profile — a matching
 * name/address/phone across listing + site + schema is what tells Google they're one real business
 * (helps verification + local ranking). Values from the owner's Google Business Profile (2026-07).
 */
export const SHOP = {
  /** Public brand name — matches the Google listing + airplusauto.com. Den Air Service is the operator. */
  name: "AirPlus",
  legalName: "Den Air Service",
  /** schema.org type — AutoPartsStore is a LocalBusiness subtype, matching the "Auto parts store" category. */
  schemaType: "AutoPartsStore",
  url: SITE_ORIGIN,
  telephone: "+66639261445", // 063 926 1445 in E.164
  address: {
    streetAddress: "Surin-Chongchom Rd, Prasat",
    addressLocality: "Prasat",
    addressRegion: "Surin",
    postalCode: "32140",
    addressCountry: "TH",
  },
  // Every day 08:30–17:00 — confirmed by the owner (2026-07). Keep in sync with the Google listing.
  hours: {
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    opens: "08:30",
    closes: "17:00",
  },
  /** Profiles that are the same business — reinforces the entity. Add Shopee / Facebook / Google later. */
  sameAs: [LINE_OA_URL],
} as const;

/** schema.org LocalBusiness (AutoPartsStore) built from SHOP — the site's half of the site↔listing link. */
export function localBusinessJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": SHOP.schemaType,
    name: SHOP.name,
    legalName: SHOP.legalName,
    url: SHOP.url,
    telephone: SHOP.telephone,
    address: {
      "@type": "PostalAddress",
      streetAddress: SHOP.address.streetAddress,
      addressLocality: SHOP.address.addressLocality,
      addressRegion: SHOP.address.addressRegion,
      postalCode: SHOP.address.postalCode,
      addressCountry: SHOP.address.addressCountry,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [...SHOP.hours.days],
        opens: SHOP.hours.opens,
        closes: SHOP.hours.closes,
      },
    ],
    sameAs: [...SHOP.sameAs],
  };
}
