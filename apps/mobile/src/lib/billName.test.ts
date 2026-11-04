import { describe, expect, it } from "vitest";
import { billLineName, firstCarModel } from "./billName";

const coil = {
  name: "ตู้แอร์ คอยล์เย็น Toyota Revo / Fortuner Gen 2 | Cool Gear DI261416-03704W",
  typeName: "ตู้แอร์",
  brandName: "Cool Gear",
  carModel: "Revo",
};

describe("billLineName", () => {
  it("customer bill > a part with type and brand > reads [type] [brand]", () => {
    expect(billLineName(coil, "customer")).toBe("ตู้แอร์ Cool Gear");
  });

  it("B2B bill > a part with a car > adds the first car model", () => {
    expect(billLineName(coil, "mechanic")).toBe("ตู้แอร์ Cool Gear Revo");
  });

  it("B2B bill > a part made for no car (oil) > type and brand only", () => {
    const oil = { ...coil, typeName: "น้ำมันคอมแอร์", brandName: "DENSO", carModel: null };
    expect(billLineName(oil, "mechanic")).toBe("น้ำมันคอมแอร์ DENSO");
  });

  it("any bill > no brand > the type alone", () => {
    expect(billLineName({ ...coil, brandName: " " }, "customer")).toBe("ตู้แอร์");
  });

  it("any bill > no type set > the product's full name, never a bare brand", () => {
    expect(billLineName({ ...coil, typeName: null }, "mechanic")).toBe(coil.name);
  });

  it("any bill > an old line with only a name (draft saved before the rule) > the name", () => {
    expect(billLineName({ name: "เติมน้ำยาแอร์ R134a" }, "customer")).toBe("เติมน้ำยาแอร์ R134a");
  });
});

describe("firstCarModel", () => {
  it("fitments in list order > the top one's model", () => {
    expect(firstCarModel([{ carModel: "Tiger D4D" }, { carModel: "Vigo" }])).toBe("Tiger D4D");
  });

  it("no fitments or a blank model > null", () => {
    expect(firstCarModel(null)).toBeNull();
    expect(firstCarModel(undefined)).toBeNull();
    expect(firstCarModel([])).toBeNull();
    expect(firstCarModel([{ carModel: " " }])).toBeNull();
  });
});
