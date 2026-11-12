import { describe, expect, it } from "vitest";
import {
  candidatesLine,
  choiceBody,
  choiceFormFrom,
  choiceMoves,
  choicePhoto,
  choicePrice,
  choiceStock,
  groupCandidates,
  groupCount,
  groupTitle,
  hasChoices,
  memberName,
  memberPrice,
  memberStock,
  optionsErrors,
  refusalText,
  sortedGroup,
  validateChoiceForm,
  type Choice,
  type GroupMember,
} from "./productChoices";
import type { ProductRow } from "./productList";

/** ตัวเลือกสินค้า + กลุ่มสินค้า on หน้าสินค้า (canvas board ChoicesGroup, approved 7 Nov 2026). */

const choice = (over: Partial<Choice> = {}): Choice => ({
  variantId: "v1",
  value: "3/8 เล็ก",
  code: "TG949142-00104D",
  imageKey: null,
  onHand: 100,
  held: 0,
  inUse: true,
  pricing: {
    itemCostSatang: 1200,
    taxOnCost: 0,
    targetPriceSatang: 3500,
    b2bPriceSatang: 2500,
    onlinePriceSatang: 3000,
    shopeePriceSatang: 3000,
    onlineCommissionBp: 0,
  },
  ...over,
});

const member = (over: Partial<GroupMember>): GroupMember => ({
  id: "denso",
  name: "ตู้แอร์ คอยล์เย็น Toyota Vigo | DENSO TG447610-72904D",
  productRef: "TG447610-72904D",
  typeName: "Evaporator",
  typeNameTh: "ตู้แอร์",
  brandName: "DENSO",
  imageKey: null,
  onHand: 17,
  priceSatang: 260000,
  ...over,
});

describe("hasChoices", () => {
  it("given a product with choices > then true; with none, or from before choices existed > then false", () => {
    expect(hasChoices({ choices: [choice()] })).toBe(true);
    expect(hasChoices({ choices: [] })).toBe(false);
    expect(hasChoices({})).toBe(false);
  });
});

describe("a choice row > photo · name · code · ขายได้ · ราคาลูกค้า", () => {
  it("given a choice > then ขายได้ N and its เด่นแอร์ price (the walk-in price the Scan card shows)", () => {
    expect(choiceStock(choice())).toEqual({ th: "ขายได้ 100", en: "100 for sale" });
    expect(choicePrice(choice())).toBe("฿35");
  });

  it("given a choice with no price yet > then a dash, not ฿0", () => {
    expect(choicePrice(choice({ pricing: null }))).toBe("—");
    expect(choicePrice(choice({ pricing: { ...choice().pricing!, targetPriceSatang: 0 } }))).toBe(
      "—",
    );
  });

  it("given a choice with its own photo > then that one; with none > then the product's first photo", () => {
    expect(choicePhoto(choice({ imageKey: "products/o/half.jpg" }), "products/o/cover.jpg")).toBe(
      "products/o/half.jpg",
    );
    expect(choicePhoto(choice(), "products/o/cover.jpg")).toBe("products/o/cover.jpg");
    expect(choicePhoto(choice(), null)).toBeNull();
  });
});

describe("กลุ่มสินค้า > a member with sizes (11 Nov 2026)", () => {
  it("given three sizes > then ขายได้ of all sizes and how many, and เริ่ม ฿ the cheapest", () => {
    const m = member({ onHand: 300, choiceCount: 3, priceSatang: 3500 });
    expect(memberStock(m)).toEqual({ th: "ขายได้ 300 · 3 ขนาด", en: "300 for sale · 3 sizes" });
    expect(memberPrice(m)).toEqual({ th: "เริ่ม ฿35", en: "from ฿35" });
  });

  it("given no sizes > then ขายได้ and the price alone", () => {
    const m = member({ onHand: 17, choiceCount: 1, priceSatang: 260000 });
    expect(memberStock(m)).toEqual({ th: "ขายได้ 17", en: "17 for sale" });
    expect(memberPrice(m)).toEqual({ th: "฿2,600", en: "฿2,600" });
  });
});

describe("กลุ่มสินค้า", () => {
  it("given a member > then [type] [brand] in Thai, as the bill names a part", () => {
    expect(memberName(member({}))).toBe("ตู้แอร์ DENSO");
    expect(memberName(member({ typeNameTh: null }))).toBe("Evaporator DENSO");
  });

  it("given a member with no part type > then its full name, never a bare brand", () => {
    expect(memberName(member({ typeName: null, typeNameTh: null }))).toBe(
      "ตู้แอร์ คอยล์เย็น Toyota Vigo | DENSO TG447610-72904D",
    );
  });

  it("given the members > then this product first, then the others cheapest first", () => {
    const all = [
      member({ id: "cg2", priceSatang: 185000 }),
      member({ id: "denso", priceSatang: 260000 }),
      member({ id: "vinn", priceSatang: 110000 }),
      member({ id: "formula", priceSatang: 150000 }),
    ];
    expect(sortedGroup(all, "denso").map((m) => m.id)).toEqual(["denso", "vinn", "formula", "cg2"]);
  });

  it("given five members > then the row says 5 สินค้า and the sheet กลุ่มสินค้า · 5 สินค้า", () => {
    expect(groupCount(5)).toEqual({ th: "5 สินค้า", en: "5 products" });
    expect(groupTitle(5)).toEqual({ th: "กลุ่มสินค้า · 5 สินค้า", en: "Group · 5 products" });
  });
});

const fit = (carModel: string, carBrand = "Toyota") => ({
  carBrand,
  carModel,
  yearFrom: 2004,
  yearTo: 2015,
});

const row = (over: Partial<ProductRow>): ProductRow => ({
  id: "x",
  variantId: "xv",
  productRef: "X-1",
  name: "ตู้แอร์ คอยล์เย็น Toyota Vigo",
  status: "active",
  imageKey: null,
  shopeeListed: 0,
  updatedAt: null,
  brandName: "Vinn",
  typeName: "Evaporator",
  usageName: "แอร์",
  offlinePriceSatang: 110000,
  onlinePriceSatang: 0,
  b2bPriceSatang: 0,
  itemCostSatang: 0,
  onlineCommissionBp: 0,
  taxOnCost: 0,
  onHand: 3,
  held: 0,
  fitments: [fit("Vigo")],
  ...over,
});

describe("groupCandidates > + เพิ่มสินค้าในกลุ่ม's search", () => {
  const self = { id: "denso", typeName: "Evaporator", fitments: [fit("Vigo")] };
  const rows = [
    row({ id: "denso", productRef: "TG447610-72904D" }),
    row({ id: "vinn", productRef: "EVA110010", name: "ตู้แอร์ คอยล์เย็น Toyota Vigo Vinn" }),
    row({
      id: "compressor",
      typeName: "Compressor",
      name: "คอมแอร์ Toyota Vigo",
      productRef: "C-1",
    }),
    row({
      id: "altis",
      name: "ตู้แอร์ คอยล์เย็น Toyota Altis",
      fitments: [fit("Altis")],
      productRef: "A-1",
    }),
    row({ id: "in-group", productRef: "G-1" }),
  ];

  it("given nothing typed > then the same part for the same first car, leaving out this product and its group", () => {
    const out = groupCandidates(rows, "", self, new Set(["denso", "in-group"]));
    expect(out.map((r) => r.id)).toEqual(["vinn"]);
  });

  it("given a word > then every name or code that has it, the same part and car first", () => {
    const out = groupCandidates(rows, "vigo", self, new Set(["denso"]));
    expect(out.map((r) => r.id)).toEqual(["vinn", "in-group", "compressor"]);
  });

  it("given a code typed in small letters > then that product", () => {
    expect(groupCandidates(rows, "eva110", self, new Set()).map((r) => r.id)).toEqual(["vinn"]);
  });

  it("given a word nothing has > then nothing (a match is a result, nothing more)", () => {
    expect(groupCandidates(rows, "zzz", self, new Set())).toEqual([]);
  });

  it("given the type and first car > then ตรงกัน · ตู้แอร์ · Toyota Vigo · พบ 4; without them > then พบ 4", () => {
    expect(candidatesLine("ตู้แอร์", "Toyota Vigo", 4)).toEqual({
      th: "ตรงกัน · ตู้แอร์ · Toyota Vigo · พบ 4",
      en: "Matching · ตู้แอร์ · Toyota Vigo · 4 found",
    });
    expect(candidatesLine(null, null, 4)).toEqual({ th: "พบ 4", en: "4 found" });
  });
});

describe("optionsErrors > the first เพิ่มตัวเลือก sheet", () => {
  it("given a name and values > then no problem", () => {
    expect(optionsErrors({ name: "ขนาด", values: ["3/8 เล็ก", "1/2 กลาง"] })).toEqual({
      name: null,
      values: [null, null],
    });
  });

  it("given an empty name and an empty value > then a line under each empty box only", () => {
    expect(optionsErrors({ name: " ", values: ["3/8 เล็ก", ""] })).toEqual({
      name: { th: "ยังไม่ได้ใส่ชื่อกลุ่ม", en: "No option name yet" },
      values: [null, { th: "ยังไม่ได้ใส่ค่า", en: "No value yet" }],
    });
  });

  it("given the same value twice > then the second says so", () => {
    expect(optionsErrors({ name: "ขนาด", values: ["3/8 เล็ก", "3/8 เล็ก "] }).values).toEqual([
      null,
      { th: "มีค่านี้แล้ว", en: "Already there" },
    ]);
  });
});

describe("the choice form > แก้ไขตัวเลือก / a new size", () => {
  it("given a choice > then its name, code, prices as typed text and its two stock numbers", () => {
    expect(choiceFormFrom(choice({ held: 2 }))).toEqual({
      value: "3/8 เล็ก",
      code: "TG949142-00104D",
      cost: "12",
      vat: false,
      den: "35",
      mechanic: "25",
      airplus: "30",
      shopee: "30",
      sellable: 100,
      held: 2,
    });
  });

  it("given a new size > then it starts empty, stock 0", () => {
    expect(choiceFormFrom(null)).toEqual({
      value: "",
      code: "",
      cost: "",
      vat: false,
      den: "",
      mechanic: "",
      airplus: "",
      shopee: "",
      sellable: 0,
      held: 0,
    });
  });

  it("given an empty name and code > then a line under each; a price that is not a number says so", () => {
    expect(validateChoiceForm({ ...choiceFormFrom(null), den: "3x" })).toEqual({
      value: { th: "ยังไม่ได้ใส่ชื่อตัวเลือก", en: "No name yet" },
      code: { th: "ยังไม่ได้ใส่รหัสสินค้า", en: "No code yet" },
      den: { th: "ใส่เป็นตัวเลข", en: "Type a number" },
    });
    expect(validateChoiceForm(choiceFormFrom(choice()))).toEqual({});
  });

  it("given the owner's form > then everything typed goes, in satang", () => {
    const f = { ...choiceFormFrom(choice()), value: " 3/8 เล็กสุด ", den: "40.50" };
    expect(choiceBody(f, choice().pricing, true)).toEqual({
      value: "3/8 เล็กสุด",
      code: "TG949142-00104D",
      pricing: {
        itemCostSatang: 1200,
        taxOnCost: false,
        targetPriceSatang: 4050,
        b2bPriceSatang: 2500,
        onlinePriceSatang: 3000,
        shopeePriceSatang: 3000,
        onlineCommissionBp: 0,
      },
    });
  });

  it("given someone who may not set selling prices > then the stored ones are kept; the cost is theirs", () => {
    const f = { ...choiceFormFrom(choice()), den: "99", cost: "15" };
    const body = choiceBody(f, choice().pricing, false);
    expect(body.pricing.targetPriceSatang).toBe(3500);
    expect(body.pricing.itemCostSatang).toBe(1500);
  });

  it("given the stock changed > then a recount of ขายได้ and a hold move for งานนอก on that choice", () => {
    const moves = choiceMoves(choice(), "v1", { sellable: 90, held: 3 });
    expect(moves.adjust).toMatchObject({ productVariantId: "v1", countedOnHand: 90 });
    expect(moves.hold).toEqual({ productVariantId: "v1", takeAway: 3, bringBack: 0 });
  });

  it("given a new size with stock typed > then the count starts from 0", () => {
    const moves = choiceMoves(null, "new-v", { sellable: 10, held: 0 });
    expect(moves.adjust).toMatchObject({ productVariantId: "new-v", countedOnHand: 10 });
    expect(moves.hold).toBeNull();
  });

  it("given no stock change > then no moves", () => {
    expect(choiceMoves(choice(), "v1", { sellable: 100, held: 0 })).toEqual({
      adjust: null,
      hold: null,
    });
  });
});

describe("refusalText > what the server refused, in words", () => {
  it("given each refusal > then a short line for it", () => {
    expect(refusalText("code_taken")).toEqual({ th: "มีรหัสนี้แล้ว", en: "This code is taken" });
    expect(refusalText("value_taken")).toEqual({
      th: "มีตัวเลือกนี้แล้ว",
      en: "This choice is already there",
    });
    expect(refusalText("in_use")).toEqual({
      th: "ขายไปแล้ว ลบไม่ได้",
      en: "Already sold — it stays",
    });
    expect(refusalText("last_choice")).toEqual({
      th: "ต้องเหลืออย่างน้อย 1 ตัวเลือก",
      en: "Keep at least one choice",
    });
    expect(refusalText("something new")).toEqual({ th: "บันทึกไม่สำเร็จ", en: "Not saved" });
  });
});
