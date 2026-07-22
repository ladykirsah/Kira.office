/**
 * Bundled car-brand logos.
 *
 * This file used to also hold PART_TYPE_EN and CAR_BRAND_TH — hardcoded Thai↔English maps that
 * filled the second line of the home tiles. They covered 5 part types and 11 car brands, so any
 * category or make the OWNER added showed one line while the mapped ones showed two. That
 * inconsistency between the category row and the car-brand row is exactly what they reported.
 *
 * Migration 0060 moved those names into the database (`name_th` / `name_en` on car_brands,
 * car_models, usage_categories and product_types), seeded with the very translations that lived
 * here, and every tile now resolves them through displayNames() in @l-shopee/core. Both maps are
 * deleted rather than left to drift. Add a translation in Kira.office, not here.
 */

/** car_brand → make logo, bundled in /public/brands. Leading-slash path is served by the app itself
 *  (same convention as the banners). Add an entry + drop the file when a new brand appears.
 *
 *  Still a bundled map on purpose: this is an ASSET path, not owner-editable copy, and an
 *  owner-uploaded cover already takes priority over it (see resolveBrandLogo). */
export const CAR_BRAND_LOGO: Record<string, string> = {
  Toyota: "/brands/toyota.png",
  Honda: "/brands/honda.png",
  Isuzu: "/brands/isuzu.png",
};
