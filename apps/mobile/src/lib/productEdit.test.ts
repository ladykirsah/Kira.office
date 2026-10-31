import { describe, expect, it } from "vitest";
import {
  addFitment,
  bahtText,
  formFrom,
  parseBaht,
  saveBody,
  stockMoves,
  validateForm,
  withUsage,
  type ProductDetail,
} from "./productEdit";

const DETAIL: ProductDetail = {
  product: {
    id: "p1",
    productRef: "DN-447220",
    name: "คอมเพรสเซอร์ DENSO 10S11C",
    description: "ของแท้",
    status: "active",
    imageKey: "products/p1/a.jpg",
    shopeeListed: 1,
    shopeeItemId: "SHP-9",
    weightGrams: 6800,
    widthMm: 300,
    lengthMm: 250,
    heightMm: 250,
    brandName: "DENSO",
    typeName: "Compressor",
    usageName: "A/C",
    updatedAt: 1,
  },
  variantId: "v1",
  barcode: "DN-447220",
  onHand: 4,
  held: 1,
  fitments: [{ carBrand: "Toyota", carModel: "Vigo", yearFrom: 2005, yearTo: 2014 }],
  pricing: {
    itemCostSatang: 240000,
    taxOnCost: 1,
    targetPriceSatang: 345000,
    b2bPriceSatang: 310000,
    onlinePriceSatang: 369000,
    shopeePriceSatang: 400000,
    onlineCommissionBp: 1200,
  },
  images: [],
};

const OWNER = { prices: true, channels: true };
const ADMIN = { prices: false, channels: false };

describe("bahtText / parseBaht", () => {
  it("given satang > then baht with commas and no ฿, empty when not set", () => {
    expect(bahtText(345000)).toBe("3,450");
    expect(bahtText(129050)).toBe("1,290.5");
    expect(bahtText(0)).toBe("");
  });
  it("given typed baht > then satang", () => {
    expect(parseBaht("3,450")).toBe(345000);
    expect(parseBaht(" 1290.50 ")).toBe(129050);
    expect(parseBaht("")).toBe(0);
  });
  it("given something that is not an amount > then null", () => {
    expect(parseBaht("abc")).toBeNull();
    expect(parseBaht("-5")).toBeNull();
  });
});

describe("saveBody", () => {
  it("given no changes > then everything the product had goes back as it was", () => {
    expect(saveBody(DETAIL, formFrom(DETAIL), OWNER)).toEqual({
      id: "p1",
      productRef: "DN-447220",
      barcode: "DN-447220",
      name: "คอมเพรสเซอร์ DENSO 10S11C",
      description: "ของแท้",
      status: "active",
      shopeeListed: true,
      shopeeItemId: "SHP-9",
      weightGrams: 6800,
      widthMm: 300,
      lengthMm: 250,
      heightMm: 250,
      brandName: "DENSO",
      usageName: "A/C",
      typeName: "Compressor",
      fitments: [{ carBrand: "Toyota", carModel: "Vigo", yearFrom: 2005, yearTo: 2014 }],
      pricing: {
        itemCostSatang: 240000,
        taxOnCost: true,
        targetPriceSatang: 345000,
        b2bPriceSatang: 310000,
        onlinePriceSatang: 369000,
        shopeePriceSatang: 400000,
        onlineCommissionBp: 1200,
      },
    });
  });

  it("given the owner's edits > then the new values, with Shopee's fee kept", () => {
    const form = {
      ...formFrom(DETAIL),
      name: " คอม DENSO ใหม่ ",
      code: "DN-447230",
      den: "3,500",
      vat: false,
      weightKg: "7",
      heightCm: "30",
      description: "  ",
    };
    const body = saveBody(DETAIL, form, OWNER);
    expect(body).toMatchObject({
      name: "คอม DENSO ใหม่",
      productRef: "DN-447230",
      barcode: "DN-447230",
      description: null,
      weightGrams: 7000,
      heightMm: 300,
    });
    expect(body.pricing).toMatchObject({
      targetPriceSatang: 350000,
      taxOnCost: false,
      onlineCommissionBp: 1200,
    });
  });

  it("given an admin > then the sell prices stay as stored but the cost is theirs", () => {
    const form = { ...formFrom(DETAIL), den: "9,999", cost: "2,500" };
    expect(saveBody(DETAIL, form, ADMIN).pricing).toMatchObject({
      itemCostSatang: 250000,
      targetPriceSatang: 345000,
    });
  });

  it("given an admin > then AirPlus and Shopee stay as they were", () => {
    const form = { ...formFrom(DETAIL), onAirplus: false, onShopee: false };
    expect(saveBody(DETAIL, form, ADMIN)).toMatchObject({ status: "active", shopeeListed: true });
  });

  it("given AirPlus switched off a live product > then it is paused, not a draft", () => {
    const form = { ...formFrom(DETAIL), onAirplus: false };
    expect(saveBody(DETAIL, form, OWNER).status).toBe("paused");
  });

  it("given AirPlus left off on a draft > then it stays a draft", () => {
    const draft = { ...DETAIL, product: { ...DETAIL.product, status: "draft" } };
    expect(saveBody(draft, formFrom(draft), OWNER).status).toBe("draft");
  });

  it("given a box side cleared > then that side is sent empty", () => {
    const form = { ...formFrom(DETAIL), widthCm: "" };
    expect(saveBody(DETAIL, form, OWNER).widthMm).toBeNull();
  });
});

describe("validateForm", () => {
  it("given a full form > then no errors", () => {
    expect(validateForm(formFrom(DETAIL))).toEqual({});
  });
  it("given no name or code > then each says what is missing", () => {
    const errors = validateForm({ ...formFrom(DETAIL), name: " ", code: "" });
    expect(errors.name).toEqual({ th: "ใส่ชื่อสินค้าก่อน", en: "Add the product name" });
    expect(errors.code).toEqual({ th: "ใส่รหัสสินค้าก่อน", en: "Add the product code" });
  });
  it("given a price that is not a number > then that field says so", () => {
    expect(validateForm({ ...formFrom(DETAIL), shopee: "สี่พัน" }).shopee).toEqual({
      th: "ใส่เป็นตัวเลข",
      en: "Type a number",
    });
  });
});

describe("stockMoves", () => {
  it("given the counts unchanged > then nothing to record", () => {
    expect(stockMoves(DETAIL, formFrom(DETAIL))).toEqual({ adjust: null, hold: null });
  });
  it("given a new ขายได้ > then the count is sent as counted, with no reason asked", () => {
    expect(stockMoves(DETAIL, { ...formFrom(DETAIL), sellable: 2 }).adjust).toEqual({
      productVariantId: "v1",
      countedOnHand: 2,
      movementType: "manual_adjustment",
      reason: "edited on the phone's product page",
    });
  });
  it("given more out on jobs > then the difference is taken away", () => {
    expect(stockMoves(DETAIL, { ...formFrom(DETAIL), held: 3 }).hold).toEqual({
      productVariantId: "v1",
      takeAway: 2,
      bringBack: 0,
    });
  });
  it("given fewer out on jobs > then the difference comes back", () => {
    expect(stockMoves(DETAIL, { ...formFrom(DETAIL), held: 0 }).hold).toEqual({
      productVariantId: "v1",
      takeAway: 0,
      bringBack: 1,
    });
  });
});

describe("addFitment", () => {
  const vios = { carBrand: "Toyota", carModel: "Vios", yearFrom: 2013, yearTo: 2022 };
  it("given a new car > then it joins the end", () => {
    expect(addFitment(DETAIL.fitments, vios)).toEqual([...DETAIL.fitments, vios]);
  });
  it("given a car already there > then the list stays the same", () => {
    expect(addFitment(DETAIL.fitments, { ...DETAIL.fitments[0]! })).toEqual(DETAIL.fitments);
  });
});

describe("withUsage", () => {
  const form = formFrom(DETAIL);
  it("given a new system the part name belongs to > then the part name stays", () => {
    expect(withUsage(form, "A/C", "A/C")).toMatchObject({ usage: "A/C", type: "Compressor" });
  });
  it("given a system the part name is not in > then the part name is cleared", () => {
    expect(withUsage(form, "Engine", "A/C")).toMatchObject({ usage: "Engine", type: null });
  });
});
