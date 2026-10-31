import { describe, expect, it } from "vitest";
import {
  NO_FILTERS,
  carModelOptions,
  carOptions,
  countBy,
  listSubtitle,
  matchesSearch,
  stockLevel,
  stockLine,
  tabCounts,
  visibleRows,
  yearRange,
  type ProductRow,
} from "./productList";

function row(over: Partial<ProductRow> & { id: string }): ProductRow {
  return {
    variantId: `v-${over.id}`,
    productRef: over.id.toUpperCase(),
    name: `Part ${over.id}`,
    status: "active",
    imageKey: null,
    shopeeListed: 0,
    updatedAt: null,
    brandName: null,
    typeName: null,
    usageName: null,
    offlinePriceSatang: 0,
    onlinePriceSatang: 0,
    b2bPriceSatang: 0,
    itemCostSatang: 0,
    onlineCommissionBp: 0,
    taxOnCost: 0,
    onHand: 10,
    held: 0,
    fitments: [],
    ...over,
  };
}

const VIGO = { carBrand: "Toyota", carModel: "Vigo", yearFrom: 2005, yearTo: 2014 };
const ALTIS = { carBrand: "Toyota", carModel: "Altis", yearFrom: 2008, yearTo: 2013 };
const CITY = { carBrand: "Honda", carModel: "City", yearFrom: 2014, yearTo: null };

const ROWS: ProductRow[] = [
  row({
    id: "a",
    name: "คอมเพรสเซอร์ DENSO 10S11C",
    productRef: "DN-447220",
    brandName: "DENSO",
    usageName: "A/C",
    typeName: "Compressor",
    onHand: 4,
    shopeeListed: 1,
    offlinePriceSatang: 345000,
    updatedAt: 300,
    fitments: [VIGO],
  }),
  row({
    id: "b",
    name: "โบลเวอร์ DENSO Altis",
    productRef: "DN-116340",
    brandName: "DENSO",
    usageName: "A/C",
    typeName: "Blower",
    onHand: 1,
    offlinePriceSatang: 129000,
    updatedAt: 500,
    fitments: [ALTIS, VIGO],
  }),
  row({
    id: "c",
    name: "วาล์วแอร์ Sanden",
    productRef: "SD-7H15",
    brandName: "Sanden",
    usageName: "A/C",
    typeName: "Valve",
    onHand: 0,
    status: "paused",
    offlinePriceSatang: 90000,
    updatedAt: 100,
    fitments: [CITY],
  }),
  row({
    id: "d",
    name: "หลอดไฟหน้า",
    productRef: "LT-1",
    usageName: "Electric",
    onHand: 30,
    status: "draft",
    offlinePriceSatang: 50000,
    updatedAt: null,
  }),
];

describe("stockLevel", () => {
  it("given 0 or less for sale > then out", () => {
    expect(stockLevel(0)).toBe("out");
    expect(stockLevel(-2)).toBe("out");
  });
  it("given 1 to 3 > then low (the shop's one threshold, as on the old back office)", () => {
    expect(stockLevel(1)).toBe("low");
    expect(stockLevel(3)).toBe("low");
  });
  it("given more than 3 > then ok", () => {
    expect(stockLevel(4)).toBe("ok");
  });
});

describe("tabCounts", () => {
  it("given the whole catalogue > then each tab counts its own rows", () => {
    expect(tabCounts(ROWS)).toEqual({ all: 4, airplus: 2, notLive: 2, low: 1, out: 1 });
  });
});

describe("matchesSearch", () => {
  it("given part of the name > then it matches", () => {
    expect(matchesSearch(ROWS[0]!, "denso 10s")).toBe(true);
  });
  it("given part of the code > then it matches", () => {
    expect(matchesSearch(ROWS[0]!, "447220")).toBe(true);
  });
  it("given one letter off > then no match", () => {
    expect(matchesSearch(ROWS[0]!, "10S12C")).toBe(false);
  });
  it("given an empty search > then everything matches", () => {
    expect(matchesSearch(ROWS[0]!, "   ")).toBe(true);
  });
});

describe("visibleRows", () => {
  const base = { tab: "all" as const, q: "", filters: NO_FILTERS, sort: "updated" as const };

  it("given no choices > then every row, last edited first, never-edited last", () => {
    expect(visibleRows(ROWS, base).map((r) => r.id)).toEqual(["b", "a", "c", "d"]);
  });
  it("given the low tab > then only rows with 1 to 3 for sale", () => {
    expect(visibleRows(ROWS, { ...base, tab: "low" }).map((r) => r.id)).toEqual(["b"]);
  });
  it("given the not-live tab > then draft and paused rows", () => {
    expect(visibleRows(ROWS, { ...base, tab: "notLive" }).map((r) => r.id)).toEqual(["c", "d"]);
  });
  it("given a part brand > then only that brand", () => {
    const filters = { ...NO_FILTERS, brand: "Sanden" };
    expect(visibleRows(ROWS, { ...base, filters }).map((r) => r.id)).toEqual(["c"]);
  });
  it("given a car system and a part name > then both must match", () => {
    const filters = { ...NO_FILTERS, usage: "A/C", type: "Blower" };
    expect(visibleRows(ROWS, { ...base, filters }).map((r) => r.id)).toEqual(["b"]);
  });
  it("given a car > then rows that fit that brand, model and years", () => {
    const filters = { ...NO_FILTERS, car: VIGO };
    expect(visibleRows(ROWS, { ...base, filters }).map((r) => r.id)).toEqual(["b", "a"]);
  });
  it("given a search and a filter > then both apply", () => {
    const filters = { ...NO_FILTERS, brand: "DENSO" };
    expect(visibleRows(ROWS, { ...base, filters, q: "altis" }).map((r) => r.id)).toEqual(["b"]);
  });
  it("given name order > then ก–ฮ", () => {
    expect(visibleRows(ROWS, { ...base, sort: "name" }).map((r) => r.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });
  it("given price order > then the เด่นแอร์ price low to high", () => {
    expect(visibleRows(ROWS, { ...base, sort: "price" }).map((r) => r.id)).toEqual([
      "d",
      "c",
      "b",
      "a",
    ]);
  });
  it("given low-first order > then fewest for sale first", () => {
    expect(visibleRows(ROWS, { ...base, sort: "low" }).map((r) => r.id)).toEqual([
      "c",
      "b",
      "a",
      "d",
    ]);
  });
});

describe("listSubtitle", () => {
  it("given nothing typed or picked > then the total and how many can be sold", () => {
    expect(listSubtitle(ROWS, 4, "", NO_FILTERS)).toEqual({
      th: "4 รายการ · ขายได้ 3",
      en: "4 products · 3 for sale",
    });
  });
  it("given a search > then how many were found", () => {
    expect(listSubtitle(ROWS, 2, "denso", NO_FILTERS)).toEqual({
      th: "พบ 2 รายการ",
      en: "2 found",
    });
  });
  it("given a filter > then how many of all", () => {
    expect(listSubtitle(ROWS, 2, "", { ...NO_FILTERS, brand: "DENSO" })).toEqual({
      th: "พบ 2 รายการ จาก 4",
      en: "2 of 4",
    });
  });
});

describe("stockLine", () => {
  it("given plenty on AirPlus and Shopee > then the count and both channels, no dot", () => {
    expect(stockLine(ROWS[0]!)).toEqual({
      level: "ok",
      text: { th: "เหลือ 4 · AirPlus · Shopee", en: "4 left · AirPlus · Shopee" },
    });
  });
  it("given 1 left > then เหลือน้อย", () => {
    expect(stockLine(ROWS[1]!)).toEqual({
      level: "low",
      text: { th: "เหลือน้อย 1 · AirPlus", en: "Low 1 · AirPlus" },
    });
  });
  it("given none and not live > then หมด and no channel", () => {
    expect(stockLine(ROWS[2]!)).toEqual({ level: "out", text: { th: "หมด", en: "Sold out" } });
  });
});

describe("countBy", () => {
  it("given rows > then each value with how many rows have it, most first, blanks left out", () => {
    expect(countBy(ROWS, (r) => r.brandName)).toEqual([
      { value: "DENSO", count: 2 },
      { value: "Sanden", count: 1 },
    ]);
  });
});

describe("carOptions / carModelOptions", () => {
  it("given rows > then car brands with how many rows fit them", () => {
    expect(carOptions(ROWS)).toEqual([
      { value: "Toyota", count: 2 },
      { value: "Honda", count: 1 },
    ]);
  });
  it("given a brand > then its models with years, each counted once per row", () => {
    expect(carModelOptions(ROWS, "Toyota")).toEqual([
      { car: VIGO, count: 2 },
      { car: ALTIS, count: 1 },
    ]);
  });
});

describe("yearRange", () => {
  it("given both years > then a dash between", () => {
    expect(yearRange(2005, 2014)).toBe("2005–2014");
  });
  it("given a start only > then it runs on", () => {
    expect(yearRange(2014, null)).toBe("2014–");
  });
  it("given no years > then empty", () => {
    expect(yearRange(null, null)).toBe("");
  });
});
