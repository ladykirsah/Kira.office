import { describe, expect, it } from "vitest";
import { canonicalPlate, canonicalProvince, carProblem, plateKey, PROVINCES } from "./plate";

describe("canonicalPlate", () => {
  it("given a car plate typed with no space, extra spaces or a dash > then letters, one space, numbers", () => {
    for (const typed of ["กข1234", "กข 1234", "กข   1234", " กข-1234 ", "กข - 1234"]) {
      expect(canonicalPlate(typed)).toBe("กข 1234");
    }
  });

  it("given a plate that starts with a number > then the number stays with the letters", () => {
    expect(canonicalPlate("1กก1234")).toBe("1กก 1234");
    expect(canonicalPlate("1 กก 1234")).toBe("1กก 1234");
    expect(canonicalPlate("12กข 9")).toBe("12กข 9");
  });

  it("given a truck or bus plate (2 digits, 4 digits) > then it keeps the dash", () => {
    expect(canonicalPlate("701234")).toBe("70-1234");
    expect(canonicalPlate("70 - 1234")).toBe("70-1234");
    expect(canonicalPlate("70-1234")).toBe("70-1234");
  });

  it("given anything else > then it is kept as typed, with only the spaces tidied", () => {
    expect(canonicalPlate("  ป้ายแดง   A 123 ")).toBe("ป้ายแดง A 123");
    expect(canonicalPlate("")).toBe("");
  });
});

describe("plateKey", () => {
  it("gives the same key however the plate was typed", () => {
    expect(plateKey("กข 1234")).toBe("กข1234");
    expect(plateKey(" กข-1234")).toBe("กข1234");
    expect(plateKey("70 - 1234")).toBe("701234");
  });
});

describe("canonicalProvince (plan 13.11)", () => {
  it("given the official name > then it is kept", () => {
    expect(canonicalProvince("เชียงใหม่")).toBe("เชียงใหม่");
    expect(canonicalProvince("  กรุงเทพมหานคร ")).toBe("กรุงเทพมหานคร");
  });

  it("given Bangkok's short names > then they are กรุงเทพมหานคร", () => {
    for (const typed of [
      "กทม",
      "กทม.",
      "กรุงเทพ",
      "กรุงเทพฯ",
      "กรุงเทพ มหานคร",
      "Bangkok",
      "BKK",
    ]) {
      expect(canonicalProvince(typed)).toBe("กรุงเทพมหานคร");
    }
  });

  it("given จ. or จังหวัด in front > then only the province's name stays", () => {
    expect(canonicalProvince("จ.เชียงใหม่")).toBe("เชียงใหม่");
    expect(canonicalProvince("จังหวัด ขอนแก่น")).toBe("ขอนแก่น");
  });

  it("given the common short names > then the official name", () => {
    expect(canonicalProvince("อยุธยา")).toBe("พระนครศรีอยุธยา");
    expect(canonicalProvince("โคราช")).toBe("นครราชสีมา");
  });

  it("given a name not on the list > then it is kept as typed, spaces tidied", () => {
    expect(canonicalProvince("  ป้าย   แดง ")).toBe("ป้าย แดง");
    expect(canonicalProvince("")).toBe("");
  });

  it("has all 77 provinces, each once", () => {
    expect(PROVINCES).toHaveLength(77);
    expect(new Set(PROVINCES).size).toBe(77);
  });
});

describe("one car (plan 13.11: number, letters, digits and province all match, in order)", () => {
  // The server keeps a car as its canonical plate + canonical province; two are one car when both match.
  const car = (plate: string, province: string) => ({ plate, province });
  const sameCar = (a: ReturnType<typeof car>, b: ReturnType<typeof car>) =>
    canonicalPlate(a.plate) === canonicalPlate(b.plate) &&
    canonicalProvince(a.province) === canonicalProvince(b.province);

  it("given the same four parts typed differently > then it is one car", () => {
    expect(sameCar(car("1กก1234", "กทม"), car("1 กก 1234", "กรุงเทพมหานคร"))).toBe(true);
    expect(sameCar(car("กข-1234", "จ.เชียงใหม่"), car("กข 1234", "เชียงใหม่"))).toBe(true);
  });

  it("given the same plate from two provinces > then two cars", () => {
    expect(sameCar(car("1กก 1234", "กรุงเทพมหานคร"), car("1กก 1234", "เชียงใหม่"))).toBe(false);
  });

  it("given the letters or digits in another order > then two cars", () => {
    expect(sameCar(car("กข 1234", "ขอนแก่น"), car("ขก 1234", "ขอนแก่น"))).toBe(false);
    expect(sameCar(car("กข 1234", "ขอนแก่น"), car("กข 4321", "ขอนแก่น"))).toBe(false);
  });

  it("given one has the leading number and the other not > then two cars", () => {
    expect(sameCar(car("1กก 1234", "ขอนแก่น"), car("กก 1234", "ขอนแก่น"))).toBe(false);
  });
});

describe("carProblem (plan 13.11, owner pick A: a plate needs its province)", () => {
  it("given a plate and a province > then nothing is missing", () => {
    expect(carProblem("กข 1234", "ขอนแก่น")).toBeNull();
  });

  it("given a plate with no province > then the province is required", () => {
    expect(carProblem("กข 1234", "")).toBe("province_required");
    expect(carProblem("กข 1234", "   ")).toBe("province_required");
    expect(carProblem("กข 1234", null)).toBe("province_required");
  });

  it("given no plate at all (a parts sale) > then nothing is missing", () => {
    expect(carProblem("", "")).toBeNull();
    expect(carProblem("  ", null)).toBeNull();
  });
});
