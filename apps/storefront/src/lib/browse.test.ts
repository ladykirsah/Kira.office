import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  browseHref,
  byMostStocked,
  carOnFrom,
  filterApply,
  filterByCar,
  parseSort,
  resultLine,
  sortTabs,
} from "./browse";

describe("parseSort", () => {
  it("given no sort > then เกี่ยวข้อง (relevant)", () => {
    expect(parseSort(undefined)).toBe("relevant");
  });
  it("given a known sort > then that sort", () => {
    expect(parseSort("best")).toBe("best");
    expect(parseSort("new")).toBe("new");
    expect(parseSort("price_asc")).toBe("price_asc");
    expect(parseSort("price_desc")).toBe("price_desc");
  });
  it("given an unknown value from the url > then relevant, never a crash", () => {
    expect(parseSort("cheapest; DROP")).toBe("relevant");
  });
});

describe("sortTabs (board 2 · 2.2 sort bar)", () => {
  it("given relevant > then the four drawn tabs with เกี่ยวข้อง on", () => {
    const tabs = sortTabs("relevant");
    expect(tabs.map((t) => t.label)).toEqual(["เกี่ยวข้อง", "ขายดี", "ใหม่", "ราคา"]);
    expect(tabs.map((t) => t.on)).toEqual([true, false, false, false]);
  });
  it("given price low→high > then ราคา is on and tapping it goes high→low", () => {
    const price = sortTabs("price_asc")[3];
    expect(price.on).toBe(true);
    expect(price.sort).toBe("price_desc");
  });
  it("given price high→low > then tapping ราคา goes back to low→high", () => {
    expect(sortTabs("price_desc")[3].sort).toBe("price_asc");
  });
  it("given another tab on > then ราคา starts low→high", () => {
    expect(sortTabs("best")[3]).toMatchObject({ on: false, sort: "price_asc" });
  });
});

describe("activeFilterCount (the red number on ตัวกรอง)", () => {
  it("given nothing chosen > then 0 (no badge)", () => {
    expect(activeFilterCount({ carOn: false })).toBe(0);
  });
  it("given only my car filtering > then 1", () => {
    expect(activeFilterCount({ carOn: true })).toBe(1);
  });
  it("given car, category and brand > then 3", () => {
    expect(activeFilterCount({ carOn: true, type: "t1", brand: "b1" })).toBe(3);
  });
  it("given the car filter off but a category > then 1", () => {
    expect(activeFilterCount({ carOn: false, type: "t1" })).toBe(1);
  });
});

describe("carOnFrom", () => {
  it("given no car param > then my car filters (on by default)", () => {
    expect(carOnFrom(undefined)).toBe(true);
  });
  it("given car=off (the × was tapped) > then off", () => {
    expect(carOnFrom("off")).toBe(false);
  });
});

describe("filterByCar", () => {
  const items = [{ variantId: "a" }, { variantId: "b" }, { variantId: "c" }];
  it("given the car filter off > then every item", () => {
    expect(filterByCar(items, new Set(["b"]), false)).toEqual(items);
  });
  it("given the car filter on > then only the parts that fit, in the same order", () => {
    expect(filterByCar(items, new Set(["c", "a"]), true)).toEqual([
      { variantId: "a" },
      { variantId: "c" },
    ]);
  });
  it("given nothing fits > then an empty list", () => {
    expect(filterByCar(items, new Set(), true)).toEqual([]);
  });
});

describe("resultLine (the grey count line)", () => {
  it("given my car filtering > then 'ใส่ได้กับรถของคุณ 2 จาก 7 รายการ'", () => {
    expect(resultLine({ shown: 2, total: 7, carFiltered: true })).toBe(
      "ใส่ได้กับรถของคุณ 2 จาก 7 รายการ",
    );
  });
  it("given no car filter > then 'พบ 7 รายการ'", () => {
    expect(resultLine({ shown: 7, total: 7, carFiltered: false })).toBe("พบ 7 รายการ");
  });
});

describe("browseHref", () => {
  it("given no params > then plain /products", () => {
    expect(browseHref({}, {})).toBe("/products");
  });
  it("given a search and a new sort > then both, Thai encoded", () => {
    expect(browseHref({ q: "ตู้แอร์" }, { sort: "best" })).toBe(
      `/products?q=${encodeURIComponent("ตู้แอร์")}&sort=best`,
    );
  });
  it("given an override of undefined or empty > then that key is dropped", () => {
    expect(browseHref({ q: "vigo", type: "t1", car: "off" }, { type: undefined, car: "" })).toBe(
      "/products?q=vigo",
    );
  });
});

describe("byMostStocked", () => {
  it("given categories > then most products first, ties keep the shop's order", () => {
    const rows = [
      { id: "filter", productCount: 0 },
      { id: "oil", productCount: 2 },
      { id: "fan", productCount: 0 },
      { id: "evap", productCount: 7 },
    ];
    expect(byMostStocked(rows).map((r) => r.id)).toEqual(["evap", "oil", "filter", "fan"]);
  });
  it("given rows > then the original list is not changed", () => {
    const rows = [
      { id: "a", productCount: 0 },
      { id: "b", productCount: 1 },
    ];
    byMostStocked(rows);
    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("filterApply", () => {
  const cat = {
    type: "pt-evaporator",
    ctx: "cat",
    carBrand: "Isuzu",
    carModel: "D-Max",
    year: "2010",
  };

  it("given a category page with a car-brand chip > when another category is picked > then the old car chip is dropped", () => {
    expect(filterApply("cat", cat, { carOn: false, type: "pt-oil" })).toEqual({
      type: "pt-oil",
      brand: undefined,
      car: "off",
      ctx: "cat",
      carBrand: undefined,
      carModel: undefined,
      year: undefined,
    });
  });
  it("given a category page with a car-brand chip > when the same category stays > then the car chip stays", () => {
    const over = filterApply("cat", cat, {
      carOn: false,
      type: "pt-evaporator",
      brand: "br-denso",
    });
    expect(browseHref(cat, over)).toBe(
      "/products?type=pt-evaporator&ctx=cat&carBrand=Isuzu&carModel=D-Max&year=2010&brand=br-denso&car=off",
    );
  });
  it("given a category page > when หมวดหมู่ goes back to ทั้งหมด > then it leaves the category page", () => {
    const over = filterApply("cat", cat, { carOn: true });
    expect(browseHref(cat, over)).toBe("/products");
  });
  it("given a car-brand page > when a category is picked > then the car brand (the page itself) stays", () => {
    const brandPage = { carBrand: "Toyota", ctx: "brand" };
    const over = filterApply("brand", brandPage, { carOn: true, type: "pt-oil" });
    expect(browseHref(brandPage, over)).toBe("/products?carBrand=Toyota&ctx=brand&type=pt-oil");
  });
  it("given search results with my car off > when my car is picked again > then car=off goes away", () => {
    const search = { q: "vigo", car: "off" };
    expect(browseHref(search, filterApply("search", search, { carOn: true }))).toBe(
      "/products?q=vigo",
    );
  });
});
