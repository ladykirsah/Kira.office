import { describe, it, expect } from "vitest";
import type { MyCar } from "./myCar";
import {
  carCard,
  fitRows,
  fitmentName,
  fitmentYears,
  infoRows,
  salePercent,
  specRows,
} from "./productPage";

/**
 * The phone product page (AirPlus board 3, owner 14 Nov 2026): ใส่ได้กับรถ open with every model, the
 * car card for รถของฉัน, รายละเอียดสินค้า above one card of การจัดส่ง · รับประกัน · เงื่อนไข · คืน·เคลม.
 * Real fitments of TG447610-08504W and DI446610-19504W.
 */

const VIGO_FITS = [
  { carBrand: "Toyota", carModel: "Vigo", yearFrom: 2004, yearTo: 2015 },
  { carBrand: "Toyota", carModel: "Fortuner Gen 1", yearFrom: 2005, yearTo: 2014 },
  { carBrand: "Toyota", carModel: "Altis", yearFrom: 2008, yearTo: 2013 },
];
const DMAX_FITS = [
  { carBrand: "Isuzu", carModel: "D-Max All New", yearFrom: 2011, yearTo: 2019 },
  { carBrand: "Isuzu", carModel: "D-Max Blue Power", yearFrom: 2011, yearTo: 2019 },
  { carBrand: "Isuzu", carModel: "D-Max ew Gen", yearFrom: 2020, yearTo: 2026 },
  { carBrand: "Isuzu", carModel: "MU-X", yearFrom: 2013, yearTo: 2020 },
  { carBrand: "Chevrolet", carModel: "Colorado Gen 2", yearFrom: 2012, yearTo: 2020 },
];
const myVigo = (year: number | null): MyCar => ({
  brand: "Toyota",
  model: "Vigo",
  yearFrom: 2004,
  yearTo: 2015,
  year,
});

describe("fitmentName", () => {
  it("fitmentName > given brand and model > reads Toyota Vigo", () => {
    expect(fitmentName(VIGO_FITS[0]!)).toBe("Toyota Vigo");
  });
  it("fitmentName > given no brand > the model alone", () => {
    expect(fitmentName({ carBrand: null, carModel: "Vigo" })).toBe("Vigo");
  });
});

describe("fitmentYears", () => {
  it("fitmentYears > given both years > 2004–2015", () => {
    expect(fitmentYears({ yearFrom: 2004, yearTo: 2015 })).toBe("2004–2015");
  });
  it("fitmentYears > given only a start > 2011 ขึ้นไป", () => {
    expect(fitmentYears({ yearFrom: 2011, yearTo: null })).toBe("2011 ขึ้นไป");
  });
  it("fitmentYears > given only an end > ถึงปี 2015", () => {
    expect(fitmentYears({ yearFrom: null, yearTo: 2015 })).toBe("ถึงปี 2015");
  });
  it("fitmentYears > given no years > nothing", () => {
    expect(fitmentYears({ yearFrom: null, yearTo: null })).toBe("");
  });
});

describe("fitRows", () => {
  it("fitRows > given a saved Vigo 2012 > every model listed, only Vigo is mine", () => {
    expect(fitRows(VIGO_FITS, myVigo(2012))).toEqual([
      { name: "Toyota Vigo", years: "2004–2015", mine: true },
      { name: "Toyota Fortuner Gen 1", years: "2005–2014", mine: false },
      { name: "Toyota Altis", years: "2008–2013", mine: false },
    ]);
  });
  it("fitRows > given a Vigo outside the years > not mine", () => {
    expect(fitRows(VIGO_FITS, myVigo(2016))[0]!.mine).toBe(false);
  });
  it("fitRows > given a Vigo with no year > the model is enough", () => {
    expect(fitRows(VIGO_FITS, myVigo(null))[0]!.mine).toBe(true);
  });
  it("fitRows > given no saved car > nothing is mine", () => {
    expect(fitRows(VIGO_FITS, null).some((r) => r.mine)).toBe(false);
  });
});

describe("carCard", () => {
  it("carCard > given a part made for no car (oil) > no card", () => {
    expect(carCard([], myVigo(2012))).toBeNull();
  });
  it("carCard > given no saved car > asks to pick one", () => {
    expect(carCard(VIGO_FITS, null)).toEqual({
      kind: "none",
      title: "ใส่กับรถของคุณได้ไหม",
      sub: "เลือกรถ แล้วเราบอกให้",
      action: "เลือกรถ",
    });
  });
  it("carCard > given a car it fits > ใส่ได้กับรถของคุณ · Toyota Vigo 2012", () => {
    expect(carCard(VIGO_FITS, myVigo(2012))).toEqual({
      kind: "yes",
      title: "ใส่ได้กับรถของคุณ",
      sub: "Toyota Vigo 2012",
      action: "เปลี่ยนรถ",
    });
  });
  it("carCard > given a car it does not fit > names the first model and how many more", () => {
    expect(carCard(DMAX_FITS, myVigo(2012))).toEqual({
      kind: "no",
      title: "ไม่ใช่ของ Toyota Vigo 2012",
      sub: "ใส่ได้กับ Isuzu D-Max All New และอีก 4 รุ่น",
      action: "เปลี่ยนรถ",
    });
  });
  it("carCard > given one model only > no และอีก", () => {
    expect(carCard(DMAX_FITS.slice(0, 1), myVigo(2012))?.sub).toBe("ใส่ได้กับ Isuzu D-Max All New");
  });
  it("carCard > given a saved car with no year > Toyota Vigo", () => {
    expect(carCard(VIGO_FITS, myVigo(null))?.sub).toBe("Toyota Vigo");
  });
});

describe("infoRows", () => {
  const full = { warrantyDays: 90, hasTerms: true, categoryName: "ตู้แอร์ คอยล์เย็น" };
  it("infoRows > given warranty and conditions > four rows in the drawn order", () => {
    expect(infoRows(full)).toEqual([
      { key: "ship", label: "การจัดส่ง", value: "Flash Express" },
      { key: "warranty", label: "รับประกัน", value: "3 เดือน" },
      { key: "terms", label: "เงื่อนไข", value: "ของหมวดตู้แอร์ คอยล์เย็น" },
      { key: "returns", label: "คืน · เคลม", value: "การคืน ยกเลิก เคลม" },
    ]);
  });
  it("infoRows > given a category without conditions > no เงื่อนไข row", () => {
    expect(infoRows({ ...full, hasTerms: false }).map((r) => r.key)).toEqual([
      "ship",
      "warranty",
      "returns",
    ]);
  });
  it("infoRows > given no warranty set > no รับประกัน row (never 0 วัน)", () => {
    expect(infoRows({ ...full, warrantyDays: null }).map((r) => r.key)).toEqual([
      "ship",
      "terms",
      "returns",
    ]);
  });
  it("infoRows > given conditions but no category name > ของหมวดนี้", () => {
    expect(infoRows({ ...full, categoryName: null })[2]!.value).toBe("ของหมวดนี้");
  });
});

describe("specRows", () => {
  it("specRows > given a full product > หมวดหมู่ · แบรนด์ · น้ำหนัก", () => {
    expect(
      specRows({ categoryName: "ตู้แอร์ คอยล์เย็น", brandName: "Cool Gear", weightGrams: 1300 }),
    ).toEqual([
      { label: "หมวดหมู่", value: "ตู้แอร์ คอยล์เย็น" },
      { label: "แบรนด์", value: "Cool Gear" },
      { label: "น้ำหนัก", value: "1.3 กก." },
    ]);
  });
  it("specRows > given a part under 1 kg (an O-ring, 10 g) > grams, never 0.0 กก.", () => {
    expect(specRows({ categoryName: null, brandName: null, weightGrams: 10 })).toEqual([
      { label: "น้ำหนัก", value: "10 กรัม" },
    ]);
  });
  it("specRows > given no brand and no weight > only what it has", () => {
    expect(specRows({ categoryName: "น้ำมันคอม", brandName: null, weightGrams: 0 })).toEqual([
      { label: "หมวดหมู่", value: "น้ำมันคอม" },
    ]);
  });
});

describe("salePercent", () => {
  it("salePercent > given ฿1,490 off ฿1,650 > 10", () => {
    expect(salePercent(149000, 165000)).toBe(10);
  });
  it("salePercent > given no old price > null", () => {
    expect(salePercent(149000, null)).toBeNull();
  });
  it("salePercent > given an old price not higher > null", () => {
    expect(salePercent(149000, 149000)).toBeNull();
  });
});
