import type { Phrase } from "@l-shopee/shared/lang";

/**
 * รุ่นรถที่ใช้ได้ (canvas FitmentPhone v320, 3 Nov 2026): car brands, each with its models, and each
 * model's service info (แชสซี · น้ำยาแอร์ · น้ำหล่อเย็น / โอริง / หมายเหตุ) for answering customers. The
 * English name is a thing's identity (product fitments name it); the Thai name is shown first when
 * there is one. A brand or model that products still fit has no delete (owner: "if a brand and
 * system has product inside delete button never show up").
 */

export interface Oring {
  size: string;
  qty: number;
}
export interface CarModel {
  id: string;
  /** The server's identity name; product fitments name the model by it. */
  name: string;
  nameTh: string | null;
  nameEn: string;
  yearFrom: number | null;
  yearTo: number | null;
  /** แชสซี (the server's generation code). */
  chassis: string | null;
  refrigerant: string | null;
  /** น้ำหล่อเย็น, in litres as typed. */
  coolant: string | null;
  orings: Oring[];
  notes: string | null;
  productCount: number;
}
export interface CarBrand {
  id: string;
  name: string;
  nameTh: string | null;
  nameEn: string;
  imageKey: string | null;
  productCount: number;
  models: CarModel[];
}
/** The model form as typed: numbers stay text until บันทึก. */
export interface ModelDraft {
  id: string | null;
  nameTh: string;
  nameEn: string;
  yearFrom: string;
  yearTo: string;
  chassis: string;
  refrigerant: string;
  coolant: string;
  orings: { size: string; qty: string }[];
  notes: string;
}

type Named = { nameTh: string | null; nameEn: string };
const thaiName = (p: Named) => p.nameTh?.trim() || null;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const both = (s: string): Phrase => ({ th: s, en: s });

/** The Thai name when there is one, else the English. */
export const titleOf = (p: Named): string => thaiName(p) ?? p.nameEn;

/** "Toyota · …" only when the title is Thai, so the English name isn't said twice. */
function line(p: Named, rest: Phrase[]): Phrase {
  const head = thaiName(p) ? [p.nameEn] : [];
  const parts = (pick: (r: Phrase) => string) =>
    [...head, ...rest.map(pick)].filter((s) => s !== "").join(" · ");
  return { th: parts((r) => r.th), en: parts((r) => r.en) };
}

export const yearsWords = (from: number | null, to: number | null): Phrase => {
  if (from == null && to == null) return both("");
  if (from == null) return { th: `ถึง ${to}`, en: `to ${to}` };
  if (to == null) return { th: `${from} ขึ้นไป`, en: `${from} on` };
  return both(`${from}–${to}`);
};

const hasServiceInfo = (m: CarModel): boolean =>
  !!(m.chassis || m.refrigerant || m.coolant || m.notes || m.orings.length > 0);

export const brandLine = (b: CarBrand): Phrase =>
  line(b, [
    b.models.length > 0
      ? { th: `${b.models.length} รุ่น`, en: `${b.models.length} models` }
      : { th: "ยังไม่มีรุ่น", en: "no models yet" },
  ]);

export const modelLine = (m: CarModel): Phrase =>
  line(m, [
    yearsWords(m.yearFrom, m.yearTo),
    ...(hasServiceInfo(m) ? [] : [{ th: "ยังไม่มีข้อมูลบริการ", en: "no service info yet" }]),
  ]);

/** "Toyota Vigo · 2005–2014": a model's page, and each row of the search list. */
export const modelHead = (b: CarBrand, m: CarModel): Phrase => {
  const years = yearsWords(m.yearFrom, m.yearTo);
  const name = `${b.nameEn} ${m.nameEn}`;
  return {
    th: years.th ? `${name} · ${years.th}` : name,
    en: years.en ? `${name} · ${years.en}` : name,
  };
};

/** A bare number is litres; anything already worded stays as typed. */
export const coolantWords = (v: string | null): string => {
  const s = v?.trim();
  if (!s) return "—";
  return /^\d+(\.\d+)?$/.test(s) ? `${s} ลิตร` : s;
};

export const oringRows = (m: CarModel): { label: string; value: string }[] =>
  m.orings.map((o) => ({ label: `โอริง ${o.size}`, value: `${o.qty} ตัว` }));

const YEAR = /^\d{4}$/;
const madeIn = (m: CarModel, year: number) =>
  m.yearFrom != null && m.yearFrom <= year && (m.yearTo == null || year <= m.yearTo);

/**
 * ค้นรุ่นรถ: every model from every brand in one list. Each typed word must match — a name (Thai,
 * English, the brand's) or, for a 4-digit year, the years the model was made.
 */
export function findModels(brands: CarBrand[], q: string): { brand: CarBrand; model: CarModel }[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return brands.flatMap((brand) =>
    brand.models
      .filter((model) => {
        const names = [
          brand.nameEn,
          brand.nameTh,
          brand.name,
          model.nameEn,
          model.nameTh,
          model.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return words.every((w) => (YEAR.test(w) ? madeIn(model, Number(w)) : names.includes(w)));
      })
      .map((model) => ({ brand, model })),
  );
}

export const foundWords = (n: number): Phrase => ({ th: `พบ ${n} รุ่น`, en: `${n} found` });

export const canDeleteCarBrand = (b: CarBrand): boolean => b.productCount === 0;
export const canDeleteModel = (m: CarModel): boolean => m.productCount === 0;

const text = (n: number | null) => (n == null ? "" : String(n));

export const modelDraft = (m?: CarModel): ModelDraft => ({
  id: m?.id ?? null,
  nameTh: m?.nameTh ?? "",
  nameEn: m?.nameEn ?? "",
  yearFrom: text(m?.yearFrom ?? null),
  yearTo: text(m?.yearTo ?? null),
  chassis: m?.chassis ?? "",
  refrigerant: m?.refrigerant ?? "",
  coolant: m?.coolant ?? "",
  orings: (m?.orings ?? []).map((o) => ({ size: o.size, qty: String(o.qty) })),
  notes: m?.notes ?? "",
});

const year = (s: string) => (YEAR.test(s.trim()) ? Number(s.trim()) : null);

/** Said under the box after บันทึก: an empty English name or start year, or the same model twice. */
export function modelProblems(
  d: ModelDraft,
  siblings: CarModel[],
): Partial<Record<"nameEn" | "yearFrom", Phrase>> {
  const out: Partial<Record<"nameEn" | "yearFrom", Phrase>> = {};
  if (!d.nameEn.trim()) out.nameEn = { th: "ยังไม่ได้ใส่ชื่ออังกฤษ", en: "Add the English name" };
  if (!d.yearFrom.trim()) out.yearFrom = { th: "ยังไม่ได้ใส่ปีเริ่ม", en: "Add the start year" };
  if (out.nameEn) return out;
  // The server's add finds-or-creates on name + years: the same pair would quietly merge.
  const from = year(d.yearFrom);
  const to = year(d.yearTo);
  const twin = siblings.find(
    (m) =>
      m.id !== d.id &&
      (same(m.nameEn, d.nameEn) || same(m.name, d.nameEn)) &&
      m.yearFrom === from &&
      m.yearTo === to,
  );
  if (twin) {
    const said = (years: string) => [twin.nameEn, years].filter(Boolean).join(" ");
    const years = yearsWords(twin.yearFrom, twin.yearTo);
    out.nameEn = {
      th: `มีรุ่น ${said(years.th)} แล้ว`,
      en: `${said(years.en)} is already here`,
    };
  }
  return out;
}

/** What บันทึก sends: the two names, the years, and the service info (o-rings with no amount drop). */
export function modelSave(d: ModelDraft) {
  const words = (s: string) => s.trim() || null;
  const yearFrom = year(d.yearFrom);
  const yearTo = year(d.yearTo);
  return {
    names: { nameTh: d.nameTh.trim(), nameEn: d.nameEn.trim() },
    yearFrom,
    yearTo,
    info: {
      generationCode: words(d.chassis),
      yearFrom,
      yearTo,
      refrigerant: words(d.refrigerant),
      coolantLiters: words(d.coolant),
      oringUsage: d.orings
        .map((o) => ({ size: o.size.trim(), qty: Number(o.qty.trim()) }))
        .filter((o) => o.size && o.qty > 0 && Number.isFinite(o.qty))
        .map((o) => ({ size: o.size, qty: Math.round(o.qty) })),
      notes: words(d.notes),
    },
  };
}
