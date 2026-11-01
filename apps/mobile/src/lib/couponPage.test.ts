import { describe, expect, it } from "vitest";
import {
  COPIED_TOAST,
  USED_TOAST,
  bigValue,
  cardLine,
  conditionLine,
  couponState,
  createBody,
  creatorName,
  discountLine,
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

  it("conditionLine > the minimum first, then the cap, else ไม่มีขั้นต่ำ", () => {
    expect(conditionLine(coupon()).th).toBe("เมื่อซื้อครบ ฿1,000");
    expect(conditionLine(DRAWN[4]!).th).toBe("ลดสูงสุด ฿500");
    expect(conditionLine(DRAWN[2]!).th).toBe("ไม่มีขั้นต่ำ");
  });

  it("cardLine > the state, the start day when waiting, then how many were used", () => {
    expect(cardLine(coupon(), NOW).th).toBe("ใช้ได้อยู่ · ใช้ไป 12 จาก 100");
    expect(cardLine(DRAWN[2]!, NOW).th).toBe("รอเริ่ม · 11 พ.ย. · ใช้ไป 0 จาก 200");
    expect(cardLine(DRAWN[3]!, NOW).th).toBe("ปิดอยู่ · ใช้ไป 12");
    expect(cardLine(DRAWN[4]!, NOW).th).toBe("หมดอายุแล้ว · ใช้ไป 88");
  });
});

describe("the coupon page's words", () => {
  it("discountLine > ลด 10% สูงสุด ฿300, ลด 5% with no cap, ลด ฿80", () => {
    expect(discountLine(coupon()).th).toBe("ลด 10% สูงสุด ฿300");
    expect(discountLine(coupon({ maxDiscountSatang: null })).th).toBe("ลด 10%");
    expect(discountLine(DRAWN[2]!).th).toBe("ลด ฿80");
  });

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
