/**
 * Bilingual names for the managed taxonomy: car brands, car models, car systems and product
 * categories.
 *
 * BACKGROUND. Each of those tables has carried exactly ONE `name` since 0005/0007, and which
 * language it held was never fixed — `product_types.name` is Thai for the seeded rows but English
 * for everything the owner has added since ("Cabin blower resistor"), while `car_brands.name` is
 * English ("Toyota"). The storefront papered over this with two hardcoded maps in
 * apps/storefront/src/lib/labels.ts, which only covered 5 part types and 11 car brands. Anything
 * the owner added themselves got one line on the tile while the mapped rows got two, which is the
 * inconsistency they spotted between the category row and the car-brand row.
 *
 * WHY `name` SURVIVES UNTOUCHED. It is not merely a label: `product_fitments.car_brand` references
 * `car_brands.name` as free TEXT, not by id (see carBrandTiles in apps/storefront/src/lib/db.ts),
 * and every one of these tables has a UNIQUE index on it. Repurposing or rewriting `name` would
 * silently orphan fitments. So `name` stays the identity, and `name_th` / `name_en` are added
 * beside it purely for display.
 */

/** Thai block: U+0E00–U+0E7F. Unambiguous against Latin, which is all we need to tell apart. */
const THAI = /[฀-๿]/;

/** Whether a string contains any Thai character. */
export function hasThaiScript(text: string): boolean {
  return THAI.test(text);
}

/** Treat null, undefined and whitespace-only alike — the admin form posts "" for an empty field. */
function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Decide which column an existing single `name` belongs in, for the one-off backfill.
 *
 * Script is the only signal available and it is a reliable one here: the catalogue is Thai and
 * English only, so "contains a Thai character" settles it.
 */
export function splitLegacyName(name: string): { nameTh: string | null; nameEn: string | null } {
  const value = clean(name);
  if (!value) return { nameTh: null, nameEn: null };
  return hasThaiScript(value) ? { nameTh: value, nameEn: null } : { nameTh: null, nameEn: value };
}

/**
 * The two lines a storefront tile should render: a headline and an optional grey sub-line.
 *
 * Returns `en: null` whenever it would repeat the headline. A row the owner has only named in one
 * language must show that name ONCE — printing it twice reads as a rendering bug, not as a
 * translation. This is what lets a half-filled taxonomy still look deliberate.
 */
export function displayNames(row: {
  name: string;
  nameTh?: string | null;
  nameEn?: string | null;
}): { th: string; en: string | null } {
  const th = clean(row.nameTh);
  const en = clean(row.nameEn);
  const legacy = clean(row.name) ?? "";

  // Thai leads when we have it; otherwise the legacy name is all there is to lead with.
  const headline = th ?? legacy;
  // The sub-line is the English name, falling back to the legacy value once Thai has taken over
  // the headline (the car-brand case: name='Toyota', nameTh='โตโยต้า').
  const sub = en ?? (th ? legacy : null);

  return { th: headline, en: sub && sub !== headline ? sub : null };
}
