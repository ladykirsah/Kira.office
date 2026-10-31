import type { Phrase } from "@l-shopee/shared/lang";
import { formatBaht } from "./money";
import type { HoldLine } from "./scanTabs";
import type { Fitment } from "./productList";
import type { GalleryImage, Pricing } from "./productPage";

/**
 * แก้ไขสินค้า's rules (canvas v194): the form a product opens into, and the one POST /products/full
 * it saves as. That call REPLACES the whole record — anything left out is wiped — so the body is
 * always built from the full stored product plus what the form changed. No screen code here.
 */

/** GET /products/:id. */
export interface ProductDetail {
  product: {
    id: string;
    productRef: string;
    name: string;
    description: string | null;
    status: string;
    imageKey: string | null;
    shopeeListed: number;
    shopeeItemId: string | null;
    weightGrams: number;
    widthMm: number | null;
    lengthMm: number | null;
    heightMm: number | null;
    brandName: string | null;
    typeName: string | null;
    usageName: string | null;
    updatedAt: number | null;
  };
  variantId: string | null;
  barcode: string | null;
  onHand: number;
  held: number;
  fitments: Fitment[];
  pricing: Pricing | null;
  images: GalleryImage[];
}

/** What the form holds while it is being edited. Money and sizes stay as typed until saved. */
export interface ProductForm {
  name: string;
  code: string;
  description: string;
  cost: string;
  vat: boolean;
  den: string;
  mechanic: string;
  airplus: string;
  shopee: string;
  sellable: number;
  held: number;
  fitments: Fitment[];
  /** Brand, car system and part name by their identity `name`. */
  brand: string | null;
  usage: string | null;
  type: string | null;
  weightKg: string;
  widthCm: string;
  lengthCm: string;
  heightCm: string;
  onAirplus: boolean;
  onShopee: boolean;
}

/** Who may change what (packages/core staffAuth): sell prices and the two channels are the owner's. */
export interface EditRights {
  prices: boolean;
  channels: boolean;
}

export interface SaveBody {
  id: string;
  productRef: string;
  barcode: string;
  name: string;
  description: string | null;
  status: string;
  shopeeListed: boolean;
  shopeeItemId: string | null;
  weightGrams: number;
  widthMm: number | null;
  lengthMm: number | null;
  heightMm: number | null;
  brandName: string | null;
  usageName: string | null;
  typeName: string | null;
  fitments: Fitment[];
  pricing: Omit<Pricing, "taxOnCost"> & { taxOnCost: boolean };
}

export type FormErrors = Partial<
  Record<
    "name" | "code" | "cost" | "den" | "mechanic" | "airplus" | "shopee" | "weight" | "box",
    Phrase
  >
>;

/** "3,450" for a text field: no ฿, commas, no .00; empty when the price was never set. */
export function bahtText(satang: number): string {
  return satang ? formatBaht(satang).slice(1) : "";
}

/** Typed baht → satang; empty is 0 (not set). Null when it is not an amount. */
export function parseBaht(text: string): number | null {
  const raw = text.replace(/,/g, "").trim();
  if (!raw) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  return Math.round(Number(raw) * 100);
}

const cmText = (mm: number | null) => (mm ? String(Math.round(mm) / 10) : "");

/** Empty → null (not set); a positive number of centimetres → millimetres; anything else → NaN. */
function cmToMm(text: string): number | null {
  const raw = text.trim();
  if (!raw) return null;
  const cm = Number(raw);
  return Number.isFinite(cm) && cm > 0 ? Math.round(cm * 10) : Number.NaN;
}

function kgToGrams(text: string): number {
  const raw = text.trim();
  if (!raw) return 0;
  const kg = Number(raw);
  return Number.isFinite(kg) && kg >= 0 ? Math.round(kg * 1000) : Number.NaN;
}

export function formFrom(d: ProductDetail): ProductForm {
  const p = d.pricing;
  return {
    name: d.product.name,
    code: d.product.productRef,
    description: d.product.description ?? "",
    cost: bahtText(p?.itemCostSatang ?? 0),
    vat: p?.taxOnCost === 1,
    den: bahtText(p?.targetPriceSatang ?? 0),
    mechanic: bahtText(p?.b2bPriceSatang ?? 0),
    airplus: bahtText(p?.onlinePriceSatang ?? 0),
    shopee: bahtText(p?.shopeePriceSatang ?? 0),
    sellable: d.onHand,
    held: d.held,
    fitments: d.fitments.map((f) => ({ ...f })),
    brand: d.product.brandName,
    usage: d.product.usageName,
    type: d.product.typeName,
    weightKg: d.product.weightGrams ? String(d.product.weightGrams / 1000) : "",
    widthCm: cmText(d.product.widthMm),
    lengthCm: cmText(d.product.lengthMm),
    heightCm: cmText(d.product.heightMm),
    onAirplus: d.product.status === "active",
    onShopee: d.product.shopeeListed === 1,
  };
}

const NOT_A_NUMBER: Phrase = { th: "ใส่เป็นตัวเลข", en: "Type a number" };

/** Each problem under its own field; an empty object means the form can be saved. */
export function validateForm(f: ProductForm): FormErrors {
  const errors: FormErrors = {};
  if (!f.name.trim()) errors.name = { th: "ใส่ชื่อสินค้าก่อน", en: "Add the product name" };
  if (!f.code.trim()) errors.code = { th: "ใส่รหัสสินค้าก่อน", en: "Add the product code" };
  for (const key of ["cost", "den", "mechanic", "airplus", "shopee"] as const) {
    if (parseBaht(f[key]) == null) errors[key] = NOT_A_NUMBER;
  }
  if (Number.isNaN(kgToGrams(f.weightKg))) errors.weight = NOT_A_NUMBER;
  if ([f.widthCm, f.lengthCm, f.heightCm].some((s) => Number.isNaN(cmToMm(s)))) {
    errors.box = NOT_A_NUMBER;
  }
  return errors;
}

/** AirPlus on = live; off takes a live product off sale (paused) and leaves a draft a draft. */
function nextStatus(current: string, live: boolean): string {
  if (live) return "active";
  return current === "active" ? "paused" : current;
}

/** The whole product for POST /products/full. Call only on a form with no errors. */
export function saveBody(d: ProductDetail, f: ProductForm, rights: EditRights): SaveBody {
  const stored = d.pricing;
  const price = (typed: string, kept: number) =>
    rights.prices ? (parseBaht(typed) ?? kept) : kept;
  const code = f.code.trim();
  return {
    id: d.product.id,
    productRef: code,
    // The barcode is the product code (one identifier), as the web back office saves it.
    barcode: code,
    name: f.name.trim(),
    description: f.description.trim() || null,
    status: rights.channels ? nextStatus(d.product.status, f.onAirplus) : d.product.status,
    shopeeListed: rights.channels ? f.onShopee : d.product.shopeeListed === 1,
    shopeeItemId: d.product.shopeeItemId,
    weightGrams: kgToGrams(f.weightKg),
    widthMm: cmToMm(f.widthCm),
    lengthMm: cmToMm(f.lengthCm),
    heightMm: cmToMm(f.heightCm),
    brandName: f.brand,
    usageName: f.usage,
    typeName: f.type,
    fitments: f.fitments,
    pricing: {
      itemCostSatang: parseBaht(f.cost) ?? stored?.itemCostSatang ?? 0,
      taxOnCost: f.vat,
      targetPriceSatang: price(f.den, stored?.targetPriceSatang ?? 0),
      b2bPriceSatang: price(f.mechanic, stored?.b2bPriceSatang ?? 0),
      onlinePriceSatang: price(f.airplus, stored?.onlinePriceSatang ?? 0),
      shopeePriceSatang: price(f.shopee, stored?.shopeePriceSatang ?? 0),
      // Shopee's fee moves to a settings page later (owner, 31 Oct 2026); until then it is kept.
      onlineCommissionBp: stored?.onlineCommissionBp ?? 0,
    },
  };
}

/** A count of ขายได้ as typed; the server works the difference out against its own figure. */
export interface StockCount {
  productVariantId: string;
  countedOnHand: number;
  movementType: "manual_adjustment";
  reason: string;
}

/**
 * The two stock numbers as ledger movements. People just − / + and save (owner, 31 Oct 2026), so
 * a lower ขายได้ is a recount, never a question about why.
 */
export function stockMoves(
  d: ProductDetail,
  f: Pick<ProductForm, "sellable" | "held">,
): { adjust: StockCount | null; hold: HoldLine | null } {
  if (!d.variantId) return { adjust: null, hold: null };
  const adjust: StockCount | null =
    f.sellable !== d.onHand
      ? {
          productVariantId: d.variantId,
          countedOnHand: f.sellable,
          movementType: "manual_adjustment",
          reason: "edited on the phone's product page",
        }
      : null;
  const delta = f.held - d.held;
  const hold: HoldLine | null =
    delta !== 0
      ? {
          productVariantId: d.variantId,
          takeAway: Math.max(delta, 0),
          bringBack: Math.max(-delta, 0),
        }
      : null;
  return { adjust, hold };
}

const sameCar = (a: Fitment, b: Fitment) =>
  a.carBrand === b.carBrand &&
  a.carModel === b.carModel &&
  a.yearFrom === b.yearFrom &&
  a.yearTo === b.yearTo;

export function addFitment(list: readonly Fitment[], car: Fitment): Fitment[] {
  return list.some((f) => sameCar(f, car)) ? [...list] : [...list, car];
}

/** A new car system keeps the part name only when that name belongs to it. */
export function withUsage(f: ProductForm, usage: string, typeUsage: string | null): ProductForm {
  return { ...f, usage, type: typeUsage === usage ? f.type : null };
}
