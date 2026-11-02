import type { Phrase } from "@l-shopee/shared/lang";

/**
 * The coupon rules the owner asked for (canvas v260, 1 Nov 2026): ใช้กับ — every product, or only some
 * brands, categories, car models or picked products — and ใครใช้ได้ — everyone, or ลูกค้าใหม่ (accounts
 * made in สมัครช่วง hold it for a year, on their My coupons page). No screen code here.
 */

export type CouponScope = "all" | "brand" | "category" | "car_model" | "products";

/** What a scope names, with a name to show (a car model with its car brand) and a product's photo. */
export interface CouponTarget {
  id: string;
  name: string;
  imageKey: string | null;
}

/** The ใช้กับ sheet's rows, in the drawn order; `noun` is what ยังไม่ได้เลือก… names. */
export const SCOPES: readonly { key: CouponScope; label: Phrase; noun: Phrase }[] = [
  { key: "all", label: { th: "ทุกสินค้า", en: "Every product" }, noun: { th: "", en: "" } },
  { key: "brand", label: { th: "ยี่ห้อ", en: "Brands" }, noun: { th: "ยี่ห้อ", en: "a brand" } },
  {
    key: "category",
    label: { th: "หมวดสินค้า", en: "Categories" },
    noun: { th: "หมวดสินค้า", en: "a category" },
  },
  {
    key: "car_model",
    label: { th: "รุ่นรถ", en: "Car models" },
    noun: { th: "รุ่นรถ", en: "a car model" },
  },
  {
    key: "products",
    label: { th: "เลือกสินค้า", en: "Picked products" },
    noun: { th: "สินค้า", en: "a product" },
  },
];

const PREFIX: Record<Exclude<CouponScope, "all" | "products">, Phrase> = {
  brand: { th: "ยี่ห้อ", en: "Brands" },
  category: { th: "หมวด", en: "Categories" },
  car_model: { th: "รุ่นรถ", en: "Cars" },
};

/** What is ticked, under its row in the ใช้กับ sheet: "DENSO, Sanden", or "3 ชิ้น" for products. */
export function pickedLine(scope: string, targets: readonly { name: string }[]): Phrase {
  if (scope === "products")
    return { th: `${targets.length} ชิ้น`, en: `${targets.length} products` };
  const names = targets.map((t) => t.name).join(", ");
  return { th: names, en: names };
}

/** "ทุกสินค้า", "ยี่ห้อ DENSO, Sanden", "สินค้า 3 ชิ้น". */
export function scopeLine(scope: string, targets: readonly { name: string }[]): Phrase {
  const picked = pickedLine(scope, targets);
  if (scope === "products") return { th: `สินค้า ${picked.th}`, en: picked.en };
  const prefix = PREFIX[scope as keyof typeof PREFIX];
  if (!prefix || targets.length === 0) return SCOPES[0]!.label;
  return { th: `${prefix.th} ${picked.th}`, en: `${prefix.en} ${picked.en}` };
}

/** ใช้กับ with nothing picked: "ยังไม่ได้เลือกยี่ห้อ". */
export function scopeProblem(scope: CouponScope, targets: readonly unknown[]): Phrase | null {
  if (scope === "all" || targets.length > 0) return null;
  const noun = SCOPES.find((s) => s.key === scope)!.noun;
  return { th: `ยังไม่ได้เลือก${noun.th}`, en: `No ${noun.en} picked yet` };
}

/** A ลูกค้าใหม่ coupon lasts a year from the day the account was made (owner, 1 Nov 2026). */
export const NEW_CUSTOMER_DAYS = 365;

function howLong(days: number): Phrase {
  return days % 365 === 0
    ? { th: `${days / 365} ปี`, en: days === 365 ? "1 year" : `${days / 365} years` }
    : { th: `${days} วัน`, en: `${days} days` };
}

/** ใครใช้ได้: ทุกคน, or ลูกค้าใหม่ — on the coupon page with how long each customer has it. */
export function whoLine(
  c: { signupFrom: number | null; validDays?: number | null },
  page: boolean,
): Phrase {
  if (c.signupFrom == null) return { th: "ทุกคน", en: "Everyone" };
  if (!page) return { th: "ลูกค้าใหม่", en: "New customers" };
  const time = howLong(c.validDays ?? NEW_CUSTOMER_DAYS);
  return { th: `ลูกค้าใหม่ · ใช้ได้ ${time.th}`, en: `New customers · ${time.en}` };
}

export type CouponCuts = "product" | "shipping";
export type CouponKind = "percent" | "fixed" | "free";

/** ราคาสินค้า ↔ ค่าส่ง: ลดเป็น % on the price becomes ส่งฟรี on the fee and back; ลดเป็นบาท stays. */
export function cutsPatch(
  kind: CouponKind,
  cuts: CouponCuts,
): { cuts: CouponCuts; kind: CouponKind } {
  if (cuts === "shipping" && kind === "percent") return { cuts, kind: "free" };
  if (cuts === "product" && kind === "free") return { cuts, kind: "percent" };
  return { cuts, kind };
}

/** A tap on a pick row: on if it was off, off if it was on (several may be ticked). */
export function toggleTarget(
  targets: readonly CouponTarget[],
  target: CouponTarget,
): CouponTarget[] {
  return targets.some((t) => t.id === target.id)
    ? targets.filter((t) => t.id !== target.id)
    : [...targets, target];
}

/** รุ่นรถ: every car model as "Toyota Vios" (the name the coupon page shows), in Thai order. */
export function carModelChoices(
  brands: readonly { name: string; models: readonly { id: string; name: string }[] }[],
  q: string,
): CouponTarget[] {
  const typed = q.trim().toLowerCase();
  return brands
    .flatMap((b) =>
      b.models.map((m) => ({ id: m.id, name: `${b.name} ${m.name}`, imageKey: null })),
    )
    .filter((c) => !typed || c.name.toLowerCase().includes(typed))
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
}
