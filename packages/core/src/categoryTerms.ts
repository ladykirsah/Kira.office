import { renderTerms } from "./terms";

/**
 * A category's เงื่อนไข (owner, 3 Nov 2026: "the conditions is set based on product type as the
 * description"): one text per product type, written in ตั้งค่าอะไหล่ under เกี่ยวกับสินค้าประเภทนี้,
 * and shown on each of its products' AirPlus page with that product's own words filled in.
 * Kira's ตัวอย่าง and the website both fill it here, so they read the same to the letter.
 */

/** The fill-ins a product has: {{product_name}}, {{brand}}, {{warranty}} (its category's). */
export const TERMS_FIELDS: readonly string[] = ["product_name", "brand", "warranty"];

/** รับประกัน as ตั้งค่าอะไหล่ says it: 1 ปี, 6 เดือน, 45 วัน, or ไม่มีรับประกัน. */
export function warrantyThai(days: number | null): string {
  if (!days || days <= 0) return "ไม่มีรับประกัน";
  if (days % 365 === 0) return `${days / 365} ปี`;
  if (days % 30 === 0 && days >= 60) return `${days / 30} เดือน`;
  return `${days} วัน`;
}

export function fillCategoryTerms(
  template: string,
  p: { productName: string; brand: string | null; warrantyDays: number | null },
): string {
  return renderTerms(template, {
    product_name: p.productName,
    brand: p.brand ?? "",
    warranty: warrantyThai(p.warrantyDays),
  });
}

/** Every {{name}} a product can't fill — Thai names included — once each, in first-seen order. */
export function unknownTermsFields(template: string): string[] {
  const out: string[] = [];
  for (const m of template.matchAll(/\{\{([^{}]*)\}\}/g)) {
    const name = m[1]!.trim();
    if (!TERMS_FIELDS.includes(name) && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * The product page's คำอธิบาย: the product's own text, one empty line, then its category's text
 * (owner, 3 Nov 2026: "can we have 2 places > shown as one paragraph on AirPlus"). Either part may
 * be missing; with neither there is no description block.
 */
export function joinDescriptions(own: string | null, category: string | null): string | null {
  const parts = [own, category].map((t) => t?.trim() ?? "").filter((t) => t !== "");
  return parts.length > 0 ? parts.join("\n\n") : null;
}
