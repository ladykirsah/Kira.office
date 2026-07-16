/**
 * Standard Thai↔English display labels for the home category + by-brand browsers.
 *
 * The data model stores only ONE language per list — part types carry a Thai `name`, car brands
 * (from product_fitments.car_brand) are English — so these maps fill the second line of the tile
 * (Thai headline + English sub-line). Unmapped entries gracefully fall back to showing just the
 * language we already have. Extend here when the owner adds a new part type or car brand; a later
 * refactor can promote these to a `name_en` column (the `services` table already has that pattern).
 */

/** product_types.name (Thai) → English label. Keyed by the exact stored Thai name. */
export const PART_TYPE_EN: Record<string, string> = {
  คอยล์เย็น: "Evaporator",
  คอมเพรสเซอร์: "Compressor",
  คอยล์ร้อน: "Condenser",
  มอเตอร์พัดลม: "Fan motor",
  ไดเออร์: "Receiver drier",
  กล่องไม่สวย: "Open box",
};

/**
 * The "กล่องไม่สวย" category — first-hand parts, as good as new from the manufacturer, whose BOX is
 * scuffed, so they sell cheaper. It is a real product_types row (owner's call: these are listed as
 * their own products) and therefore lists on /categories like any other category.
 *
 * It is merchandising rather than a part type, though, so the home category strip deliberately hides
 * it — that strip answers "which part do you need?" and an offer type does not belong in that
 * question. Home surfaces it as its own product collection instead (owner, 2026-07-15).
 *
 * Matched by id, not name: ids are stable across the local and staging databases (both seeded by us),
 * whereas the Thai name is display copy the owner may reword.
 */
export const OPEN_BOX_TYPE_ID = "seed-type-uglybox";

/** product_fitments.car_brand (English) → Thai label. */
export const CAR_BRAND_TH: Record<string, string> = {
  Toyota: "โตโยต้า",
  Honda: "ฮอนด้า",
  Isuzu: "อีซูซุ",
  Nissan: "นิสสัน",
  Mitsubishi: "มิตซูบิชิ",
  Mazda: "มาสด้า",
  Ford: "ฟอร์ด",
  Chevrolet: "เชฟโรเลต",
  Suzuki: "ซูซูกิ",
  "Mercedes-Benz": "เมอร์เซเดส-เบนซ์",
  BMW: "บีเอ็มดับเบิลยู",
};

/** car_brand → make logo, bundled in /public/brands. Leading-slash path is served by the app itself
 *  (same convention as the banners). Add an entry + drop the file when a new brand appears. */
export const CAR_BRAND_LOGO: Record<string, string> = {
  Toyota: "/brands/toyota.png",
  Honda: "/brands/honda.png",
  Isuzu: "/brands/isuzu.png",
};
