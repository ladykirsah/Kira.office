import type { Phrase } from "@l-shopee/shared/lang";
import { formatBaht } from "./money";
import type { ServiceRow } from "./posApi";
import { parseBaht } from "./productEdit";

/**
 * ตั้งค่าบริการ (canvas ตั้งค่าบริการ, approved 3 Nov 2026): the work and labour ทำบิล can pick, each with
 * a name, an English name and a starting price — ฿0 allowed, the price is set on the bill (owner:
 * "service be set as 0 THB"). Search shows only what matches; nothing found offers to add the words.
 */

export interface ServiceDraft {
  id: string | null;
  name: string;
  nameEn: string;
  /** The price as typed, in baht; empty saves as ฿0. */
  price: string;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** "บริการที่มี · 6", or "พบ 2 บริการ" while searching. */
export function listHeading(all: ServiceRow[], shown: ServiceRow[], q: string): Phrase {
  return q.trim()
    ? { th: `พบ ${shown.length} บริการ`, en: `${shown.length} found` }
    : { th: `บริการที่มี · ${all.length}`, en: `Services · ${all.length}` };
}

/** The Thai or the English name holds the words (any case); the list keeps its own order. */
export function findServices(list: ServiceRow[], q: string): ServiceRow[] {
  const words = q.trim().toLowerCase();
  if (!words) return list;
  return list.filter(
    (s) => s.name.toLowerCase().includes(words) || s.nameEn.toLowerCase().includes(words),
  );
}

export const notFound = (q: string): Phrase => ({
  th: `ไม่พบ “${q.trim()}”`,
  en: `No match for “${q.trim()}”`,
});

export const addFromSearch = (q: string): Phrase => ({
  th: `+ เพิ่ม “${q.trim()}”`,
  en: `+ Add “${q.trim()}”`,
});

/** เพิ่มบริการ; from a search that found nothing, the words are already the name. */
export const newDraft = (q = ""): ServiceDraft => ({
  id: null,
  name: q.trim(),
  nameEn: "",
  price: "",
});

/** A saved service to change: "1290", and ฿0 as "0" so a free one reads as set. */
export const draftOf = (s: ServiceRow): ServiceDraft => ({
  id: s.id,
  name: s.name,
  nameEn: s.nameEn,
  price: formatBaht(s.basePriceSatang).slice(1).replace(/,/g, ""),
});

/** Said under the box after บันทึก: an empty name, another service's name, a price that isn't one. */
export function serviceProblems(
  d: ServiceDraft,
  list: ServiceRow[],
): Partial<Record<"name" | "price", Phrase>> {
  const out: Partial<Record<"name" | "price", Phrase>> = {};
  if (!d.name.trim()) out.name = { th: "ยังไม่ได้ใส่ชื่อบริการ", en: "Add the service name" };
  else if (list.some((s) => s.id !== d.id && same(s.name, d.name))) {
    out.name = {
      th: "มีบริการนี้แล้ว · แตะบริการเดิมเพื่อแก้ราคา",
      en: "Already on the list · tap it to change its price",
    };
  }
  if (parseBaht(d.price) === null) {
    out.price = { th: "ใส่ราคาเป็นตัวเลข", en: "Type the price as a number" };
  }
  return out;
}

/** What POST /services and PATCH /services/:id take. */
export function serviceBody(d: ServiceDraft) {
  return {
    name: d.name.trim(),
    nameEn: d.nameEn.trim(),
    basePriceSatang: parseBaht(d.price) ?? 0,
  };
}

export const deleteTitle = (name: string): Phrase => ({
  th: `ลบบริการ ${name}?`,
  en: `Delete ${name}?`,
});
