import { warrantyThai } from "@l-shopee/core";
import { carName, type MyCar } from "./myCar";

/**
 * The phone product page (AirPlus board 3, owner-approved 14 Nov 2026): ใส่ได้กับรถ shown open with
 * every model ("i want ใส่ได้กับรถ to be default shown of all models - not hidden"), the car card for
 * รถของฉัน, รายละเอียดสินค้า, then one card of การจัดส่ง · รับประกัน · เงื่อนไข · คืน·เคลม ("put topic in
 * pic2 and the other 2 topics on pic1 to be in the same section"). Pure helpers only — no DOM.
 */

export interface Fitment {
  carBrand: string | null;
  carModel: string | null;
  yearFrom: number | null;
  yearTo: number | null;
}

export interface FitRow {
  name: string;
  years: string;
  /** the shopper's saved car is this model (its ✓ is blue) */
  mine: boolean;
}

export interface CarCardWords {
  kind: "yes" | "no" | "none";
  title: string;
  sub: string;
  action: string;
}

export interface InfoRow {
  key: "ship" | "warranty" | "terms" | "returns";
  label: string;
  value: string;
}

/** "Toyota Vigo" — brand then model, whichever the fitment has. */
export function fitmentName(f: Pick<Fitment, "carBrand" | "carModel">): string {
  return [f.carBrand, f.carModel].filter(Boolean).join(" ");
}

/** "2004–2015", "2011 ขึ้นไป", "ถึงปี 2015", or nothing. */
export function fitmentYears(f: Pick<Fitment, "yearFrom" | "yearTo">): string {
  if (f.yearFrom != null && f.yearTo != null) return `${f.yearFrom}–${f.yearTo}`;
  if (f.yearFrom != null) return `${f.yearFrom} ขึ้นไป`;
  if (f.yearTo != null) return `ถึงปี ${f.yearTo}`;
  return "";
}

/** The same test GET /api/fits makes: one fitment row with the car's brand, model and year in range. */
function rowFits(f: Fitment, car: MyCar): boolean {
  if (f.carBrand !== car.brand || f.carModel !== car.model) return false;
  if (car.year === null) return true;
  return (
    (f.yearFrom == null || f.yearFrom <= car.year) && (f.yearTo == null || f.yearTo >= car.year)
  );
}

export function fitRows(fitments: readonly Fitment[], car: MyCar | null): FitRow[] {
  return fitments.map((f) => ({
    name: fitmentName(f),
    years: fitmentYears(f),
    mine: car !== null && rowFits(f, car),
  }));
}

function carWithYear(car: MyCar): string {
  return car.year === null ? carName(car) : `${carName(car)} ${car.year}`;
}

/** The car card under the price; none for a part made for no car (oil). */
export function carCard(fitments: readonly Fitment[], car: MyCar | null): CarCardWords | null {
  if (fitments.length === 0) return null;
  if (!car) {
    return {
      kind: "none",
      title: "ใส่กับรถของคุณได้ไหม",
      sub: "เลือกรถ แล้วเราบอกให้",
      action: "เลือกรถ",
    };
  }
  if (fitments.some((f) => rowFits(f, car))) {
    return { kind: "yes", title: "ใส่ได้กับรถของคุณ", sub: carWithYear(car), action: "เปลี่ยนรถ" };
  }
  const more = fitments.length - 1;
  const first = fitmentName(fitments[0]!);
  return {
    kind: "no",
    title: `ไม่ใช่ของ ${carWithYear(car)}`,
    sub: more > 0 ? `ใส่ได้กับ ${first} และอีก ${more} รุ่น` : `ใส่ได้กับ ${first}`,
    action: "เปลี่ยนรถ",
  };
}

/** One card: การจัดส่ง · รับประกัน (when the category has one) · เงื่อนไข (when written) · คืน·เคลม. */
export function infoRows(p: {
  warrantyDays: number | null;
  hasTerms: boolean;
  categoryName: string | null;
}): InfoRow[] {
  const rows: InfoRow[] = [{ key: "ship", label: "การจัดส่ง", value: "Flash Express" }];
  if (p.warrantyDays && p.warrantyDays > 0) {
    rows.push({ key: "warranty", label: "รับประกัน", value: warrantyThai(p.warrantyDays) });
  }
  if (p.hasTerms) {
    rows.push({ key: "terms", label: "เงื่อนไข", value: `ของหมวด${p.categoryName ?? "นี้"}` });
  }
  rows.push({ key: "returns", label: "คืน · เคลม", value: "การคืน ยกเลิก เคลม" });
  return rows;
}

/** "1.3 กก."; a part under a kilo in grams ("10 กรัม"), so an O-ring never reads 0.0 กก. */
function weightText(grams: number): string {
  return grams < 1000 ? `${grams} กรัม` : `${(grams / 1000).toFixed(1)} กก.`;
}

/** รายละเอียดสินค้า: หมวดหมู่ · แบรนด์ · น้ำหนัก, whichever the product has. */
export function specRows(p: {
  categoryName: string | null;
  brandName: string | null;
  weightGrams: number;
}): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (p.categoryName) rows.push({ label: "หมวดหมู่", value: p.categoryName });
  if (p.brandName) rows.push({ label: "แบรนด์", value: p.brandName });
  if (p.weightGrams > 0) rows.push({ label: "น้ำหนัก", value: weightText(p.weightGrams) });
  return rows;
}

/** The flash strip's "-10%"; null when there is no higher old price. */
export function salePercent(priceSatang: number, compareAtSatang: number | null): number | null {
  if (compareAtSatang == null || compareAtSatang <= priceSatang) return null;
  return Math.round((1 - priceSatang / compareAtSatang) * 100);
}
