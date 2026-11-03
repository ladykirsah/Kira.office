import type { Phrase } from "@l-shopee/shared/lang";

/**
 * ตั้งค่าอะไหล่ (canvas PartsSetupPhone v311, approved 3 Nov 2026): part brands, car systems and
 * the categories inside each system. The English name is a thing's identity (the server's `name`);
 * the Thai name is shown first when there is one. A brand or system still in use has no delete;
 * a category in use says why it can't go. Each category carries the AirPlus description that the
 * website adds under every one of its products' own text.
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
export interface Category extends PartName {
  systemId: string | null;
  warrantyDays: number | null;
  imageKey: string | null;
  description: string | null;
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

export const brandLine = (b: Brand): Phrase =>
  line(b, [
    b.productCount > 0
      ? { th: `ใช้ใน ${b.productCount} สินค้า`, en: `used in ${b.productCount} products` }
      : products(0),
  ]);

/** 0 / missing = ไม่มีรับประกัน; whole years, then whole months (30 days), else days. */
export function warrantyWords(days: number | null): Phrase {
  if (!days || days <= 0) return { th: "ไม่มีรับประกัน", en: "No warranty" };
  if (days % 365 === 0) return { th: `${days / 365} ปี`, en: `${days / 365} yr` };
  if (days % 30 === 0 && days >= 60) return { th: `${days / 30} เดือน`, en: `${days / 30} mo` };
  return { th: `${days} วัน`, en: `${days} days` };
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

export const deleteTitle = (kind: Kind, p: PartName): Phrase => ({
  th: `ลบ${KIND_TH[kind]} ${titleOf(p)}?`,
  en: `Delete ${KIND_EN[kind]} ${p.nameEn}?`,
});

/** A category in use can't go: say how many products hold it and what to do first. */
export const blockedDelete = (c: Category): { title: Phrase; body: Phrase } | null =>
  c.productCount === 0
    ? null
    : {
        title: { th: `ลบ ${titleOf(c)} ไม่ได้`, en: `Can't delete ${c.nameEn}` },
        body: {
          th: `ยังใช้อยู่ใน ${c.productCount} สินค้า · ย้ายสินค้าไปหมวดอื่นก่อน`,
          en: `Still used by ${c.productCount} products · move them to another category first`,
        },
      };

const wordLines = (t: string) =>
  t
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");

/** The card on the details sheet: the first three lines with words, then … when there is more. */
export function descriptionPreview(text: string): string {
  const lines = wordLines(text);
  return lines.length <= 3 ? lines.join("\n") : `${lines.slice(0, 3).join("\n")}…`;
}

/** The form row's second line: every line, joined by · (the row cuts it with …). */
export const descriptionLine = (text: string): string => wordLines(text).join(" · ");

export const descriptionNote = (c: Category): Phrase => ({
  th: `บน AirPlus: ต่อท้ายคำอธิบายของสินค้า เว้น 1 บรรทัด · ${titleOf(c)}ทุกชิ้น (${c.productCount})`,
  en: `On AirPlus: after each product's own text, one empty line · all ${c.productCount} ${c.nameEn}`,
});

/** The boxes of a brand's or system's sheet; a new one starts empty. */
export interface NameDraft {
  id: string | null;
  nameTh: string;
  nameEn: string;
}
/** A category's sheet: names, then อยู่ในระบบ, รับประกัน (days, 0 = none) and คำอธิบายบน AirPlus. */
export interface CategoryDraft extends NameDraft {
  systemId: string | null;
  warrantyDays: number;
  description: string;
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
    };
  }
  return {
    rename:
      d.nameTh.trim() !== (before.nameTh ?? "").trim() || d.nameEn.trim() !== before.nameEn.trim(),
    system: d.systemId !== before.systemId,
    warranty: d.warrantyDays !== (before.warrantyDays ?? 0),
    description: d.description.trim() !== (before.description ?? "").trim(),
  };
}
