import { describe, expect, it } from "vitest";
import {
  carName,
  carYearLine,
  eraLabel,
  fitLine,
  fitsQuery,
  parseFitsParams,
  parseMyCar,
  serializeMyCar,
  tabForPath,
  yearChoices,
  type MyCar,
} from "./myCar";

const vigo2012: MyCar = {
  brand: "Toyota",
  model: "Vigo",
  yearFrom: 2004,
  yearTo: 2015,
  year: 2012,
};
const vigoNoYear: MyCar = { ...vigo2012, year: null };

describe("parseMyCar", () => {
  it("myCar > given a saved car > then reads it back", () => {
    expect(parseMyCar(serializeMyCar(vigo2012))).toEqual(vigo2012);
  });
  it("myCar > given nothing saved > then no car", () => {
    expect(parseMyCar(null)).toBeNull();
    expect(parseMyCar("")).toBeNull();
  });
  it("myCar > given broken or tampered storage > then no car", () => {
    expect(parseMyCar("{not json")).toBeNull();
    expect(parseMyCar(JSON.stringify({ brand: "Toyota" }))).toBeNull();
    expect(parseMyCar(JSON.stringify({ ...vigo2012, year: "2012" }))).toBeNull();
    expect(parseMyCar(JSON.stringify({ ...vigo2012, brand: "x".repeat(65) }))).toBeNull();
  });
  it("myCar > given an unknown year > then keeps year as null", () => {
    expect(parseMyCar(serializeMyCar(vigoNoYear))).toEqual(vigoNoYear);
  });
});

describe("car words", () => {
  it("carName > then brand + model", () => {
    expect(carName(vigo2012)).toBe("Toyota Vigo");
  });
  it("carYearLine > given a year and a count > then ปี … · อะไหล่ที่ใส่ได้ N รายการ", () => {
    expect(carYearLine(vigo2012, 3)).toBe("ปี 2012 · อะไหล่ที่ใส่ได้ 3 รายการ");
  });
  it("carYearLine > given no year > then ไม่ทราบปี", () => {
    expect(carYearLine(vigoNoYear, 5)).toBe("ไม่ทราบปี · อะไหล่ที่ใส่ได้ 5 รายการ");
  });
  it("carYearLine > given the count is still loading > then only the year", () => {
    expect(carYearLine(vigo2012, null)).toBe("ปี 2012");
  });
  it("eraLabel > given both ends > then from–to", () => {
    expect(eraLabel(2004, 2015)).toBe("2004–2015");
  });
  it("eraLabel > given an open end or no years > then ปัจจุบัน / nothing", () => {
    expect(eraLabel(2020, null)).toBe("2020–ปัจจุบัน");
    expect(eraLabel(null, null)).toBe("");
  });
});

describe("yearChoices", () => {
  it("yearChoices > given an era > then newest year first", () => {
    expect(yearChoices(2004, 2007, 2026)).toEqual([2007, 2006, 2005, 2004]);
  });
  it("yearChoices > given an open era > then up to this year", () => {
    expect(yearChoices(2024, null, 2026)).toEqual([2026, 2025, 2024]);
  });
  it("yearChoices > given no era > then the last 30 years", () => {
    const years = yearChoices(null, null, 2026);
    expect(years[0]).toBe(2026);
    expect(years).toHaveLength(30);
  });
});

describe("fitLine", () => {
  it("fitLine > given no saved car > then nothing", () => {
    expect(fitLine(null, true, true)).toBeNull();
  });
  it("fitLine > given a part made for no car (oil) > then nothing", () => {
    expect(fitLine(vigo2012, false, false)).toBeNull();
  });
  it("fitLine > given it fits > then ใส่ได้กับ model year", () => {
    expect(fitLine(vigo2012, true, true)).toEqual({ fits: true, text: "ใส่ได้กับ Vigo 2012" });
  });
  it("fitLine > given it fits and no year > then ใส่ได้กับ model", () => {
    expect(fitLine(vigoNoYear, true, true)).toEqual({ fits: true, text: "ใส่ได้กับ Vigo" });
  });
  it("fitLine > given a car part for another car > then ไม่ใช่ของ model", () => {
    expect(fitLine(vigo2012, true, false)).toEqual({ fits: false, text: "ไม่ใช่ของ Vigo" });
  });
});

describe("fits query", () => {
  it("fitsQuery > given a car with a year > then all three params", () => {
    expect(fitsQuery(vigo2012)).toBe("carBrand=Toyota&carModel=Vigo&year=2012");
  });
  it("fitsQuery > given no year > then no year param", () => {
    expect(fitsQuery(vigoNoYear)).toBe("carBrand=Toyota&carModel=Vigo");
  });
  it("parseFitsParams > given good params > then the filter", () => {
    const p = new URLSearchParams("carBrand=Toyota&carModel=Vigo&year=2012");
    expect(parseFitsParams(p)).toEqual({ carBrand: "Toyota", carModel: "Vigo", year: 2012 });
  });
  it("parseFitsParams > given missing brand/model or a bad year > then rejected", () => {
    expect(parseFitsParams(new URLSearchParams("carModel=Vigo"))).toBeNull();
    expect(parseFitsParams(new URLSearchParams("carBrand=Toyota"))).toBeNull();
    expect(
      parseFitsParams(new URLSearchParams("carBrand=Toyota&carModel=Vigo&year=abc")),
    ).toBeNull();
    expect(
      parseFitsParams(new URLSearchParams("carBrand=Toyota&carModel=Vigo&year=1800")),
    ).toBeNull();
    expect(
      parseFitsParams(new URLSearchParams(`carBrand=${"x".repeat(65)}&carModel=Vigo`)),
    ).toBeNull();
  });
});

describe("tabForPath (bottom bar)", () => {
  it("tabForPath > given a main page > then its tab", () => {
    expect(tabForPath("/")).toBe("home");
    expect(tabForPath("/categories")).toBe("cats");
    expect(tabForPath("/orders")).toBe("track");
    expect(tabForPath("/account")).toBe("me");
  });
  it("tabForPath > given a page with ‹ back > then no bar", () => {
    expect(tabForPath("/products/abc")).toBeNull();
    expect(tabForPath("/cart")).toBeNull();
    expect(tabForPath("/account/orders")).toBeNull();
    expect(tabForPath("/my-car")).toBeNull();
  });
});
