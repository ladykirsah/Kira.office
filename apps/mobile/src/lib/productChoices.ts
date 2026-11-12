import type { Phrase } from "@l-shopee/shared/lang";
import { billLineName } from "./billName";
import { formatBaht } from "./money";
import { bahtText, parseBaht, type StockCount } from "./productEdit";
import type { Fitment, ProductRow } from "./productList";
import type { Pricing } from "./productPage";
import type { HoldLine } from "./scanTabs";

/**
 * ตัวเลือกสินค้า (sizes, brands, packs) and กลุ่มสินค้า (groups) on หน้าสินค้า — canvas board
 * ChoicesGroup, approved 7 Nov 2026. A choice is one of the product's own variants with its own photo,
 * code, prices and stock; a group lists other products that stand in for this one, each keeping its
 * own page. No screen code here.
 */

/** One choice, as GET /products/:id sends it. */
export interface Choice {
  variantId: string;
  value: string;
  code: string | null;
  imageKey: string | null;
  onHand: number;
  held: number;
  /** Sold, counted or moved already: it has no 🗑, ever (owner: in use = no delete). */
  inUse: boolean;
  pricing: Pricing | null;
}

/** One product of the group, this one included. */
export interface GroupMember {
  id: string;
  name: string;
  productRef: string;
  typeName: string | null;
  typeNameTh: string | null;
  brandName: string | null;
  imageKey: string | null;
  onHand: number;
  /** ราคาลูกค้า (เด่นแอร์) of its cheapest choice. */
  priceSatang: number;
  /** How many sizes it has; 1 (or missing, from an older server) for a product without sizes. */
  choiceCount?: number;
}

/** What the choice form holds while it is typed in. Money stays as typed until saved. */
export interface ChoiceForm {
  value: string;
  code: string;
  cost: string;
  vat: boolean;
  den: string;
  mechanic: string;
  airplus: string;
  shopee: string;
  sellable: number;
  held: number;
}

export type ChoiceErrors = Partial<
  Record<"value" | "code" | "cost" | "den" | "mechanic" | "airplus" | "shopee", Phrase>
>;

/** POST /products/:id/choices and PUT /products/:id/choices/:variantId. */
export interface ChoiceBody {
  value: string;
  code: string;
  pricing: Omit<Pricing, "taxOnCost"> & { taxOnCost: boolean };
}

export const hasChoices = (d: { choices?: readonly Choice[] }): boolean =>
  (d.choices?.length ?? 0) > 0;

/** The row's grey third line. */
export const choiceStock = (c: Choice): Phrase => ({
  th: `ขายได้ ${c.onHand}`,
  en: `${c.onHand} for sale`,
});

/** ราคาลูกค้า: the เด่นแอร์ (walk-in) price, the one the Scan card shows (owner: "show B2C price always"). */
export const choicePrice = (c: Choice): string =>
  c.pricing?.targetPriceSatang ? formatBaht(c.pricing.targetPriceSatang) : "—";

/** The choice's own photo, or the product's first one until it has its own. */
export const choicePhoto = (c: Choice, cover: string | null): string | null => c.imageKey ?? cover;

/** "[type] [brand]" in Thai, as a customer's bill names a part; no type → the full name. */
export const memberName = (m: GroupMember): string =>
  billLineName(
    { name: m.name, typeName: m.typeNameTh || m.typeName, brandName: m.brandName },
    "customer",
  );

const sized = (m: GroupMember): boolean => (m.choiceCount ?? 1) > 1;

/** A member's grey line: ขายได้ of all its sizes, and how many sizes when it has them. */
export const memberStock = (m: GroupMember): Phrase =>
  sized(m)
    ? {
        th: `ขายได้ ${m.onHand} · ${m.choiceCount} ขนาด`,
        en: `${m.onHand} for sale · ${m.choiceCount} sizes`,
      }
    : { th: `ขายได้ ${m.onHand}`, en: `${m.onHand} for sale` };

/** A member's price: its cheapest size's, as "เริ่ม ฿35", when it has sizes. */
export const memberPrice = (m: GroupMember): Phrase => {
  const price = formatBaht(m.priceSatang);
  return sized(m) ? { th: `เริ่ม ${price}`, en: `from ${price}` } : { th: price, en: price };
};

/** This product first ("· สินค้านี้"), then the others cheapest first, as drawn. */
export function sortedGroup(members: readonly GroupMember[], selfId: string): GroupMember[] {
  const self = members.filter((m) => m.id === selfId);
  const others = members
    .filter((m) => m.id !== selfId)
    .sort((a, b) => a.priceSatang - b.priceSatang);
  return [...self, ...others];
}

export const groupCount = (n: number): Phrase => ({ th: `${n} สินค้า`, en: `${n} products` });

export const groupTitle = (n: number): Phrase => ({
  th: `กลุ่มสินค้า · ${n} สินค้า`,
  en: `Group · ${n} products`,
});

const sameCar = (a: Fitment | undefined, b: Fitment | undefined): boolean =>
  !!a && !!b && a.carBrand === b.carBrand && a.carModel === b.carModel;

/**
 * + เพิ่มสินค้าในกลุ่ม's list. Nothing typed: the same part for the same first car (the drawn
 * "ตรงกัน" products). A word: every name or code that has it — "สินค้าที่ชื่ออะไหล่และรถคันแรกตรงกัน
 * ขึ้นก่อน" — in the list's own order otherwise. This product and its group are never offered.
 */
export function groupCandidates(
  rows: readonly ProductRow[],
  query: string,
  self: { id: string; typeName: string | null; fitments: readonly Fitment[] },
  exclude: ReadonlySet<string>,
): ProductRow[] {
  const q = query.trim().toLocaleLowerCase();
  const rank = (r: ProductRow): number => {
    const sameType = !!self.typeName && r.typeName === self.typeName;
    const car = sameCar(r.fitments[0], self.fitments[0]);
    if (sameType && car) return 0;
    if (sameType) return 1;
    return car ? 2 : 3;
  };
  const open = rows.filter((r) => r.id !== self.id && !exclude.has(r.id));
  if (!q) return open.filter((r) => rank(r) === 0);
  return open
    .filter(
      (r) => r.name.toLocaleLowerCase().includes(q) || r.productRef.toLocaleLowerCase().includes(q),
    )
    .map((r, i) => ({ r, i, k: rank(r) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.r);
}

/** The grey line over the results. */
export function candidatesLine(type: string | null, car: string | null, n: number): Phrase {
  if (type && car) {
    return {
      th: `ตรงกัน · ${type} · ${car} · พบ ${n}`,
      en: `Matching · ${type} · ${car} · ${n} found`,
    };
  }
  return { th: `พบ ${n}`, en: `${n} found` };
}

/** The first เพิ่มตัวเลือก sheet: a line under each empty box, and under a value typed twice. */
export function optionsErrors(d: { name: string; values: readonly string[] }): {
  name: Phrase | null;
  values: (Phrase | null)[];
} {
  const seen = new Set<string>();
  const values = d.values.map((raw) => {
    const v = raw.trim();
    if (!v) return { th: "ยังไม่ได้ใส่ค่า", en: "No value yet" };
    if (seen.has(v)) return { th: "มีค่านี้แล้ว", en: "Already there" };
    seen.add(v);
    return null;
  });
  return {
    name: d.name.trim() ? null : { th: "ยังไม่ได้ใส่ชื่อกลุ่ม", en: "No option name yet" },
    values,
  };
}

export function choiceFormFrom(c: Choice | null): ChoiceForm {
  const p = c?.pricing;
  return {
    value: c?.value ?? "",
    code: c?.code ?? "",
    cost: bahtText(p?.itemCostSatang ?? 0),
    vat: p?.taxOnCost === 1,
    den: bahtText(p?.targetPriceSatang ?? 0),
    mechanic: bahtText(p?.b2bPriceSatang ?? 0),
    airplus: bahtText(p?.onlinePriceSatang ?? 0),
    shopee: bahtText(p?.shopeePriceSatang ?? 0),
    sellable: c?.onHand ?? 0,
    held: c?.held ?? 0,
  };
}

const NOT_A_NUMBER: Phrase = { th: "ใส่เป็นตัวเลข", en: "Type a number" };

/** บันทึก names only what is still empty, under its own box (owner, คูปอง 1 Nov). */
export function validateChoiceForm(f: ChoiceForm): ChoiceErrors {
  const errors: ChoiceErrors = {};
  if (!f.value.trim()) errors.value = { th: "ยังไม่ได้ใส่ชื่อตัวเลือก", en: "No name yet" };
  if (!f.code.trim()) errors.code = { th: "ยังไม่ได้ใส่รหัสสินค้า", en: "No code yet" };
  for (const key of ["cost", "den", "mechanic", "airplus", "shopee"] as const) {
    if (parseBaht(f[key]) == null) errors[key] = NOT_A_NUMBER;
  }
  return errors;
}

/** What the form saves. Selling prices are the owner's; anyone else keeps the stored ones. */
export function choiceBody(f: ChoiceForm, stored: Pricing | null, canPrice: boolean): ChoiceBody {
  const price = (typed: string, kept: number) => (canPrice ? (parseBaht(typed) ?? kept) : kept);
  return {
    value: f.value.trim(),
    code: f.code.trim(),
    pricing: {
      itemCostSatang: parseBaht(f.cost) ?? stored?.itemCostSatang ?? 0,
      taxOnCost: f.vat,
      targetPriceSatang: price(f.den, stored?.targetPriceSatang ?? 0),
      b2bPriceSatang: price(f.mechanic, stored?.b2bPriceSatang ?? 0),
      onlinePriceSatang: price(f.airplus, stored?.onlinePriceSatang ?? 0),
      shopeePriceSatang: price(f.shopee, stored?.shopeePriceSatang ?? 0),
      onlineCommissionBp: stored?.onlineCommissionBp ?? 0,
    },
  };
}

/** The two stock numbers as ledger moves on THIS choice; a new one starts from 0. */
export function choiceMoves(
  c: Choice | null,
  variantId: string,
  f: Pick<ChoiceForm, "sellable" | "held">,
): { adjust: StockCount | null; hold: HoldLine | null } {
  const onHand = c?.onHand ?? 0;
  const held = c?.held ?? 0;
  const adjust: StockCount | null =
    f.sellable !== onHand
      ? {
          productVariantId: variantId,
          countedOnHand: f.sellable,
          movementType: "manual_adjustment",
          reason: "edited on the phone's choice page",
        }
      : null;
  const delta = f.held - held;
  const hold: HoldLine | null =
    delta !== 0
      ? {
          productVariantId: variantId,
          takeAway: Math.max(delta, 0),
          bringBack: Math.max(-delta, 0),
        }
      : null;
  return { adjust, hold };
}

const REFUSALS: Record<string, Phrase> = {
  code_taken: { th: "มีรหัสนี้แล้ว", en: "This code is taken" },
  value_taken: { th: "มีตัวเลือกนี้แล้ว", en: "This choice is already there" },
  in_use: { th: "ขายไปแล้ว ลบไม่ได้", en: "Already sold — it stays" },
  last_choice: { th: "ต้องเหลืออย่างน้อย 1 ตัวเลือก", en: "Keep at least one choice" },
};

/** The server's refusal as a short line; anything unknown is "not saved". */
export const refusalText = (reason: string): Phrase =>
  REFUSALS[reason] ?? { th: "บันทึกไม่สำเร็จ", en: "Not saved" };
