/**
 * Thai postcode → ตำบล/อำเภอ/จังหวัด autofill.
 * Data: earthchie/jquery.Thailand.js raw_database (MIT) → compacted to public/thai-postcodes.json
 * as `{ "<zip>": [[tambon, amphoe, province], ...] }`. One zip can span >1 อำเภอ, so the tambon
 * dropdown carries each row's own อำเภอ/จังหวัด and refines them on select.
 */
export type PostcodeEntry = { tambon: string; amphoe: string; province: string };
export type PostcodeMap = Record<string, [string, string, string][]>;

/**
 * Resolve a 5-digit zip to its tambon options plus a best-guess province/อำเภอ (the first row).
 * Returns null for an unknown zip.
 */
export function resolvePostcode(
  map: PostcodeMap,
  zip: string,
): { province: string; amphoe: string; tambons: PostcodeEntry[] } | null {
  const rows = map[zip];
  if (!rows || rows.length === 0) return null;
  const tambons = rows.map(([tambon, amphoe, province]) => ({ tambon, amphoe, province }));
  return { province: tambons[0].province, amphoe: tambons[0].amphoe, tambons };
}

let cache: Promise<PostcodeMap> | null = null;
/** Lazily fetch + memoize the postcode table (served gzipped from /public). */
export function loadPostcodes(): Promise<PostcodeMap> {
  if (!cache) cache = fetch("/thai-postcodes.json").then((r) => r.json() as Promise<PostcodeMap>);
  return cache;
}
