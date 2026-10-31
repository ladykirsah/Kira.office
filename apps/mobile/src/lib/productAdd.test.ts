import { describe, expect, it } from "vitest";
import {
  addBody,
  autoName,
  blankForm,
  carryFrom,
  carryLine,
  draftKey,
  draftReady,
  nameCodeProblem,
  openingMoves,
} from "./productAdd";
import type { ProductForm } from "./productEdit";
import type { Attributes, CarBrand } from "./productsApi";

const OWNER = { prices: true, channels: true };
const ADMIN = { prices: false, channels: false };

const ATTRS: Attributes = {
  brands: [{ id: "b1", name: "DENSO", nameTh: null, nameEn: "DENSO" }],
  usages: [{ id: "u1", name: "A/C", nameTh: "แอร์", nameEn: "A/C" }],
  types: [
    { id: "t1", name: "Compressor", nameTh: "คอมเพรสเซอร์", nameEn: "Compressor", usageId: "u1" },
  ],
};

const CARS: CarBrand[] = [
  {
    id: "c1",
    name: "Toyota",
    nameTh: "โตโยต้า",
    nameEn: "Toyota",
    models: [
      { id: "m1", name: "Vigo", nameTh: "วีโก้", nameEn: "Vigo", yearFrom: 2005, yearTo: 2014 },
      {
        id: "m2",
        name: "Fortuner",
        nameTh: "ฟอร์จูนเนอร์",
        nameEn: "Fortuner",
        yearFrom: 2005,
        yearTo: 2014,
      },
    ],
  },
];

const VIGO = { carBrand: "Toyota", carModel: "Vigo", yearFrom: 2005, yearTo: 2014 };
const FORTUNER = { carBrand: "Toyota", carModel: "Fortuner", yearFrom: 2005, yearTo: 2014 };

const FILLED: ProductForm = {
  ...blankForm(),
  name: "คอมเพรสเซอร์ Toyota Vigo",
  code: "DN-447220",
  cost: "2,400",
  den: "3,450",
  mechanic: "3,100",
  airplus: "3,690",
  shopee: "4,000",
  sellable: 4,
  held: 1,
  fitments: [VIGO, FORTUNER],
  brand: "DENSO",
  usage: "A/C",
  type: "Compressor",
  weightKg: "6.8",
};

describe("blankForm", () => {
  it("given a first product > then everything empty, VAT on, AirPlus on, Shopee off, as drawn", () => {
    expect(blankForm()).toEqual({
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
      fitments: [],
      brand: null,
      usage: null,
      type: null,
      weightKg: "",
      widthCm: "",
      lengthCm: "",
      heightCm: "",
      onAirplus: true,
      onShopee: false,
    });
  });

  it("given what the last product carried > then only its brand, system, part name and cars", () => {
    const next = blankForm(carryFrom(FILLED));
    expect(next).toEqual({
      ...blankForm(),
      brand: "DENSO",
      usage: "A/C",
      type: "Compressor",
      fitments: [VIGO, FORTUNER],
    });
  });
});

describe("carryFrom / carryLine", () => {
  it("given nothing picked > then nothing to carry", () => {
    expect(carryFrom(blankForm())).toBeNull();
  });

  it("given a brand, part name and two cars > then one line: brand · part · 2 รุ่นรถ", () => {
    expect(carryLine(carryFrom(FILLED)!, ATTRS)).toEqual({
      th: "DENSO · คอมเพรสเซอร์ · 2 รุ่นรถ",
      en: "DENSO · Compressor · 2 car models",
    });
  });

  it("given only cars > then just the cars", () => {
    const carry = carryFrom({ ...blankForm(), fitments: [VIGO] })!;
    expect(carryLine(carry, ATTRS)).toEqual({ th: "1 รุ่นรถ", en: "1 car model" });
  });
});

describe("addBody", () => {
  it("given a draft save > then a draft with no id, the code as the barcode, and every price typed", () => {
    expect(addBody(FILLED, OWNER, null, false)).toEqual({
      productRef: "DN-447220",
      barcode: "DN-447220",
      name: "คอมเพรสเซอร์ Toyota Vigo",
      description: null,
      status: "draft",
      shopeeListed: false,
      shopeeItemId: null,
      weightGrams: 6800,
      widthMm: null,
      lengthMm: null,
      heightMm: null,
      brandName: "DENSO",
      usageName: "A/C",
      typeName: "Compressor",
      fitments: [VIGO, FORTUNER],
      pricing: {
        itemCostSatang: 240000,
        taxOnCost: true,
        targetPriceSatang: 345000,
        b2bPriceSatang: 310000,
        onlinePriceSatang: 369000,
        shopeePriceSatang: 400000,
        onlineCommissionBp: 0,
      },
    });
  });

  it("given the draft row exists > then later saves go to that row, never by code", () => {
    expect(addBody(FILLED, OWNER, "p9", false).id).toBe("p9");
  });

  it("given the owner saves with AirPlus on > then it goes live, Shopee as switched", () => {
    const body = addBody({ ...FILLED, onShopee: true }, OWNER, "p9", true);
    expect([body.status, body.shopeeListed]).toEqual(["active", true]);
  });

  it("given the owner saves with AirPlus off > then it is kept off sale, not left a draft", () => {
    expect(addBody({ ...FILLED, onAirplus: false }, OWNER, "p9", true).status).toBe("paused");
  });

  it("given an admin saves > then it waits off sale for the owner, sell prices not set", () => {
    const body = addBody({ ...FILLED, onShopee: true }, ADMIN, "p9", true);
    expect([body.status, body.shopeeListed]).toEqual(["draft", false]);
    expect(body.pricing).toMatchObject({
      itemCostSatang: 240000,
      targetPriceSatang: 0,
      b2bPriceSatang: 0,
      onlinePriceSatang: 0,
      shopeePriceSatang: 0,
    });
  });
});

describe("openingMoves", () => {
  it("given ขายได้ 4 and งานนอก 1 > then 5 come in as the opening stock and 1 goes out on a job", () => {
    expect(openingMoves("v1", FILLED)).toEqual({
      adjust: {
        productVariantId: "v1",
        quantityDelta: 5,
        movementType: "opening_balance",
        reason: "added on the phone's add-product page",
      },
      hold: { productVariantId: "v1", takeAway: 1, bringBack: 0 },
    });
  });

  it("given no stock > then no movements", () => {
    expect(openingMoves("v1", blankForm())).toEqual({ adjust: null, hold: null });
  });
});

describe("draftReady / draftKey", () => {
  it("given a name and a code that is free > then a draft can be saved", () => {
    expect(draftReady(FILLED, false)).toBe(true);
  });

  it("given no name or no code > then not yet", () => {
    expect(draftReady({ ...FILLED, name: " " }, false)).toBe(false);
    expect(draftReady({ ...FILLED, code: "" }, false)).toBe(false);
  });

  it("given the code belongs to another product > then never (it would overwrite that one)", () => {
    expect(draftReady(FILLED, true)).toBe(false);
  });

  it("given a field that is not a number > then not until it is fixed", () => {
    expect(draftReady({ ...FILLED, weightKg: "abc" }, false)).toBe(false);
  });

  it("given only the stock changed > then the draft is the same (stock is saved on บันทึก)", () => {
    expect(draftKey({ ...FILLED, sellable: 9 })).toBe(draftKey(FILLED));
    expect(draftKey({ ...FILLED, name: "x" })).not.toBe(draftKey(FILLED));
  });
});

describe("nameCodeProblem", () => {
  it("given both missing > then one line, as drawn", () => {
    expect(nameCodeProblem({ name: { th: "a", en: "a" }, code: { th: "b", en: "b" } })).toEqual({
      th: "ต้องมีชื่อสินค้าและรหัสสินค้า",
      en: "A product needs a name and a code",
    });
  });

  it("given one missing > then that one", () => {
    expect(nameCodeProblem({ code: { th: "b", en: "b" } })).toEqual({ th: "b", en: "b" });
  });

  it("given neither > then nothing", () => {
    expect(nameCodeProblem({})).toBeNull();
  });
});

describe("autoName", () => {
  it("given a part name, cars and a code > then the shop's name pattern, other cars in Thai", () => {
    expect(autoName({ ...FILLED, code: "DN-447230" }, ATTRS, CARS)).toBe(
      "คอมเพรสเซอร์ Toyota Vigo / ฟอร์จูนเนอร์ | DENSO DN-447230",
    );
  });

  it("given no part name, no car or no code > then nothing (the page says what is missing)", () => {
    expect(autoName({ ...FILLED, type: null }, ATTRS, CARS)).toBeNull();
    expect(autoName({ ...FILLED, fitments: [] }, ATTRS, CARS)).toBeNull();
    expect(autoName({ ...FILLED, code: "" }, ATTRS, CARS)).toBeNull();
  });

  it("given the lists not loaded > then the stored names still make a name", () => {
    expect(autoName(FILLED, null, null)).toBe(
      "Compressor Toyota Vigo / Fortuner | DENSO DN-447220",
    );
  });
});
