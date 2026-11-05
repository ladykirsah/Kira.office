import { describe, expect, it } from "vitest";
import {
  COPIED_TOAST,
  USED_TOAST,
  bigValue,
  canDelete,
  couponState,
  createBody,
  creatorName,
  duplicateProblem,
  emptyForm,
  filterCounts,
  formOf,
  formProblems,
  inFilter,
  patchBody,
  pageWindow,
  usedShare,
  usedValue,
  cleanCode,
  cleanCount,
  cleanMoney,
  capLine,
  footLine,
  forLine,
  kindLine,
  stateLine,
  type Coupon,
} from "./couponPage";

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();
const NOW = at(2026, 11, 5, 12);

const coupon = (over: Partial<Coupon> = {}): Coupon => ({
  id: "c1",
  code: "NEWNOV",
  name: "ลูกค้าใหม่ พ.ย.",
  type: "percent",
  value: 1000,
  minSubtotalSatang: 100000,
  maxDiscountSatang: 30000,
  startsAt: at(2026, 11, 1),
  endsAt: at(2026, 11, 30, 23, 59),
  maxUses: 100,
  maxUsesPerCustomer: 1,
  status: "active",
  createdAt: at(2026, 10, 28),
  redemptions: 12,
  createdByName: "คุณเก๋",
  appliesTo: "order",
  scope: "all",
  targets: [],
  signupFrom: null,
  signupTo: null,
  validDays: null,
  ...over,
});

/** The five coupons on the drawing (canvas v252, คูปอง 1). */
const DRAWN: Coupon[] = [
  coupon(),
  coupon({ id: "c2", code: "TECH200", type: "fixed", value: 20000, minSubtotalSatang: 200000 }),
  coupon({
    id: "c3",
    code: "SHIP1111",
    type: "fixed",
    value: 8000,
    minSubtotalSatang: 0,
    startsAt: at(2026, 11, 11),
    endsAt: at(2026, 11, 12, 23, 59),
    maxUses: 200,
    redemptions: 0,
  }),
  coupon({ id: "c4", code: "LINE5", value: 500, status: "disabled", maxUses: null }),
  coupon({
    id: "c5",
    code: "OPEN15",
    value: 1500,
    minSubtotalSatang: 0,
    maxDiscountSatang: 50000,
    endsAt: at(2026, 10, 31),
    startsAt: at(2026, 10, 1),
    redemptions: 88,
    maxUses: null,
  }),
];

describe("couponState", () => {
  it("given an active coupon inside its dates > then ใช้ได้อยู่", () => {
    expect(couponState(coupon(), NOW)).toBe("live");
  });

  it("given a start still ahead > then รอเริ่ม", () => {
    expect(couponState(DRAWN[2]!, NOW)).toBe("waiting");
  });

  it("given เปิดใช้ off > then ปิดอยู่, even when it has also run out", () => {
    expect(couponState(DRAWN[3]!, NOW)).toBe("off");
    expect(couponState(coupon({ status: "disabled", endsAt: at(2026, 1, 1) }), NOW)).toBe("off");
  });

  it("given its end has passed > then หมดอายุแล้ว", () => {
    expect(couponState(DRAWN[4]!, NOW)).toBe("ended");
  });

  it("given every use taken > then ใช้ครบแล้ว, not ใช้ได้อยู่", () => {
    expect(couponState(coupon({ redemptions: 100 }), NOW)).toBe("usedUp");
  });
});

describe("filterCounts / inFilter", () => {
  it("given the drawn five > then ทั้งหมด 5 · เปิดอยู่ 3 · ปิดอยู่ 1 · หมดอายุ 1", () => {
    expect(filterCounts(DRAWN, NOW)).toEqual({ all: 5, on: 3, off: 1, ended: 1 });
  });

  it("given หมดอายุ picked > then only OPEN15 shows", () => {
    expect(DRAWN.filter((c) => inFilter(c, "ended", NOW)).map((c) => c.code)).toEqual(["OPEN15"]);
  });

  it("given เปิดอยู่ picked > then a waiting one counts as on", () => {
    expect(DRAWN.filter((c) => inFilter(c, "on", NOW)).map((c) => c.code)).toEqual([
      "NEWNOV",
      "TECH200",
      "SHIP1111",
    ]);
  });
});

describe("the card's words", () => {
  it("bigValue > percent as 10% (12.5% when it has a half), baht as ฿200", () => {
    expect(bigValue(coupon())).toBe("10%");
    expect(bigValue(coupon({ value: 1250 }))).toBe("12.5%");
    expect(bigValue(DRAWN[1]!)).toBe("฿200");
  });
});

describe("card C (canvas v266): the list's card and the coupon page's card", () => {
  const t = (id: string, name: string) => ({ id, name, imageKey: null });
  const fresh = { signupFrom: at(2026, 12, 1), signupTo: at(2026, 12, 31), validDays: 365 };

  it("kindLine > ส่วนลดสินค้า, or ส่วนลดค่าส่ง for a coupon on the shipping fee", () => {
    expect(kindLine(coupon()).th).toBe("ส่วนลดสินค้า");
    expect(kindLine(coupon({ appliesTo: "shipping", type: "fixed", value: 3000 })).th).toBe(
      "ส่วนลดค่าส่ง",
    );
  });

  it("capLine > สูงสุด ฿300 beside a percent; nothing without a cap, on baht or on ส่งฟรี", () => {
    expect(capLine(coupon())?.th).toBe("สูงสุด ฿300");
    expect(capLine(coupon({ maxDiscountSatang: null }))).toBeNull();
    // TECH200 is baht; the old back office may have saved a cap on it, which nobody can change.
    expect(capLine(DRAWN[1]!)).toBeNull();
    expect(capLine(coupon({ appliesTo: "shipping", value: 10000 }))).toBeNull();
  });

  it("forLine > สำหรับทุกออเดอร์, or the brands, category, car or picked products", () => {
    expect(
      [
        coupon(),
        coupon({ scope: "brand", targets: [t("b1", "Cool Gear")] }),
        coupon({ scope: "brand", targets: [t("b1", "DENSO"), t("b2", "Sanden")] }),
        coupon({ scope: "category", targets: [t("t1", "คอมเพรสเซอร์")] }),
        coupon({ scope: "car_model", targets: [t("m1", "Toyota Vigo")] }),
        coupon({ scope: "products", targets: [t("p1", "a"), t("p2", "b")] }),
      ].map((c) => forLine(c).th),
    ).toEqual([
      "สำหรับทุกออเดอร์",
      "สำหรับสินค้า Cool Gear",
      "สำหรับสินค้า DENSO, Sanden",
      "สำหรับสินค้าหมวด คอมเพรสเซอร์",
      "สำหรับสินค้า Toyota Vigo เท่านั้น",
      "สำหรับสินค้าที่เลือก 2 ชิ้น",
    ]);
  });

  it("forLine > given ลูกค้าใหม่ > then สำหรับลูกค้าใหม่, then what it is for when not everything", () => {
    expect(forLine(coupon(fresh)).th).toBe("สำหรับลูกค้าใหม่");
    expect(forLine(coupon({ ...fresh, scope: "brand", targets: [t("b1", "DENSO")] })).th).toBe(
      "สำหรับลูกค้าใหม่ · สินค้า DENSO",
    );
  });

  it("stateLine > ใช้ได้ถึง its last day, ใช้ได้ตลอด with none, เปิดตัว its first day, ใช้ไม่ได้ when off", () => {
    expect(stateLine(coupon(), NOW).th).toBe("ใช้ได้ถึง 30 พ.ย.");
    expect(stateLine(coupon({ startsAt: null, endsAt: null }), NOW).th).toBe("ใช้ได้ตลอด");
    expect(stateLine(coupon(fresh), NOW).th).toBe("ใช้ได้ถึง 30 พ.ย.");
    expect(stateLine(DRAWN[2]!, NOW).th).toBe("เปิดตัว 11 พ.ย.");
    expect(stateLine(DRAWN[3]!, NOW).th).toBe("ใช้ไม่ได้");
    expect(stateLine(DRAWN[4]!, NOW).th).toBe("หมดอายุแล้ว");
  });

  it("stateLine > given a day in another year > then with its Thai year; every use taken > ใช้ครบแล้ว", () => {
    expect(stateLine(coupon({ endsAt: at(2027, 1, 15) }), NOW).th).toBe("ใช้ได้ถึง 15 ม.ค. 2570");
    expect(stateLine(coupon({ redemptions: 100 }), NOW).th).toBe("ใช้ครบแล้ว");
  });

  it("footLine > the minimum or ไม่มีขั้นต่ำ, then how many were used", () => {
    expect(footLine(coupon()).th).toBe("ซื้อครบ ฿1,000 · ใช้ไป 12 จาก 100");
    expect(footLine(DRAWN[2]!).th).toBe("ไม่มีขั้นต่ำ · ใช้ไป 0 จาก 200");
    expect(footLine(DRAWN[4]!).th).toBe("ไม่มีขั้นต่ำ · ใช้ไป 88");
  });
});

describe("the coupon page's words", () => {
  it("usedValue / usedShare > 12 จาก 100 with its bar; no limit → just the count, no bar", () => {
    expect(usedValue(coupon()).th).toBe("12 จาก 100");
    expect(usedShare(coupon())).toBeCloseTo(0.12);
    expect(usedValue(DRAWN[4]!).th).toBe("88 ครั้ง");
    expect(usedShare(DRAWN[4]!)).toBeNull();
    expect(usedShare(coupon({ redemptions: 130 }))).toBe(1);
  });

  it("pageWindow > the dates with the Thai year; none → ตลอดเวลา", () => {
    expect(pageWindow(coupon().startsAt, coupon().endsAt).th).toBe("1–30 พ.ย. 2569");
    expect(pageWindow(null, null).th).toBe("ตลอดเวลา");
    expect(pageWindow(at(2026, 12, 28), at(2027, 1, 3)).th).toBe("28 ธ.ค. 2569 – 3 ม.ค. 2570");
    expect(pageWindow(at(2026, 11, 11), null).th).toBe("ตั้งแต่ 11 พ.ย. 2569");
  });

  it("creatorName > the person who made it; a coupon from before → —", () => {
    expect(creatorName(coupon())).toBe("คุณเก๋");
    expect(creatorName(coupon({ createdByName: null }))).toBe("—");
  });

  it("canDelete > only a coupon nobody has used (in use = no delete button, DeskCoupons board)", () => {
    expect(canDelete(coupon({ redemptions: 0 }))).toBe(true);
    expect(canDelete(coupon({ redemptions: 8 }))).toBe(false);
  });

  it("USED_TOAST / COPIED_TOAST > the drawn words", () => {
    expect(USED_TOAST.title.th).toBe("มีคนใช้แล้ว ลบไม่ได้");
    expect(USED_TOAST.detail.th).toBe("ปิดใช้ในแก้ไขแทน");
    expect(COPIED_TOAST("NEWNOV").th).toBe("คัดลอก NEWNOV แล้ว");
  });
});

describe("the form", () => {
  const filled = {
    ...emptyForm(),
    name: " ลูกค้าใหม่ พ.ย. ",
    amount: "10",
    cap: "300",
    minimum: "1,000",
    code: "newnov",
    maxUses: "100",
  };

  it("emptyForm > percent, 1 use each, no dates, on", () => {
    expect(emptyForm()).toMatchObject({ kind: "percent", perCustomer: "1", startsAt: null });
  });

  it("createBody > percent in basis points, baht in satang, the code tidied", () => {
    expect(createBody(filled)).toEqual({
      name: "ลูกค้าใหม่ พ.ย.",
      code: "NEWNOV",
      type: "percent",
      value: 1000,
      maxDiscountSatang: 30000,
      minSubtotalSatang: 100000,
      maxUses: 100,
      maxUsesPerCustomer: 1,
      startsAt: null,
      endsAt: null,
      // Every product, for everyone — the coupon rules added on 1 Nov 2026 at their defaults.
      appliesTo: "order",
      scope: "all",
      targets: [],
      signupFrom: null,
      signupTo: null,
      validDays: null,
    });
  });

  it("createBody > ฿0 or empty ลดสูงสุด = no cap; ฿0 ซื้อขั้นต่ำ = no minimum; 0 or empty uses = no limit", () => {
    const body = createBody({ ...filled, cap: "0", minimum: "0", maxUses: "0" });
    expect(body).toMatchObject({ maxDiscountSatang: null, minSubtotalSatang: 0, maxUses: null });
    expect(createBody({ ...filled, cap: "", minimum: "", maxUses: "" })).toMatchObject({
      maxDiscountSatang: null,
      minSubtotalSatang: 0,
      maxUses: null,
    });
  });

  it("createBody > ลดเป็นบาท has no ลดสูงสุด", () => {
    expect(createBody({ ...filled, kind: "fixed", amount: "200" })).toMatchObject({
      type: "fixed",
      value: 20000,
      maxDiscountSatang: null,
    });
  });

  it("formOf → patchBody > an edit keeps what it had, leaves the code alone, and sends เปิดใช้", () => {
    const form = formOf(coupon());
    expect(form).toMatchObject({ amount: "10", cap: "300", minimum: "1,000", maxUses: "100" });
    expect(patchBody({ ...form, on: false })).toEqual({
      name: "ลูกค้าใหม่ พ.ย.",
      type: "percent",
      value: 1000,
      maxDiscountSatang: 30000,
      minSubtotalSatang: 100000,
      maxUses: 100,
      maxUsesPerCustomer: 1,
      startsAt: coupon().startsAt,
      endsAt: coupon().endsAt,
      appliesTo: "order",
      scope: "all",
      targets: [],
      signupFrom: null,
      signupTo: null,
      validDays: null,
      status: "disabled",
    });
  });

  it("formOf > no minimum, no cap and no limit open as empty boxes", () => {
    expect(formOf(DRAWN[4]!)).toMatchObject({ minimum: "", cap: "500", maxUses: "" });
    expect(formOf(coupon({ maxDiscountSatang: null, minSubtotalSatang: 0 }))).toMatchObject({
      cap: "",
      minimum: "",
    });
  });
});

describe("formProblems", () => {
  it("given everything filled > then nothing is said", () => {
    const form = { ...emptyForm(), name: "ก", amount: "10", code: "A1" };
    expect(formProblems(form, true)).toEqual({});
  });

  it("given ฿0 in ลดสูงสุด and ซื้อขั้นต่ำ > then that is fine", () => {
    const form = { ...emptyForm(), name: "ก", amount: "10", code: "A1", cap: "0", minimum: "0" };
    expect(formProblems(form, true)).toEqual({});
  });

  it("given only the code missing > then only โค้ด says so", () => {
    const form = { ...emptyForm(), name: "ก", amount: "10", code: "  " };
    expect(formProblems(form, true)).toEqual({
      code: { th: "ยังไม่ได้ใส่โค้ด", en: "No code yet" },
    });
  });

  it("given an empty form > then each missing box says so under it", () => {
    const out = formProblems({ ...emptyForm(), perCustomer: "" }, true);
    expect(Object.keys(out).sort()).toEqual(["amount", "code", "name", "perCustomer"]);
    expect(out.name?.th).toBe("ยังไม่ได้ใส่ชื่อคูปอง");
    expect(out.amount?.th).toBe("ยังไม่ได้ใส่ส่วนลด");
    expect(out.perCustomer?.th).toBe("ยังไม่ได้ใส่จำนวนครั้งต่อคน");
  });

  it("given a 0 discount > then it counts as missing", () => {
    const form = { ...emptyForm(), name: "ก", amount: "0", code: "A1" };
    expect(formProblems(form, true).amount?.th).toBe("ยังไม่ได้ใส่ส่วนลด");
  });

  it("given more than 100% > then ลด says it cannot", () => {
    const form = { ...emptyForm(), name: "ก", amount: "150", code: "A1" };
    expect(formProblems(form, true).amount?.th).toBe("ลดได้ไม่เกิน 100%");
  });

  it("given an edit > then the locked code is not checked", () => {
    const form = { ...emptyForm(), name: "ก", amount: "10", code: "" };
    expect(formProblems(form, false)).toEqual({});
  });

  it("duplicateProblem > มีโค้ด NEWNOV แล้ว", () => {
    expect(duplicateProblem("newnov").th).toBe("มีโค้ด NEWNOV แล้ว");
  });
});

describe("what the boxes keep as typed", () => {
  it("cleanMoney > digits, commas and one dot", () => {
    expect(cleanMoney("1,0a00.5.0")).toBe("1,000.50");
  });

  it("cleanCount > digits only", () => {
    expect(cleanCount("1a2 ")).toBe("12");
  });

  it("cleanCode > capitals, no spaces", () => {
    expect(cleanCode(" new nov")).toBe("NEWNOV");
  });
});
