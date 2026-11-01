import { describe, expect, it } from "vitest";
import {
  createBody,
  emptyForm,
  filedGroups,
  formErrors,
  formOf,
  isLazadaLink,
  patchBody,
  pinLine,
  pinToast,
  pinnedAfterSave,
  priceNote,
  priceText,
  rowState,
  rowSub,
  unfiled,
  type AffiliateItem,
} from "./affiliatePage";

const item = (over: Partial<AffiliateItem> = {}): AffiliateItem => ({
  id: "a1",
  title: "ชุดเกจวัดน้ำยาแอร์ R134a",
  imageKey: null,
  priceText: "฿1,290",
  source: "shopee",
  targetUrl: "https://s.shopee.co.th/9zXa1",
  sortOrder: 0,
  status: "active",
  createdAt: 1,
  categoryId: "c1",
  categoryName: "เกจวัด",
  pinned: 0,
  clicks: 124,
  ...over,
});

describe("filedGroups", () => {
  it("given cards in categories > then one group per category, by name, cards in the API's order", () => {
    const groups = filedGroups([
      item({ id: "x", categoryId: "c2", categoryName: "เครื่องมือช่างแอร์" }),
      item({ id: "a" }),
      item({ id: "b" }),
      item({ id: "u", categoryId: null, categoryName: null }),
    ]);
    expect(groups.map((g) => [g.name, g.items.map((i) => i.id)])).toEqual([
      ["เกจวัด", ["a", "b"]],
      ["เครื่องมือช่างแอร์", ["x"]],
    ]);
  });
});

describe("unfiled", () => {
  it("given cards with no category > then only those, in order", () => {
    const list = [
      item({ id: "a" }),
      item({ id: "u1", categoryId: null }),
      item({ id: "u2", categoryId: null }),
    ];
    expect(unfiled(list).map((i) => i.id)).toEqual(["u1", "u2"]);
  });
});

describe("pinLine", () => {
  it("given up to 6 shown and pinned > then N จาก 6", () => {
    const list = [
      item({ pinned: 1 }),
      item({ pinned: 1 }),
      item({ pinned: 1, status: "disabled" }),
      item(),
    ];
    expect(pinLine(list).th).toBe("2 จาก 6");
  });

  it("given more than 6 > then the shop shows the first 6", () => {
    const list = Array.from({ length: 7 }, (_, i) => item({ id: `p${i}`, pinned: 1 }));
    expect(pinLine(list).th).toBe("7 · แสดง 6 อันแรก");
  });
});

describe("rowSub and rowState", () => {
  it("given a card > then its store and price, then its clicks and whether it is on the home page", () => {
    expect(rowSub(item()).th).toBe("Shopee · ฿1,290");
    expect(rowSub(item({ source: "other", priceText: null })).th).toBe("อื่น ๆ");
    expect(rowState(item({ pinned: 1 }))).toEqual({ kind: "on", clicks: 124, home: true });
    expect(rowState(item())).toEqual({ kind: "on", clicks: 124, home: false });
  });

  it("given a card that is not shown > then it just says ปิดอยู่", () => {
    expect(rowState(item({ status: "disabled", pinned: 1 }))).toEqual({ kind: "off" });
  });
});

describe("formErrors", () => {
  it("given no name and a link without https:// > then both, as drawn", () => {
    const errors = formErrors({ ...emptyForm(), link: "shopee.co.th/9zXa1" });
    expect(errors.name?.th).toBe("ต้องมีชื่อ");
    expect(errors.link?.th).toBe("ลิงก์ต้องขึ้นต้นด้วย https://");
  });

  it("given a name and an https link > then none", () => {
    expect(
      formErrors({ ...emptyForm(), name: "x", link: " https://s.lazada.co.th/s.ZkQ2c " }),
    ).toEqual({});
  });
});

describe("priceText", () => {
  it("given a typed number > then the shop's ฿ way", () => {
    expect(priceText("1290")).toBe("฿1,290");
    expect(priceText(" ฿1,965.50 ")).toBe("฿1,965.50");
  });

  it("given other words or nothing > then as typed, or no price", () => {
    expect(priceText("เริ่ม ฿990")).toBe("เริ่ม ฿990");
    expect(priceText("  ")).toBeNull();
  });
});

describe("createBody and patchBody", () => {
  it("given a new card > then it goes after the last one, shown, with its pin", () => {
    const form = {
      ...emptyForm(),
      name: " ปั๊ม ",
      link: "https://x.co/a",
      price: "690",
      pinned: true,
    };
    expect(createBody(form, [item({ sortOrder: 4 })])).toEqual({
      title: "ปั๊ม",
      targetUrl: "https://x.co/a",
      priceText: "฿690",
      source: "shopee",
      sortOrder: 5,
      categoryId: null,
      pinned: true,
    });
  });

  it("given an edit > then every field, with แสดง as the card's status", () => {
    const form = { ...formOf(item()), shown: false, price: "" };
    expect(patchBody(form)).toEqual({
      title: "ชุดเกจวัดน้ำยาแอร์ R134a",
      targetUrl: "https://s.shopee.co.th/9zXa1",
      priceText: null,
      source: "shopee",
      categoryId: "c1",
      pinned: false,
      status: "disabled",
    });
  });
});

describe("pinnedAfterSave and pinToast", () => {
  it("given a 7th shown card pinned > then the toast says the home page shows 6", () => {
    const others = Array.from({ length: 6 }, (_, i) => item({ id: `p${i}`, pinned: 1 }));
    const n = pinnedAfterSave(others, { ...emptyForm(), pinned: true }, null);
    expect(n).toBe(7);
    expect(pinToast(n)?.title.th).toBe("ปักหมุดแล้ว 7 รายการ");
    expect(pinToast(n)?.detail.th).toBe("หน้าแรกแสดง 6 อันแรก · ถอดหมุดอันที่ไม่ใช้ออก");
  });

  it("given the edited card itself was pinned > then it is not counted twice", () => {
    const list = [item({ id: "me", pinned: 1 }), item({ id: "b", pinned: 1 })];
    expect(pinnedAfterSave(list, { ...formOf(list[0]!) }, "me")).toBe(2);
    expect(pinToast(6)).toBeNull();
  });
});

describe("isLazadaLink and priceNote", () => {
  it("given a Lazada Thailand link > then the server is asked; anything else, not", () => {
    expect(isLazadaLink("https://s.lazada.co.th/s.ZkQ2c")).toBe(true);
    expect(isLazadaLink("https://s.shopee.co.th/9zXa1")).toBe(false);
    expect(isLazadaLink("https://lazada.co.th.evil.example/x")).toBe(false);
    expect(isLazadaLink("lazada")).toBe(false);
  });

  it("given each lookup state > then the drawn grey line, none when idle", () => {
    expect(priceNote("looking")?.th).toBe("กำลังดูราคาจาก Lazada…");
    expect(priceNote("found")?.th).toBe("ราคาต่ำสุดจาก Lazada · แก้ได้");
    expect(priceNote("failed")?.th).toBe("ดูราคาจากลิงก์ไม่ได้ · พิมพ์เอง");
    expect(priceNote("idle")).toBeNull();
  });
});
