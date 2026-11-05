import { describe, expect, it } from "vitest";
import {
  bahtText,
  capLine,
  clock,
  costLines,
  createBody,
  editBody,
  emptyForm,
  flashState,
  formOf,
  formProblems,
  formWindow,
  grouped,
  lineOf,
  listLine,
  pickLine,
  offPercent,
  pageStatus,
  pageWindow,
  pickable,
  priceProblem,
  saleLines,
  sections,
  soldLine,
  strip,
  type FlashItem,
  type FlashSale,
} from "./flashPage";
import type { ProductRow } from "./productList";

const at = (m: number, d: number, h = 0, min = 0) => new Date(2026, m - 1, d, h, min).getTime();
const NOW = at(10, 29, 18, 40);

function item(over: Partial<FlashItem> = {}): FlashItem {
  return {
    id: "cp1",
    productVariantId: "v1",
    productName: "คอมเพรสเซอร์ DENSO 10S11C",
    productRef: "DN-447220",
    imageKey: "products/p1/a.jpg",
    basePriceSatang: 345000,
    campaignPriceSatang: 299000,
    stockCap: 10,
    soldCount: 3,
    ...over,
  };
}

function sale(over: Partial<FlashSale> = {}): FlashSale {
  return {
    id: "k1",
    name: "แฟลชเซลปลายเดือน",
    startsAt: at(10, 29),
    endsAt: at(10, 29, 23, 59),
    status: "active",
    createdAt: at(10, 20),
    prices: [item()],
    ...over,
  };
}

const LIVE = sale();
const SOON = sale({
  id: "k2",
  name: "แฟลชเซล 11.11",
  startsAt: at(11, 11),
  endsAt: at(11, 12, 23, 59),
});
const OFF = sale({ id: "k3", status: "disabled", startsAt: at(12, 1), endsAt: at(12, 7, 23, 59) });
const DONE = sale({ id: "k4", startsAt: at(10, 10), endsAt: at(10, 11, 23, 59) });

function product(over: Partial<ProductRow> = {}): ProductRow {
  return {
    id: "p1",
    variantId: "v1",
    productRef: "DN-447220",
    name: "คอมเพรสเซอร์ DENSO 10S11C",
    status: "active",
    imageKey: null,
    shopeeListed: 0,
    updatedAt: null,
    brandName: null,
    typeName: null,
    usageName: null,
    offlinePriceSatang: 345000,
    onlinePriceSatang: 345000,
    b2bPriceSatang: 0,
    itemCostSatang: 240000,
    onlineCommissionBp: 0,
    taxOnCost: 1,
    onHand: 12,
    held: 0,
    fitments: [],
    ...over,
  };
}

describe("flashState", () => {
  it("given each sale > then live, waiting, switched off or ended", () => {
    expect([LIVE, SOON, OFF, DONE].map((s) => flashState(s, NOW))).toEqual([
      "live",
      "waiting",
      "off",
      "ended",
    ]);
  });

  it("given a switched-off sale whose time is over > then ended", () => {
    expect(flashState(sale({ status: "disabled", endsAt: at(10, 1) }), NOW)).toBe("ended");
  });
});

describe("sections", () => {
  it("given every kind > then ตอนนี้, กำลังจะมา (waiting and off, soonest first), จบแล้ว", () => {
    const out = sections([DONE, OFF, SOON, LIVE], NOW);
    expect(out.map((s) => [s.label.th, s.sales.map((x) => x.id)])).toEqual([
      ["ตอนนี้", ["k1"]],
      ["กำลังจะมา", ["k2", "k3"]],
      ["จบแล้ว", ["k4"]],
    ]);
  });

  it("given nothing live > then no ตอนนี้ heading", () => {
    expect(sections([SOON], NOW).map((s) => s.key)).toEqual(["soon"]);
  });
});

describe("clock", () => {
  it("given a live sale under a day left > then จบใน hours and minutes", () => {
    expect(clock(LIVE, NOW)).toEqual({
      side: { th: "จบใน", en: "Ends in" },
      tiles: [
        { value: "05", unit: { th: "ชม.", en: "h" } },
        { value: "19", unit: { th: "นาที", en: "min" } },
      ],
    });
  });

  it("given a sale starting in days > then เริ่มใน days", () => {
    expect(clock(SOON, NOW)).toEqual({
      side: { th: "เริ่มใน", en: "Starts in" },
      tiles: [{ value: "12", unit: { th: "วัน", en: "days" } }],
    });
  });

  it("given a switched-off or ended sale > then no clock", () => {
    expect([clock(OFF, NOW), clock(DONE, NOW)]).toEqual([null, null]);
  });
});

describe("listLine", () => {
  it("given each sale > then its state and when", () => {
    expect([LIVE, SOON, OFF, DONE].map((s) => listLine(s, NOW).th)).toEqual([
      "กำลังลดอยู่ · ถึง 23:59",
      "รอเริ่ม · 11–12 พ.ย.",
      "ปิดอยู่ · 1–7 ธ.ค.",
      "จบแล้ว · 10–11 ต.ค.",
    ]);
  });

  it("given a live sale ending another day > then that day too", () => {
    expect(listLine(sale({ endsAt: at(10, 30, 12, 0) }), NOW).th).toBe(
      "กำลังลดอยู่ · ถึง 30 ต.ค. 12:00",
    );
  });
});

describe("strip", () => {
  const five = sale({
    prices: [1, 2, 3, 4, 5].map((n) => item({ id: `cp${n}`, soldCount: n })),
  });

  it("given five products > then three photos with their -% and +2", () => {
    const out = strip(five, NOW);
    expect(out.photos.map((p) => p.off)).toEqual(["13%", "13%", "13%"]);
    expect(out.more).toBe(2);
  });

  it("given a live or ended sale > then how many sold; waiting > none", () => {
    expect(strip(five, NOW).sold?.th).toBe("ขายแล้ว 15");
    expect(strip(sale({ ...five, startsAt: at(11, 1), endsAt: at(11, 2) }), NOW).sold).toBeNull();
  });
});

describe("numbers", () => {
  it("offPercent > rounds the cut off the normal price", () => {
    expect([offPercent(345000, 299000), offPercent(48000, 39900), offPercent(0, 100)]).toEqual([
      13, 17, 0,
    ]);
  });

  it("soldLine and capLine > with a limit and without", () => {
    expect(soldLine(item()).th).toBe("ขายแล้ว 3 จาก 10");
    expect(soldLine(item({ stockCap: null, soldCount: 0 })).th).toBe("ขายแล้ว 0 · ไม่จำกัด");
    expect([capLine("10").th, capLine("").th]).toEqual(["จำกัด 10 ชิ้น", "ไม่จำกัด"]);
  });
});

describe("the sale page", () => {
  it("pageStatus > a live sale says how long is left; others their state", () => {
    expect(pageStatus(LIVE, NOW).th).toBe("กำลังลดอยู่ · จบใน 5 ชม. 19 นาที");
    expect(pageStatus(SOON, NOW).th).toBe("รอเริ่ม");
  });

  it("pageWindow > one day with its times; whole days as a range (as drawn for 10.10)", () => {
    expect(pageWindow(LIVE.startsAt, LIVE.endsAt).th).toBe("29 ต.ค. 2569 · 00:00 – 23:59");
    expect(pageWindow(DONE.startsAt, DONE.endsAt).th).toBe("10–11 ต.ค. 2569");
  });

  it("pageWindow > several days that start or end mid-day > each day with its time", () => {
    expect(pageWindow(at(11, 11, 10), at(11, 12, 18)).th).toBe("11 พ.ย. 10:00 – 12 พ.ย. 18:00");
  });

  it("formWindow > the form's ช่วงเวลา; none yet > เลือก", () => {
    expect(formWindow(LIVE.startsAt, LIVE.endsAt).th).toBe("29 ต.ค. 00:00 – 23:59");
    expect(formWindow(null, null).th).toBe("เลือก");
  });
});

describe("the form", () => {
  const filled = () => ({
    ...emptyForm(),
    name: " แฟลชเซล 12.12 ",
    startsAt: at(12, 12),
    endsAt: at(12, 12, 23, 59),
    lines: [lineOf(product(), "2,990", "10")],
  });

  it("given nothing filled > then each empty box says so", () => {
    expect(formProblems(emptyForm())).toEqual({
      name: { th: "ยังไม่ได้ใส่ชื่อแคมเปญ", en: "No name yet" },
      when: { th: "ยังไม่ได้เลือกช่วงเวลา", en: "No dates yet" },
      lines: { th: "ยังไม่ได้เลือกสินค้า", en: "No products yet" },
    });
  });

  it("given everything filled > then nothing to say", () => {
    expect(formProblems(filled())).toEqual({});
  });

  it("createBody > the trimmed name, the window, each product in satang with its limit", () => {
    const form = filled();
    form.lines.push(lineOf(product({ variantId: "v2" }), "399", ""));
    expect(createBody(form)).toEqual({
      name: "แฟลชเซล 12.12",
      startsAt: at(12, 12),
      endsAt: at(12, 12, 23, 59),
      prices: [
        { productVariantId: "v1", campaignPriceSatang: 299000, stockCap: 10 },
        { productVariantId: "v2", campaignPriceSatang: 39900, stockCap: null },
      ],
    });
  });

  it("editBody > what was added, changed or binned; an untouched product is not sent", () => {
    const old = sale({
      prices: [
        item({ id: "cp1", productVariantId: "v1" }),
        item({ id: "cp2", productVariantId: "v2" }),
        item({ id: "cp3", productVariantId: "v3" }),
      ],
    });
    const form = formOf(old);
    form.on = false;
    form.lines = [
      { ...form.lines[0]! },
      { ...form.lines[1]!, sale: "2,790", cap: "12" },
      lineOf(product({ variantId: "v9" }), "100", ""),
    ];
    expect(editBody(form, old)).toEqual({
      name: "แฟลชเซลปลายเดือน",
      startsAt: old.startsAt,
      endsAt: old.endsAt,
      status: "disabled",
      prices: {
        add: [{ productVariantId: "v9", campaignPriceSatang: 10000, stockCap: null }],
        update: [{ id: "cp2", campaignPriceSatang: 279000, stockCap: 12 }],
        remove: ["cp3"],
      },
    });
  });
});

describe("the ราคาลด sheet", () => {
  it("costLines > the cost and its VAT", () => {
    expect(costLines(product()).map((l) => [l.label.th, l.text])).toEqual([
      ["ต้นทุนสินค้า", "฿2,400"],
      ["VAT 7%", "+ ฿168"],
    ]);
  });

  it("saleLines > how much off and the profit", () => {
    const out = saleLines(product(), 299000, true);
    expect(out.map((l) => [l.label.th, l.text, l.loss])).toEqual([
      ["ลด", "฿460 · 13%", false],
      ["กำไร", "฿422 · 14%", false],
    ]);
  });

  it("saleLines > under the cost says the loss per piece, in red", () => {
    const out = saleLines(product(), 200000, true);
    expect(out[1]).toEqual({
      label: { th: "ขาดทุน", en: "Loss" },
      text: "฿568 ต่อชิ้น",
      loss: true,
    });
  });

  it("saleLines > someone who may not see cost sees only how much off", () => {
    expect(saleLines(product({ itemCostSatang: 0 }), 299000, false).map((l) => l.label.th)).toEqual(
      ["ลด"],
    );
  });

  it("priceProblem > an empty sale price says so", () => {
    expect(priceProblem("")).toEqual({ th: "ยังไม่ได้ใส่ราคาลด", en: "No sale price yet" });
    expect(priceProblem("1,090")).toBeNull();
  });
});

describe("pickable", () => {
  it("given the catalogue > then only what can be sold, searched by name or code, in Thai order", () => {
    const rows = [
      product({ variantId: "a", name: "วาล์วแอร์ DENSO Vigo", productRef: "DN-447500" }),
      product({ variantId: "b", name: "คอมเพรสเซอร์ DENSO 10S17C", onHand: 0 }),
      product({ variantId: "c", name: "โบลเวอร์ DENSO Altis", productRef: "DN-116340" }),
      product({ variantId: "d", name: "น้ำยาแอร์ R134a", productRef: "R134" }),
    ];
    expect(pickable(rows, "denso").map((r) => r.variantId)).toEqual(["c", "a"]);
    expect(pickable(rows, "116340").map((r) => r.variantId)).toEqual(["c"]);
  });
});

describe("pickLine", () => {
  it("given plenty in stock > then เหลือ and the AirPlus price", () => {
    expect(pickLine(product())).toEqual({
      low: false,
      text: { th: "เหลือ 12 · ฿3,450", en: "12 left · ฿3,450" },
    });
  });

  it("given 3 or fewer > then เหลือน้อย, with the amber dot", () => {
    expect(pickLine(product({ onHand: 2, onlinePriceSatang: 389000 }))).toEqual({
      low: true,
      text: { th: "เหลือน้อย 2 · ฿3,890", en: "Low 2 · ฿3,890" },
    });
  });
});

describe("grouped", () => {
  it("given a price as typed > then its thousands with commas, the satang kept", () => {
    expect([grouped("2000"), grouped("12,345.5"), grouped("399"), grouped("")]).toEqual([
      "2,000",
      "12,345.5",
      "399",
      "",
    ]);
  });
});

describe("bahtText (a price in its box)", () => {
  it("given whole baht > then no decimals", () => {
    expect(bahtText(299000)).toBe("2,990");
  });

  it("given satang > then both satang digits, as its note says", () => {
    expect(bahtText(299050)).toBe("2,990.50");
    expect(bahtText(281410)).toBe("2,814.10");
  });
});
