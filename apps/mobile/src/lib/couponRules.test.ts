import { describe, expect, it } from "vitest";
import {
  bigValue,
  capLine,
  createBody,
  emptyForm,
  formOf,
  formProblems,
  kindLine,
  patchBody,
  type Coupon,
  type CouponForm,
} from "./couponPage";
import {
  carModelChoices,
  cutsPatch,
  pickedLine,
  scopeLine,
  toggleTarget,
  whoLine,
} from "./couponRules";

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();

const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  id: "c1",
  code: "DENSO10",
  name: "DENSO ลด 10%",
  type: "percent",
  value: 1000,
  minSubtotalSatang: 100000,
  maxDiscountSatang: 30000,
  startsAt: at(2026, 11, 1),
  endsAt: at(2026, 11, 30, 23, 59),
  maxUses: 100,
  maxUsesPerCustomer: 1,
  status: "active",
  createdAt: at(2026, 11, 1),
  redemptions: 4,
  createdByName: "คุณเก๋",
  appliesTo: "order",
  scope: "all",
  targets: [],
  signupFrom: null,
  signupTo: null,
  validDays: null,
  ...over,
});

const FREE = coupon({
  code: "WELCOME",
  appliesTo: "shipping",
  type: "percent",
  value: 10000,
  maxDiscountSatang: null,
  minSubtotalSatang: 50000,
});
const SHIP30 = coupon({
  code: "SHIP30",
  appliesTo: "shipping",
  type: "fixed",
  value: 3000,
  maxDiscountSatang: null,
  minSubtotalSatang: 0,
});

describe("card C > ส่งฟรี and ลดค่าส่ง (canvas v266)", () => {
  it("given free shipping > then ส่วนลดค่าส่ง over ส่งฟรี, with no cap beside it", () => {
    expect([kindLine(FREE).th, bigValue(FREE), capLine(FREE)]).toEqual([
      "ส่วนลดค่าส่ง",
      "ส่งฟรี",
      null,
    ]);
  });

  it("given ฿30 off shipping > then ส่วนลดค่าส่ง over ฿30", () => {
    expect([kindLine(SHIP30).th, bigValue(SHIP30)]).toEqual(["ส่วนลดค่าส่ง", "฿30"]);
  });

  it("given a coupon on the product price > then ส่วนลดสินค้า", () => {
    expect(kindLine(coupon()).th).toBe("ส่วนลดสินค้า");
  });
});

describe("ใช้กับ and ใครใช้ได้ (canvas v260, คูปอง 4–5)", () => {
  const t = (id: string, name: string) => ({ id, name, imageKey: null });

  it("scopeLine > every product, or what was picked", () => {
    expect(
      [
        coupon(),
        coupon({ scope: "brand", targets: [t("b1", "DENSO"), t("b2", "Sanden")] }),
        coupon({ scope: "category", targets: [t("t1", "คอมเพรสเซอร์")] }),
        coupon({ scope: "car_model", targets: [t("m1", "Toyota Vios")] }),
        coupon({ scope: "products", targets: [t("p1", "a"), t("p2", "b"), t("p3", "c")] }),
      ].map((c) => scopeLine(c.scope, c.targets).th),
    ).toEqual([
      "ทุกสินค้า",
      "ยี่ห้อ DENSO, Sanden",
      "หมวด คอมเพรสเซอร์",
      "รุ่นรถ Toyota Vios",
      "สินค้า 3 ชิ้น",
    ]);
  });

  it("whoLine > ทุกคน, or ลูกค้าใหม่ (with how long on the coupon page)", () => {
    const welcome = coupon({
      signupFrom: at(2026, 12, 1),
      signupTo: at(2026, 12, 31),
      validDays: 365,
    });
    expect([
      whoLine(coupon(), false).th,
      whoLine(welcome, false).th,
      whoLine(welcome, true).th,
    ]).toEqual(["ทุกคน", "ลูกค้าใหม่", "ลูกค้าใหม่ · ใช้ได้ 1 ปี"]);
  });
});

describe("the form > the new rules", () => {
  const filled = (over: Partial<CouponForm> = {}): CouponForm => ({
    ...emptyForm(),
    name: "x",
    amount: "10",
    code: "X1",
    ...over,
  });

  it("given ส่งฟรี > then 100% off the shipping fee, with no amount to type", () => {
    const form = filled({ cuts: "shipping", kind: "free", amount: "" });
    expect(formProblems(form, true)).toEqual({});
    expect(createBody(form)).toMatchObject({
      appliesTo: "shipping",
      type: "percent",
      value: 10000,
      maxDiscountSatang: null,
    });
  });

  it("given ฿30 off shipping > then fixed satang on the shipping fee", () => {
    expect(createBody(filled({ cuts: "shipping", kind: "fixed", amount: "30" }))).toMatchObject({
      appliesTo: "shipping",
      type: "fixed",
      value: 3000,
    });
  });

  it("given ใช้กับ some brands > then the scope and the picked ids", () => {
    const form = filled({
      scope: "brand",
      targets: [
        { id: "b1", name: "DENSO", imageKey: null },
        { id: "b2", name: "Sanden", imageKey: null },
      ],
    });
    expect(createBody(form)).toMatchObject({
      appliesTo: "order",
      scope: "brand",
      targets: ["b1", "b2"],
    });
    expect(patchBody(form)).toMatchObject({ scope: "brand", targets: ["b1", "b2"] });
  });

  it("given ลูกค้าใหม่ > then the sign-up window and a year each, and no coupon dates of its own", () => {
    const form = filled({
      newCustomers: true,
      signupFrom: at(2026, 12, 1),
      signupTo: at(2026, 12, 31, 23, 59),
      startsAt: at(2026, 11, 1),
      endsAt: at(2026, 11, 30),
    });
    expect(createBody(form)).toMatchObject({
      signupFrom: at(2026, 12, 1),
      signupTo: at(2026, 12, 31, 23, 59),
      validDays: 365,
      startsAt: null,
      endsAt: null,
    });
    expect(createBody(filled())).toMatchObject({
      signupFrom: null,
      signupTo: null,
      validDays: null,
    });
  });

  it("given ใช้กับ with nothing picked, or ลูกค้าใหม่ with no window > then each says so", () => {
    expect(formProblems(filled({ scope: "brand", targets: [] }), true).scope?.th).toBe(
      "ยังไม่ได้เลือกยี่ห้อ",
    );
    expect(formProblems(filled({ newCustomers: true }), true).when?.th).toBe(
      "ยังไม่ได้เลือกช่วงสมัคร",
    );
  });

  it("formOf > a saved ส่งฟรี ลูกค้าใหม่ coupon opens as it was made", () => {
    const saved = coupon({
      ...FREE,
      scope: "products",
      targets: [{ id: "p1", name: "a", imageKey: null }],
      signupFrom: at(2026, 12, 1),
      signupTo: at(2026, 12, 31),
      validDays: 365,
    });
    expect(formOf(saved)).toMatchObject({
      cuts: "shipping",
      kind: "free",
      scope: "products",
      targets: [{ id: "p1", name: "a", imageKey: null }],
      newCustomers: true,
      signupFrom: at(2026, 12, 1),
      signupTo: at(2026, 12, 31),
    });
  });
});

describe("the form's sheets (canvas v260, คูปอง 4–5)", () => {
  it("cutsPatch > given ลดเป็น % then ค่าส่ง > then ส่งฟรี", () => {
    expect(cutsPatch("percent", "shipping")).toEqual({ cuts: "shipping", kind: "free" });
  });

  it("cutsPatch > given ส่งฟรี then ราคาสินค้า > then ลดเป็น %", () => {
    expect(cutsPatch("free", "product")).toEqual({ cuts: "product", kind: "percent" });
  });

  it("cutsPatch > given ลดเป็นบาท > then stays ลดเป็นบาท either way", () => {
    expect(cutsPatch("fixed", "shipping")).toEqual({ cuts: "shipping", kind: "fixed" });
    expect(cutsPatch("fixed", "product")).toEqual({ cuts: "product", kind: "fixed" });
  });

  it("toggleTarget > given one not picked > then it is added; picked > then taken off", () => {
    const denso = { id: "br-denso", name: "DENSO", imageKey: null };
    const sanden = { id: "br-sanden", name: "Sanden", imageKey: null };
    expect(toggleTarget([denso], sanden)).toEqual([denso, sanden]);
    expect(toggleTarget([denso, sanden], denso)).toEqual([sanden]);
  });

  it("carModelChoices > given car brands > then every model as 'Toyota Vios', in Thai order", () => {
    const brands = [
      {
        name: "Toyota",
        models: [
          { id: "cm-vios", name: "Vios" },
          { id: "cm-altis", name: "Altis" },
        ],
      },
      { name: "Honda", models: [{ id: "cm-city", name: "City" }] },
    ];
    expect(carModelChoices(brands, "")).toEqual([
      { id: "cm-city", name: "Honda City", imageKey: null },
      { id: "cm-altis", name: "Toyota Altis", imageKey: null },
      { id: "cm-vios", name: "Toyota Vios", imageKey: null },
    ]);
  });

  it("carModelChoices > given a search > then only the names that hold it", () => {
    const brands = [
      {
        name: "Toyota",
        models: [
          { id: "cm-vios", name: "Vios" },
          { id: "cm-altis", name: "Altis" },
        ],
      },
    ];
    expect(carModelChoices(brands, "vio").map((c) => c.id)).toEqual(["cm-vios"]);
  });

  it("pickedLine > given brands > then their names; given products > then how many", () => {
    const two = [
      { id: "a", name: "DENSO", imageKey: null },
      { id: "b", name: "Sanden", imageKey: null },
    ];
    expect(pickedLine("brand", two)).toEqual({ th: "DENSO, Sanden", en: "DENSO, Sanden" });
    expect(pickedLine("products", two)).toEqual({ th: "2 ชิ้น", en: "2 products" });
  });
});
