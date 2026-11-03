import { fillCategoryTerms } from "@l-shopee/core";

/**
 * The product page's คำอธิบาย: the product's own text, one empty line, then its category's text
 * (set in Kira's ตั้งค่าอะไหล่). Lives in @l-shopee/core so Kira's ตัวอย่าง reads the same.
 */
export { joinDescriptions } from "@l-shopee/core";

/**
 * The product page's เงื่อนไข box: its category's เงื่อนไข (Kira: เกี่ยวกับสินค้าประเภทนี้) with this
 * product's name, brand and warranty filled in. Null = the category has none → no box.
 */
export function productTerms(
  terms: string | null,
  head: { name: string; brandName: string | null; warrantyDays: number | null },
): string | null {
  const text = terms?.trim() ?? "";
  if (!text) return null;
  return fillCategoryTerms(text, {
    productName: head.name,
    brand: head.brandName,
    warrantyDays: head.warrantyDays,
  });
}
