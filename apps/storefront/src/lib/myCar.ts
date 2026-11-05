/**
 * รถของฉัน (board 1, owner-approved 5 Nov 2026): the shopper picks brand › model › year once; the
 * choice is remembered on their own phone (localStorage — no account needed) and every product then
 * says whether it fits. Pure helpers only (no DOM, no fetch) so they are unit-tested.
 */

export interface MyCar {
  brand: string;
  model: string;
  /** the model era from the owner's car taxonomy (car_models.year_from / year_to) */
  yearFrom: number | null;
  yearTo: number | null;
  /** the shopper's year; null = "ไม่ทราบปี" */
  year: number | null;
}

export const MY_CAR_KEY = "airplus:my-car";
const MAX_NAME = 64;
const MIN_YEAR = 1950;
const MAX_YEAR = 2100;
const DEFAULT_SPAN = 30;

const isName = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= MAX_NAME;
const isYear = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= MIN_YEAR && v <= MAX_YEAR;
const isYearOrNull = (v: unknown): v is number | null => v === null || isYear(v);

/** Read what was saved. Anything broken or tampered with reads as "no car" (never throws). */
export function parseMyCar(raw: string | null): MyCar | null {
  if (!raw) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!isName(o.brand) || !isName(o.model)) return null;
  if (!isYearOrNull(o.yearFrom) || !isYearOrNull(o.yearTo) || !isYearOrNull(o.year)) return null;
  return { brand: o.brand, model: o.model, yearFrom: o.yearFrom, yearTo: o.yearTo, year: o.year };
}

export function serializeMyCar(car: MyCar): string {
  return JSON.stringify(car);
}

export function carName(car: MyCar): string {
  return `${car.brand} ${car.model}`;
}

/** "ปี 2012 · อะไหล่ที่ใส่ได้ 3 รายการ"; while the count loads, just the year part. */
export function carYearLine(car: MyCar, count: number | null): string {
  const year = car.year === null ? "ไม่ทราบปี" : `ปี ${car.year}`;
  return count === null ? year : `${year} · อะไหล่ที่ใส่ได้ ${count} รายการ`;
}

/** A model's era beside its name in the model sheet: "2004–2015", "2020–ปัจจุบัน". */
export function eraLabel(from: number | null, to: number | null): string {
  if (from === null) return "";
  return `${from}–${to ?? "ปัจจุบัน"}`;
}

/** Years to pick from, newest first. Open era → up to this year; no era → the last 30 years. */
export function yearChoices(from: number | null, to: number | null, nowYear: number): number[] {
  const top = to ?? nowYear;
  const bottom = from ?? top - DEFAULT_SPAN + 1;
  const out: number[] = [];
  for (let y = top; y >= bottom; y -= 1) out.push(y);
  return out;
}

/**
 * The extra line under a product's name (after พร้อมส่ง, before the price — owner, 5 Nov 2026).
 * Nothing when no car is saved or the part is made for no car (oil).
 */
export function fitLine(
  car: MyCar | null,
  hasFitment: boolean,
  fits: boolean,
): { fits: boolean; text: string } | null {
  if (!car || !hasFitment) return null;
  if (!fits) return { fits: false, text: `ไม่ใช่ของ ${car.model}` };
  return {
    fits: true,
    text: car.year === null ? `ใส่ได้กับ ${car.model}` : `ใส่ได้กับ ${car.model} ${car.year}`,
  };
}

/** Query string for GET /api/fits. */
export function fitsQuery(car: MyCar): string {
  const p = new URLSearchParams({ carBrand: car.brand, carModel: car.model });
  if (car.year !== null) p.set("year", String(car.year));
  return p.toString();
}

/** Validate /api/fits params (they come from the shopper's browser). null = reject. */
export function parseFitsParams(
  p: URLSearchParams,
): { carBrand: string; carModel: string; year?: number } | null {
  const carBrand = p.get("carBrand");
  const carModel = p.get("carModel");
  if (!isName(carBrand) || !isName(carModel)) return null;
  const rawYear = p.get("year");
  if (rawYear === null || rawYear === "") return { carBrand, carModel };
  if (!/^\d{4}$/.test(rawYear)) return null;
  const year = Number(rawYear);
  if (!isYear(year)) return null;
  return { carBrand, carModel, year };
}

export type TabKey = "home" | "cats" | "track" | "me";

/** The bottom bar shows on main pages only (pages with ‹ back have none — rulebook §4). */
export function tabForPath(path: string): TabKey | null {
  switch (path) {
    case "/":
      return "home";
    case "/categories":
      return "cats";
    case "/orders":
      return "track";
    case "/account":
      return "me";
    default:
      return null;
  }
}
