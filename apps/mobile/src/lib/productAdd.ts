import { buildProductName, canBuildProductName } from "@l-shopee/core";
import type { Phrase } from "@l-shopee/shared/lang";
import {
  saveBody,
  validateForm,
  type EditRights,
  type FormErrors,
  type ProductDetail,
  type ProductForm,
  type SaveBody,
} from "./productEdit";
import type { Fitment } from "./productList";
import { attrLabel, type Named } from "./productPickers";
import type { Attributes, CarBrand } from "./productsApi";
import type { HoldLine } from "./scanTabs";

/**
 * เพิ่มสินค้า's rules (canvas v196): the edit form, started empty, saved as a draft in the background
 * once it has a name and a free code, and on บันทึก made the product; the next one starts with the
 * last one's brand, car system, part name and cars. No screen code here.
 */

/** What the next product starts with (ยกมาจากชิ้นก่อน). */
export interface Carry {
  brand: string | null;
  usage: string | null;
  type: string | null;
  fitments: Fitment[];
}

/** POST /products/full for a new product: no id until its draft row exists. */
export type NewProductBody = Omit<SaveBody, "id"> & { id?: string };

/** A new product's first stock, added to the ledger the way the web back office adds it. */
export interface OpeningStock {
  productVariantId: string;
  quantityDelta: number;
  movementType: "opening_balance";
  reason: string;
}

/** As drawn: empty, VAT on the cost, on AirPlus, not on Shopee. */
export function blankForm(carry?: Carry | null): ProductForm {
  return {
    name: "",
    code: "",
    description: "",
    cost: "",
    vat: true,
    den: "",
    mechanic: "",
    airplus: "",
    shopee: "",
    sellable: 0,
    held: 0,
    fitments: carry ? carry.fitments.map((f) => ({ ...f })) : [],
    brand: carry?.brand ?? null,
    usage: carry?.usage ?? null,
    type: carry?.type ?? null,
    weightKg: "",
    widthCm: "",
    lengthCm: "",
    heightCm: "",
    onAirplus: true,
    onShopee: false,
  };
}

export function carryFrom(f: ProductForm): Carry | null {
  if (!f.brand && !f.usage && !f.type && f.fitments.length === 0) return null;
  return { brand: f.brand, usage: f.usage, type: f.type, fitments: f.fitments };
}

function label(list: readonly Named[] | undefined, name: string): Phrase {
  const hit = list?.find((a) => a.name === name);
  return hit ? attrLabel(hit) : { th: name, en: name };
}

/** "DENSO · คอมเพรสเซอร์ · 2 รุ่นรถ" — brand and part name as people read them, then the cars. */
export function carryLine(carry: Carry, attrs: Attributes | null): Phrase {
  const parts: Phrase[] = [];
  if (carry.brand) parts.push(label(attrs?.brands, carry.brand));
  if (carry.type) parts.push(label(attrs?.types, carry.type));
  const n = carry.fitments.length;
  if (n > 0) parts.push({ th: `${n} รุ่นรถ`, en: `${n} car model${n === 1 ? "" : "s"}` });
  return {
    th: parts.map((p) => p.th).join(" · "),
    en: parts.map((p) => p.en).join(" · "),
  };
}

/** A product that is not saved yet, so the edit form's save rules can build its body. */
const NOT_SAVED: ProductDetail = {
  product: {
    id: "",
    productRef: "",
    name: "",
    description: null,
    status: "draft",
    imageKey: null,
    shopeeListed: 0,
    shopeeItemId: null,
    weightGrams: 0,
    widthMm: null,
    lengthMm: null,
    heightMm: null,
    brandName: null,
    typeName: null,
    usageName: null,
    updatedAt: null,
  },
  variantId: null,
  barcode: null,
  onHand: 0,
  held: 0,
  fitments: [],
  pricing: null,
  images: [],
};

/**
 * The body for a draft save or for บันทึก. Without an id the server finds the product BY CODE and
 * writes over it, so the draft row's id goes on every save after the first.
 *
 * Once the draft row exists, the server lets only the owner change its channels or sell prices.
 * So, as on แก้ไข, an admin's product is saved with the cost but no sell prices and waits off sale
 * (a draft) for the owner; the owner's goes live on AirPlus or is kept off sale (paused).
 */
export function addBody(
  f: ProductForm,
  rights: EditRights,
  draftId: string | null,
  finished: boolean,
): NewProductBody {
  const { id: _none, ...body } = saveBody(NOT_SAVED, f, rights);
  const owner = finished && rights.channels;
  return {
    ...(draftId ? { id: draftId } : {}),
    ...body,
    status: owner ? (f.onAirplus ? "active" : "paused") : "draft",
    shopeeListed: owner && f.onShopee,
  };
}

/**
 * The first stock: ขายได้ and งานนอก both come in as the opening stock, then the งานนอก part goes out
 * on its job, so the shelf shows ขายได้ and the job shows งานนอก.
 */
export function openingMoves(
  variantId: string,
  f: Pick<ProductForm, "sellable" | "held">,
): { adjust: OpeningStock | null; hold: HoldLine | null } {
  const total = f.sellable + f.held;
  return {
    adjust:
      total > 0
        ? {
            productVariantId: variantId,
            quantityDelta: total,
            movementType: "opening_balance",
            reason: "added on the phone's add-product page",
          }
        : null,
    hold: f.held > 0 ? { productVariantId: variantId, takeAway: f.held, bringBack: 0 } : null,
  };
}

/** A draft needs a name and a code no other product has, and nothing typed wrong. */
export function draftReady(f: ProductForm, codeTaken: boolean): boolean {
  return (
    f.name.trim() !== "" &&
    f.code.trim() !== "" &&
    !codeTaken &&
    Object.keys(validateForm(f)).length === 0
  );
}

/** What a draft save writes; stock and photos wait for บันทึก, so they are not part of it. */
export function draftKey(f: ProductForm): string {
  const { sellable: _s, held: _h, ...saved } = f;
  return JSON.stringify(saved);
}

/** Name and code missing together read as one line under them, as drawn. */
export function nameCodeProblem(errors: FormErrors): Phrase | null {
  if (errors.name && errors.code) {
    return { th: "ต้องมีชื่อสินค้าและรหัสสินค้า", en: "A product needs a name and a code" };
  }
  return errors.name ?? errors.code ?? null;
}

function modelTh(cars: CarBrand[] | null, f: Fitment): string | null {
  const brand = cars?.find((b) => b.name === f.carBrand);
  return brand?.models.find((m) => m.name === f.carModel)?.nameTh ?? null;
}

/**
 * ตั้งชื่อให้อัตโนมัติ: the shop's name pattern (packages/core productNaming) from the part name in
 * Thai, the cars and the brand and code. Null when the part name, a car or the code is missing.
 */
export function autoName(
  f: ProductForm,
  attrs: Attributes | null,
  cars: CarBrand[] | null,
): string | null {
  const input = {
    typeNameTh: f.type ? label(attrs?.types, f.type).th : null,
    fitments: f.fitments.map((car) => ({
      carBrand: car.carBrand,
      carModel: car.carModel,
      carModelTh: modelTh(cars, car),
    })),
    brandName: f.brand ? label(attrs?.brands, f.brand).en : null,
    productRef: f.code,
  };
  return canBuildProductName(input) ? buildProductName(input) : null;
}
