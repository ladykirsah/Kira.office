import {
  fillCategoryTerms,
  joinDescriptions,
  TERMS_FIELDS,
  unknownTermsFields,
  warrantyThai,
} from "@l-shopee/core";
import type { Phrase } from "@l-shopee/shared/lang";

/**
 * ตั้งค่าอะไหล่ (canvas PartsSetupPhone v311, approved 3 Nov 2026): part brands, car systems and
 * the categories inside each system. The English name is a thing's identity (the server's `name`);
 * the Thai name is shown first when there is one. A brand or system still in use has no delete;
 * a category in use has no delete. Each category carries เกี่ยวกับสินค้าประเภทนี้: the AirPlus
 * description the website adds under every one of its products' own text, and the เงื่อนไข it shows
 * in its own box with each product's name, brand and warranty filled in.
 */

export interface PartName {
  id: string;
  nameTh: string | null;
  nameEn: string;
  /** The server's identity name, when it differs from the English one shown. */
  name?: string;
}
export interface Brand extends PartName {
  imageKey: string | null;
  productCount: number;
}
export type CarSystem = PartName;
/** One of a category's products, as AirPlus names it — what ตัวอย่าง fills the texts with. */
export interface CategorySample {
  name: string;
  brand: string | null;
  description: string | null;
}
export interface Category extends PartName {
  systemId: string | null;
  warrantyDays: number | null;
  imageKey: string | null;
  description: string | null;
  terms: string | null;
  sample: CategorySample | null;
  productCount: number;
}
export interface SystemRow extends CarSystem {
  categoryCount: number;
  productCount: number;
}
export type Kind = "brand" | "system" | "category";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const thaiName = (p: PartName) => p.nameTh?.trim() || null;

/** The Thai name when there is one, else the English. */
export const titleOf = (p: PartName): string => thaiName(p) ?? p.nameEn;

/** "DENSO · …" only when the title is Thai, so the English name isn't said twice. */
function line(p: PartName, rest: Phrase[]): Phrase {
  const head = thaiName(p) ? [p.nameEn] : [];
  return {
    th: [...head, ...rest.map((r) => r.th)].join(" · "),
    en: [...head, ...rest.map((r) => r.en)].join(" · "),
  };
}

const products = (n: number): Phrase =>
  n > 0
    ? { th: `${n} สินค้า`, en: `${n} products` }
    : { th: "ยังไม่มีสินค้า", en: "no products yet" };

/**
 * A list row's second line next to its picture: it may wrap between the · parts, never inside one.
 * Spaces become no-break spaces, and a word joiner sits between letters (Thai breaks inside words);
 * a vowel or tone mark stays glued to its letter.
 */
export const keepPartsWhole = (line: string): string =>
  line
    .split(" · ")
    .map((part) =>
      [...part.replace(/ /g, "\u00A0")]
        .map((c, i) => (i === 0 || /\p{M}/u.test(c) ? c : `\u2060${c}`))
        .join(""),
    )
    .join(" · ");

export const brandLine = (b: Brand): Phrase =>
  line(b, [
    b.productCount > 0
      ? { th: `ใช้ใน ${b.productCount} สินค้า`, en: `used in ${b.productCount} products` }
      : products(0),
  ]);

/** 0 / missing = ไม่มีรับประกัน; whole years, then whole months (30 days), else days. */
export function warrantyWords(days: number | null): Phrase {
  const th = warrantyThai(days); // the words AirPlus fills {{warranty}} with
  if (!days || days <= 0) return { th, en: "No warranty" };
  if (days % 365 === 0) return { th, en: `${days / 365} yr` };
  if (days % 30 === 0 && days >= 60) return { th, en: `${days / 30} mo` };
  return { th, en: `${days} days` };
}

/** The รับประกัน sheet's choices, in days (0 = ไม่มีรับประกัน); ＋ ตั้งจำนวนวันเอง follows them. */
export const WARRANTY_CHOICES = [0, 30, 90, 180, 365, 730];

export const categoryLine = (c: Category): Phrase => {
  const w = warrantyWords(c.warrantyDays);
  const warranty =
    c.warrantyDays && c.warrantyDays > 0 ? { th: `รับประกัน ${w.th}`, en: `${w.en} warranty` } : w;
  return line(c, [warranty, products(c.productCount)]);
};

export function systemsWithCounts(systems: CarSystem[], cats: Category[]): SystemRow[] {
  return systems.map((s) => {
    const mine = cats.filter((c) => c.systemId === s.id);
    return {
      ...s,
      categoryCount: mine.length,
      productCount: mine.reduce((n, c) => n + c.productCount, 0),
    };
  });
}

const groupLine = (categoryCount: number, productCount: number): Phrase[] =>
  categoryCount === 0
    ? [{ th: "ยังไม่มีหมวดหมู่", en: "no categories yet" }]
    : [
        { th: `${categoryCount} หมวดหมู่`, en: `${categoryCount} categories` },
        products(productCount),
      ];

export const systemLine = (s: SystemRow): Phrase =>
  line(s, groupLine(s.categoryCount, s.productCount));

/** Categories with no system, or one that no longer exists: one row at the end of the list. */
export function unassigned(
  systems: CarSystem[],
  cats: Category[],
): { categories: Category[]; line: Phrase } | null {
  const ids = new Set(systems.map((s) => s.id));
  const loose = cats.filter((c) => !c.systemId || !ids.has(c.systemId));
  if (loose.length === 0) return null;
  const n = loose.reduce((sum, c) => sum + c.productCount, 0);
  const parts = groupLine(loose.length, n);
  return {
    categories: loose,
    line: { th: parts.map((p) => p.th).join(" · "), en: parts.map((p) => p.en).join(" · ") },
  };
}

export const brandsTab = (n: number): Phrase => ({
  th: `ยี่ห้ออะไหล่ · ${n}`,
  en: `Part brands · ${n}`,
});

/** Most used first; ties in Thai order. */
export const sortBrands = (list: Brand[]): Brand[] =>
  [...list].sort(
    (a, b) => b.productCount - a.productCount || titleOf(a).localeCompare(titleOf(b), "th"),
  );

const matches = (p: PartName, q: string) => {
  const words = q.trim().toLowerCase();
  return (
    !words ||
    p.nameEn.toLowerCase().includes(words) ||
    (p.nameTh ?? "").toLowerCase().includes(words)
  );
};
export const findBrands = (list: Brand[], q: string): Brand[] => list.filter((b) => matches(b, q));
export const findCategories = (list: Category[], q: string): Category[] =>
  list.filter((c) => matches(c, q));
export const findSystems = (list: SystemRow[], q: string): SystemRow[] =>
  list.filter((s) => matches(s, q));

const KIND_TH: Record<Kind, string> = { brand: "ยี่ห้อ", system: "ระบบ", category: "หมวดหมู่" };
const KIND_EN: Record<Kind, string> = { brand: "brand", system: "system", category: "category" };

/** Said under the box after บันทึก: no English name, another one's English name, no system. */
export function nameProblems(
  kind: Kind,
  d: { id: string | null; nameEn: string; systemId?: string | null },
  list: PartName[],
): Partial<Record<"nameEn" | "system", Phrase>> {
  const out: Partial<Record<"nameEn" | "system", Phrase>> = {};
  // The server's add finds-or-creates on the identity `name`: a match there would quietly merge.
  const twin = list.find(
    (p) =>
      p.id !== d.id &&
      (same(p.nameEn, d.nameEn) || (p.name !== undefined && same(p.name, d.nameEn))),
  );
  if (!d.nameEn.trim()) out.nameEn = { th: "ยังไม่ได้ใส่ชื่ออังกฤษ", en: "Add the English name" };
  else if (twin) {
    out.nameEn = {
      th: `มี${KIND_TH[kind]} ${twin.nameEn} แล้ว`,
      en: `${twin.nameEn} is already a ${KIND_EN[kind]}`,
    };
  }
  if (kind === "category" && !d.systemId)
    out.system = { th: "ยังไม่ได้เลือกระบบ", en: "Pick a system" };
  return out;
}

export const canDeleteBrand = (b: Brand): boolean => b.productCount === 0;
export const canDeleteSystem = (s: CarSystem, cats: Category[]): boolean =>
  !cats.some((c) => c.systemId === s.id);
export const canDeleteCategory = (c: Category): boolean => c.productCount === 0;

export const deleteTitle = (kind: Kind, p: PartName): Phrase => ({
  th: `ลบ${KIND_TH[kind]} ${titleOf(p)}?`,
  en: `Delete ${KIND_EN[kind]} ${p.nameEn}?`,
});

const wordLines = (t: string) =>
  t
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");

/** The details card: the first `n` lines with words, then … when there is more. */
export function textPreview(text: string, n: number): string {
  const lines = wordLines(text);
  return lines.length <= n ? lines.join("\n") : `${lines.slice(0, n).join("\n")}…`;
}

/** The form row's second line: the first line of the คำอธิบาย and of the เงื่อนไข, joined by ·. */
export const aboutLine = (d: { description: string; terms: string }): string =>
  [d.description, d.terms]
    .map((t) => wordLines(t)[0])
    .filter((l): l is string => !!l)
    .join(" · ");

export const DESCRIPTION_NOTE: Phrase = {
  th: "บน AirPlus: ต่อท้ายคำอธิบายของสินค้า เว้น 1 บรรทัด",
  en: "On AirPlus: after each product's own text, one empty line",
};
export const TERMS_NOTE: Phrase = {
  th: "บน AirPlus: กล่อง เงื่อนไข ของมันเอง · ชื่อ ยี่ห้อ รับประกัน เปลี่ยนตามแต่ละชิ้น",
  en: "On AirPlus: its own Conditions box · name, brand and warranty follow each product",
};

export const forAllNote = (c: Category): Phrase =>
  c.productCount > 0
    ? {
        th: `ใช้กับ${titleOf(c)}ทุกชิ้น (${c.productCount})`,
        en: `For all ${c.productCount} ${c.nameEn}`,
      }
    : { th: "ยังไม่มีสินค้าในหมวดนี้", en: "No products in this category yet" };

const FIELD_WORDS: Record<string, Phrase> = {
  product_name: { th: "ชื่อสินค้า", en: "product name" },
  brand: { th: "ยี่ห้อ", en: "brand" },
  warranty: { th: "รับประกันของหมวดนี้", en: "this category's warranty" },
};

/** Under the เงื่อนไข box: the fill-ins a product has, and what each becomes. */
export const FIELDS_HINT: Phrase = {
  th: `ใส่ได้: ${TERMS_FIELDS.map((f) => `{{${f}}} ${FIELD_WORDS[f]!.th}`).join(" · ")}`,
  en: `Fill-ins: ${TERMS_FIELDS.map((f) => `{{${f}}} ${FIELD_WORDS[f]!.en}`).join(" · ")}`,
};

/** A fill-in no product has (a Thai name, a typo) — said under the box when ✓ is tapped. */
export function termsProblem(text: string): Phrase | null {
  const unknown = unknownTermsFields(text);
  if (unknown.length === 0) return null;
  const names = unknown.map((n) => `{{${n}}}`).join(" ");
  const n = TERMS_FIELDS.length;
  return {
    th: `${names} ไม่มีในสินค้า · ใช้ได้แค่ ${n} ช่องข้างล่าง`,
    en: `${names}: products don't have it · only the ${n} below`,
  };
}

/**
 * ตัวอย่าง: what AirPlus shows for one of the category's products, from the texts as typed now —
 * the คำอธิบาย after the product's own, the เงื่อนไข filled in. Null when the category has no product.
 */
export function aboutExample(c: Category, d: CategoryDraft) {
  const s = c.sample;
  if (!s) return null;
  const who = [s.name, s.brand].filter(Boolean).join(" · ");
  const terms = d.terms.trim();
  return {
    from: {
      th: `ตัวอย่างจาก ${who} · 1 ใน ${c.productCount} สินค้า`,
      en: `Example: ${who} · 1 of ${c.productCount} products`,
    },
    description: joinDescriptions(s.description, d.description),
    terms: terms
      ? fillCategoryTerms(terms, {
          productName: s.name,
          brand: s.brand,
          warrantyDays: d.warrantyDays,
        })
      : null,
  };
}

/** The boxes of a brand's or system's sheet; a new one starts empty. */
export interface NameDraft {
  id: string | null;
  nameTh: string;
  nameEn: string;
}
/** A category's sheet: names, then อยู่ในระบบ, รับประกัน (days, 0 = none) and เกี่ยวกับสินค้าประเภทนี้. */
export interface CategoryDraft extends NameDraft {
  systemId: string | null;
  warrantyDays: number;
  description: string;
  terms: string;
}

export const nameDraft = (p?: PartName): NameDraft => ({
  id: p?.id ?? null,
  nameTh: p?.nameTh ?? "",
  nameEn: p?.nameEn ?? "",
});

/** A saved category, or a new one — from a system's page that system is already picked. */
export const categoryDraft = (c?: Category, systemId: string | null = null): CategoryDraft => ({
  ...nameDraft(c),
  systemId: c ? c.systemId : systemId,
  warrantyDays: c?.warrantyDays ?? 0,
  description: c?.description ?? "",
  terms: c?.terms ?? "",
});

/**
 * What บันทึก sends besides the add or nothing: a new category's add carries its names and system,
 * so only a set warranty or text follow; an edit sends only what changed.
 */
export function categoryChanges(before: Category | null, d: CategoryDraft) {
  if (!before) {
    return {
      rename: false,
      system: false,
      warranty: d.warrantyDays > 0,
      description: d.description.trim() !== "",
      terms: d.terms.trim() !== "",
    };
  }
  return {
    rename:
      d.nameTh.trim() !== (before.nameTh ?? "").trim() || d.nameEn.trim() !== before.nameEn.trim(),
    system: d.systemId !== before.systemId,
    warranty: d.warrantyDays !== (before.warrantyDays ?? 0),
    description: d.description.trim() !== (before.description ?? "").trim(),
    terms: d.terms.trim() !== (before.terms ?? "").trim(),
  };
}
