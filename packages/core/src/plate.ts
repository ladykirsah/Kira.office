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
