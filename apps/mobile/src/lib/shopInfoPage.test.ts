import { describe, expect, it } from "vitest";
import {
  accountLine,
  accountProblems,
  blankDraft,
  changedFields,
  copiedToast,
  draftOf,
  removeAccount,
  saveAccount,
  shownIn,
  textDraft,
  titleIn,
  type ShopInfo,
} from "./shopInfoPage";

const info = (over: Partial<ShopInfo> = {}): ShopInfo => ({
  name: "Den Air Service (Surin)",
  nameEn: "",
  address: "123/4 ถ.ธนสาร ต.ในเมือง อ.เมือง จ.สุรินทร์ 32000",
  addressEn: "123/4 Thanasan Rd, Nai Mueang, Mueang, Surin 32000",
  quoteNote: "ราคานี้ยืนได้ 7 วัน",
  quoteNoteEn: "",
  qrHeadline: "แอดไลน์ @811gvdun",
  qrHeadlineEn: "Add LINE @811gvdun",
  qrSubtitle: "ทักได้ตลอด",
  qrSubtitleEn: "",
  paymentMethods: "",
  lineUrl: "lin.ee/tltIFtI",
  shipFromPhone: "",
  shipFromPostcode: "",
  phone: "08x-xxx-4421",
  linktreeUrl: "",
  logoKey: null,
  qrKey: null,
  ...over,
});

const shop = { id: "a1", position: "เจ้าของ", label: "ร้าน", promptpayId: "0812344421" };
const mom = { id: "a2", position: "", label: "แม่", promptpayId: "0812347710" };

describe("titleIn (the shop card and the top of the shop page)", () => {
  it("given English is chosen but the shop has no English name > then it shows the Thai one", () => {
    expect(titleIn(info(), "name", "en")).toBe("Den Air Service (Surin)");
  });

  it("given English is chosen > then the address is the English one", () => {
    expect(titleIn(info(), "address", "en")).toBe(
      "123/4 Thanasan Rd, Nai Mueang, Mueang, Surin 32000",
    );
  });

  it("given Thai is chosen > then the address is the Thai one", () => {
    expect(titleIn(info(), "address", "th")).toBe(
      "123/4 ถ.ธนสาร ต.ในเมือง อ.เมือง จ.สุรินทร์ 32000",
    );
  });
});

describe("shownIn (ตั้งค่าบิล on the page)", () => {
  it("given English is chosen > then หัวข้อใต้ QR shows the English text", () => {
    expect(shownIn(info(), "qrHeadline", "en")).toBe("Add LINE @811gvdun");
  });

  it("given no English text yet > then the row shows a dash, not the Thai", () => {
    expect(shownIn(info(), "qrSubtitle", "en")).toBe("—");
  });
});

describe("accountLine (รับเงิน rows)", () => {
  it("given the default account > then it says พร้อมเพย์ and ค่าเริ่มต้น", () => {
    expect(accountLine(shop, true)).toEqual({
      th: "พร้อมเพย์ 0812344421 · ค่าเริ่มต้น",
      en: "PromptPay 0812344421 · Default",
    });
  });

  it("given another account > then it is the PromptPay number only", () => {
    expect(accountLine(mom, false).th).toBe("พร้อมเพย์ 0812347710");
  });
});

describe("accountProblems (the account sheet's lines under empty boxes)", () => {
  it("given no name and no PromptPay > then both boxes say what is missing", () => {
    expect(accountProblems(blankDraft([]))).toEqual({
      label: { th: "ยังไม่ได้ใส่ชื่อ", en: "Name is empty" },
      promptpayId: { th: "ยังไม่ได้ใส่พร้อมเพย์", en: "PromptPay is empty" },
    });
  });

  it("given a PromptPay that no QR can use > then it says what one looks like", () => {
    const draft = { ...blankDraft([]), label: "แม่", promptpayId: "12345" };
    expect(accountProblems(draft).promptpayId?.th).toBe(
      "ใส่เบอร์มือถือ 10 หลัก เลขบัตร 13 หลัก หรือ e-wallet 15 หลัก",
    );
  });

  it("given a name and a phone number > then there is nothing to say", () => {
    expect(
      accountProblems({ ...blankDraft([]), label: "แม่", promptpayId: "081-234-7710" }),
    ).toEqual({});
  });
});

describe("blankDraft / draftOf", () => {
  it("given the shop has no account yet > then the first one is the default", () => {
    expect(blankDraft([]).isDefault).toBe(true);
  });

  it("given accounts already > then a new one is not the default", () => {
    expect(blankDraft([shop]).isDefault).toBe(false);
  });

  it("given an account with no flag but first in the list > then its sheet shows it as default", () => {
    expect(draftOf(shop, [shop, mom]).isDefault).toBe(true);
    expect(draftOf(mom, [shop, mom]).isDefault).toBe(false);
  });
});

describe("saveAccount / removeAccount", () => {
  it("given a new account > then it goes at the end, trimmed, with the id given", () => {
    const draft = { ...blankDraft([shop]), label: " แม่ ", promptpayId: " 0812347710 " };
    const out = saveAccount([shop], draft, "new1");
    expect(out.map((m) => m.id)).toEqual(["a1", "new1"]);
    expect(out[1]).toMatchObject({ label: "แม่", promptpayId: "0812347710" });
  });

  it("given an account made the default > then no other account stays the default", () => {
    const out = saveAccount(
      [{ ...shop, isDefault: true }, mom],
      { ...draftOf(mom, []), isDefault: true },
      "x",
    );
    expect(out.filter((m) => m.isDefault).map((m) => m.id)).toEqual(["a2"]);
  });

  it("given an edited account > then it keeps its place and id", () => {
    const out = saveAccount([shop, mom], { ...draftOf(shop, [shop, mom]), label: "หน้าร้าน" }, "x");
    expect(out.map((m) => [m.id, m.label])).toEqual([
      ["a1", "หน้าร้าน"],
      ["a2", "แม่"],
    ]);
  });

  it("given ลบ > then only that account is gone", () => {
    expect(removeAccount([shop, mom], "a1").map((m) => m.id)).toEqual(["a2"]);
  });
});

describe("changedFields (what บันทึก sends)", () => {
  it("given nothing typed > then nothing is sent", () => {
    expect(changedFields(info(), textDraft(info()))).toEqual({});
  });

  it("given the English name and Linktree typed > then only those two are sent", () => {
    const draft = { ...textDraft(info()), nameEn: "Den Air Service", linktreeUrl: "linktr.ee/den" };
    expect(changedFields(info(), draft)).toEqual({
      nameEn: "Den Air Service",
      linktreeUrl: "linktr.ee/den",
    });
  });
});

describe("copiedToast", () => {
  it("given the phone was copied > then it says so by name", () => {
    expect(copiedToast({ th: "เบอร์โทร", en: "phone number" })).toEqual({
      th: "คัดลอกเบอร์โทรแล้ว",
      en: "Copied the phone number",
    });
  });

  it("given a name that ends in English (LINE OA) > then a space comes before แล้ว", () => {
    expect(copiedToast({ th: "ลิงก์ LINE OA", en: "LINE OA link" }).th).toBe(
      "คัดลอกลิงก์ LINE OA แล้ว",
    );
  });
});
