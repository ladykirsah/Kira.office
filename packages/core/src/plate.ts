import { PROVINCES } from "./provinces";

export { PROVINCES };

/**
 * A car's plate, saved one way (bug hunt 15 Nov 2026, plan 8.5): "กข1234", "กข  1234" and
 * "กข-1234" were three different cars, so one car's bills and history split.
 *
 * - A car plate: an optional number, Thai letters, one space, numbers ("1กก 1234", "กข 1234").
 * - A truck or bus plate: two digits, a dash, four digits ("70-1234").
 * - Anything else is kept as typed, with its spaces tidied.
 */

const CAR = /^(\d{0,2})\s*([ก-ฮ]{1,3})[\s-]*(\d{1,4})$/;
const TRUCK = /^(\d{2})[\s-]*(\d{4})$/;

export function canonicalPlate(raw: string): string {
  const tidy = raw.trim().replace(/\s+/g, " ");
  const car = CAR.exec(tidy);
  if (car) return `${car[1]}${car[2]} ${car[3]}`;
  const truck = TRUCK.exec(tidy);
  if (truck) return `${truck[1]}-${truck[2]}`;
  return tidy;
}

/** The plate with every space and dash removed, for matching however it was typed. */
export function plateKey(raw: string): string {
  return raw.replace(/[\s-]+/g, "");
}

/**
 * Short names people type for a province, mapped to the official one. Bangkok has the most; the
 * rest are the two everyone uses instead of the official name.
 */
const PROVINCE_ALIASES: Record<string, string> = {
  กทม: "กรุงเทพมหานคร",
  "กทม.": "กรุงเทพมหานคร",
  กรุงเทพ: "กรุงเทพมหานคร",
  กรุงเทพฯ: "กรุงเทพมหานคร",
  "กรุงเทพ มหานคร": "กรุงเทพมหานคร",
  bangkok: "กรุงเทพมหานคร",
  bkk: "กรุงเทพมหานคร",
  อยุธยา: "พระนครศรีอยุธยา",
  โคราช: "นครราชสีมา",
};

const OFFICIAL = new Set(PROVINCES);

/**
 * The province on a plate, saved one way (plan 13.11): its official name when it is one of the 77
 * or a known short name ("กทม" → "กรุงเทพมหานคร"), with any "จ." / "จังหวัด" in front dropped.
 * Anything else is kept as typed, spaces tidied — the pick list on ทำบิล comes with Stage 12.
 */
export function canonicalProvince(raw: string): string {
  const tidy = raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(จังหวัด|จ\.)\s*/, "");
  if (OFFICIAL.has(tidy)) return tidy;
  return PROVINCE_ALIASES[tidy.toLowerCase()] ?? tidy;
}

/**
 * A plate needs its province (owner's pick A, 21 Nov 2026), or one car could become two. No plate
 * at all is fine: a parts sale has no car.
 */
export function carProblem(plate: string, province: string | null): "province_required" | null {
  if (!plate.trim()) return null;
  return (province ?? "").trim() ? null : "province_required";
}
