import { describe, it, expect } from "vitest";
import {
  PHONE_PAY_OPTIONS,
  addressWho,
  addressWhere,
  shippingRow,
  couponValue,
  discountRow,
  stockLine,
  buildCheckoutRequest,
  postcodeFill,
} from "./checkoutPhone";
import { generateRef, IDEMPOTENCY_REF_PATTERN } from "./checkoutApi";
import type { CartLine } from "./cart";

/** Board 4 · ชำระเงิน (4.4–4.11), drawn 5 Nov 2026, Apple text 14 Nov; owner: "Yes, build board 4". */
const bangkok = {
  recipientName: "สมชาย ใจดี",
  phone: "0812344821",
  addressLine1: "99/12 ถ.บางนา-ตราด",
  subdistrict: "บางนาเหนือ",
  district: "บางนา",
  province: "กรุงเทพมหานคร",
  postalCode: "10260",
};
const korat = {
  ...bangkok,
  phone: "0895551234",
  addressLine1: "45/6 ถ.มิตรภาพ",
  subdistrict: "ในเมือง",
  district: "เมืองนครราชสีมา",
  province: "นครราชสีมา",
  postalCode: "30000",
};

describe("payment choices (4.5)", () => {
  it("PHONE_PAY_OPTIONS > the three drawn rows, PromptPay first", () => {
    expect(PHONE_PAY_OPTIONS).toEqual([
      { id: "promptpay", title: "PromptPay", detail: "สแกน QR จ่ายได้ทันที" },
      { id: "transfer", title: "โอนเข้าบัญชีร้าน", detail: "บัญชีนิติบุคคล Den Air Service" },
      { id: "cod", title: "เก็บเงินปลายทาง", detail: "จ่ายกับพนักงานส่ง ไม่มีค่าธรรมเนียมเพิ่ม" },
    ]);
  });
});

describe("address lines (4.5 · 4.6)", () => {
  it("addressWho > name and a 10-digit phone > สมชาย ใจดี · 081-234-4821", () => {
    expect(addressWho(bangkok)).toBe("สมชาย ใจดี · 081-234-4821");
  });
  it("addressWho > a phone that is not 10 digits > shown as saved", () => {
    expect(addressWho({ ...bangkok, phone: "+66812344821" })).toBe("สมชาย ใจดี · +66812344821");
  });
  it("addressWhere > Bangkok > แขวง / เขต", () => {
    expect(addressWhere(bangkok)).toBe(
      "99/12 ถ.บางนา-ตราด แขวงบางนาเหนือ เขตบางนา กรุงเทพมหานคร 10260",
    );
  });
  it("addressWhere > another province > ต. / อ.", () => {
    expect(addressWhere(korat)).toBe("45/6 ถ.มิตรภาพ ต.ในเมือง อ.เมืองนครราชสีมา นครราชสีมา 30000");
  });
  it("addressWhere > names saved with their word already > not doubled", () => {
    expect(addressWhere({ ...bangkok, subdistrict: "แขวงบางนาเหนือ", district: "เขตบางนา" })).toBe(
      "99/12 ถ.บางนา-ตราด แขวงบางนาเหนือ เขตบางนา กรุงเทพมหานคร 10260",
    );
  });
});

describe("summary rows", () => {
  it("shippingRow > no postcode yet (4.4) > กรอกที่อยู่เพื่อคำนวณ", () => {
    expect(shippingRow(null)).toEqual({ label: "ค่าจัดส่ง", value: "กรอกที่อยู่เพื่อคำนวณ" });
  });
  it("shippingRow > a quote > ค่าจัดส่ง · Flash Express ฿65", () => {
    expect(shippingRow({ satang: 6500, isRemote: false })).toEqual({
      label: "ค่าจัดส่ง · Flash Express",
      value: "฿65",
    });
  });
  it("shippingRow > a remote area > says so beside the fee", () => {
    expect(shippingRow({ satang: 12500, isRemote: true })).toEqual({
      label: "ค่าจัดส่ง · Flash Express",
      value: "฿125 (พื้นที่ห่างไกล)",
    });
  });
  it("couponValue > none > ใส่โค้ด · applied > its code", () => {
    expect(couponValue(null)).toBe("ใส่โค้ด");
    expect(couponValue("NEWNOV")).toBe("NEWNOV");
  });
  it("discountRow > NEWNOV ฿100 off (4.10) > คูปอง NEWNOV −฿100", () => {
    expect(discountRow("NEWNOV", 10000)).toEqual({ label: "คูปอง NEWNOV", value: "−฿100" });
  });
});

describe("stockLine (4.11)", () => {
  it("stockLine > the shop says not enough stock > its words + what to do, under the items", () => {
    expect(stockLine("สินค้าไม่พอ: ตู้แอร์ คอยล์เย็น Toyota Vigo (เหลือ 0 ชิ้น)")).toBe(
      "สินค้าไม่พอ: ตู้แอร์ คอยล์เย็น Toyota Vigo (เหลือ 0 ชิ้น) · ลบออกจากตะกร้าแล้วสั่งใหม่",
    );
  });
  it("stockLine > any other error > not a stock line", () => {
    expect(stockLine("เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง")).toBeNull();
    expect(stockLine(null)).toBeNull();
  });
});

describe("buildCheckoutRequest", () => {
  const lines: CartLine[] = [
    {
      variantId: "v1",
      productId: "p1",
      name: "x",
      productRef: "x",
      priceSatang: 165000,
      imageKey: null,
      qty: 1,
    },
  ];
  const base = { ref: "AP-7KQ2M9XT", payment: "cod" as const, lines, coupon: null, name: null };
  it("buildCheckoutRequest > a saved address > its id, the lines with the price seen", () => {
    expect(buildCheckoutRequest({ ...base, address: { kind: "saved", id: "a1" } })).toEqual({
      idempotencyRef: "AP-7KQ2M9XT",
      paymentMethod: "cod",
      lines: [{ variantId: "v1", qty: 1, expectedPriceSatang: 165000 }],
      addressId: "a1",
    });
  });
  it("buildCheckoutRequest > a new address, a coupon and a first-time name > all sent", () => {
    expect(
      buildCheckoutRequest({
        ...base,
        name: "สมชาย ใจดี",
        coupon: "NEWNOV",
        address: { kind: "new", address: bangkok },
      }),
    ).toEqual({
      idempotencyRef: "AP-7KQ2M9XT",
      paymentMethod: "cod",
      lines: [{ variantId: "v1", qty: 1, expectedPriceSatang: 165000 }],
      name: "สมชาย ใจดี",
      couponCode: "NEWNOV",
      address: bangkok,
    });
  });
});

describe("postcodeFill (4.7 · the postcode fills จังหวัด, อำเภอ, ตำบล)", () => {
  const bangna = {
    province: "กรุงเทพมหานคร",
    amphoe: "คลองเตย",
    tambons: [
      { tambon: "พระโขนง", amphoe: "คลองเตย", province: "กรุงเทพมหานคร" },
      { tambon: "บางนาเหนือ", amphoe: "บางนา", province: "กรุงเทพมหานคร" },
    ],
  };
  const empty = { ...bangkok, subdistrict: "", district: "", province: "", postalCode: "10260" };
  it("postcodeFill > a first postcode > fills จังหวัด + อำเภอ, ตำบล left to pick", () => {
    expect(postcodeFill(empty, bangna, "")).toEqual({
      province: "กรุงเทพมหานคร",
      district: "คลองเตย",
      subdistrict: "",
    });
  });
  it("postcodeFill > a new postcode in the same province > fills again (old เขต/แขวง gone)", () => {
    const picked = { ...bangkok, postalCode: "10110" };
    expect(postcodeFill(picked, { ...bangna, amphoe: "วัฒนา" }, "10260")).toEqual({
      province: "กรุงเทพมหานคร",
      district: "วัฒนา",
      subdistrict: "",
    });
  });
  it("postcodeFill > the sheet opened again on the same postcode > keeps what was picked", () => {
    expect(postcodeFill(bangkok, bangna, "10260")).toBeNull();
  });
  it("postcodeFill > one ตำบล only > picks it", () => {
    const one = { ...bangna, tambons: [bangna.tambons[1]!] };
    expect(postcodeFill(empty, one, "")).toEqual({
      province: "กรุงเทพมหานคร",
      district: "บางนา",
      subdistrict: "บางนาเหนือ",
    });
  });
  it("postcodeFill > an unknown postcode > nothing", () => {
    expect(postcodeFill(empty, null, "")).toBeNull();
  });
});

describe("generateRef", () => {
  it("generateRef > one per checkout visit > matches the server's idempotency pattern", () => {
    expect(generateRef()).toMatch(IDEMPOTENCY_REF_PATTERN);
  });
});
