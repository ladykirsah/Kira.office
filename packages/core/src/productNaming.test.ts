import { describe, it, expect } from "vitest";
import { buildProductName, canBuildProductName, type ProductNameInput } from "./productNaming";

const base: ProductNameInput = {
  typeNameTh: "ตู้แอร์ คอยล์เย็น",
  fitments: [
    { carBrand: "Toyota", carModel: "Vigo", carModelTh: "วีโก้" },
    { carBrand: "Toyota", carModel: "Fortuner", carModelTh: "ฟอร์จูนเนอร์" },
    { carBrand: "Toyota", carModel: "Altis", carModelTh: "อัลติส" },
  ],
  brandName: "Denso",
  productRef: "TG447610-7290",
};

describe("buildProductName", () => {
  it("given a full product > composes the owner's pattern", () => {
    expect(buildProductName(base)).toBe(
      "ตู้แอร์ คอยล์เย็น Toyota Vigo / ฟอร์จูนเนอร์ / อัลติส | Denso TG447610-7290",
    );
  });

  it("keeps the first fitment roman and the rest Thai", () => {
    const out = buildProductName(base);
    // The first car carries its brand and roman model; later cars are the Thai name only.
    expect(out).toContain("Toyota Vigo");
    expect(out).not.toContain("Toyota Fortuner");
    expect(out).toContain("ฟอร์จูนเนอร์");
    expect(out).not.toContain("Fortuner");
  });

  it("given a model with no Thai name > falls back to the roman one", () => {
    const out = buildProductName({
      ...base,
      fitments: [base.fitments[0]!, { carBrand: "Toyota", carModel: "Innova", carModelTh: null }],
    });
    expect(out).toContain("/ Innova");
  });

  it("given more than three fitments > names only the first three", () => {
    const out = buildProductName({
      ...base,
      fitments: [
        ...base.fitments,
        { carBrand: "Toyota", carModel: "Commuter", carModelTh: "คอมมิวเตอร์" },
      ],
    });
    expect(out).not.toContain("คอมมิวเตอร์");
  });

  it("given one fitment > uses no slash", () => {
    const out = buildProductName({ ...base, fitments: [base.fitments[0]!] });
    expect(out).toBe("ตู้แอร์ คอยล์เย็น Toyota Vigo | Denso TG447610-7290");
  });

  it("given no brand > drops the slot without leaving a stray separator", () => {
    const out = buildProductName({ ...base, brandName: null });
    expect(out).toBe("ตู้แอร์ คอยล์เย็น Toyota Vigo / ฟอร์จูนเนอร์ / อัลติส | TG447610-7290");
    expect(out).not.toContain("|  ");
    expect(out).not.toContain(" | |");
  });

  it("trims stray whitespace from every slot", () => {
    const out = buildProductName({
      ...base,
      typeNameTh: "  ตู้แอร์  ",
      brandName: " Denso ",
      productRef: " TG447610-7290 ",
      fitments: [{ carBrand: " Toyota ", carModel: " Vigo ", carModelTh: null }],
    });
    expect(out).toBe("ตู้แอร์ Toyota Vigo | Denso TG447610-7290");
  });
});

describe("canBuildProductName", () => {
  it("is true once type, a fitment and a code exist", () => {
    expect(canBuildProductName(base)).toBe(true);
  });

  it("does NOT require a brand — plenty of parts are unbranded", () => {
    expect(canBuildProductName({ ...base, brandName: null })).toBe(true);
  });

  it.each([
    ["no type", { typeNameTh: null }],
    ["no code", { productRef: "" }],
    ["no fitment", { fitments: [] }],
    ["a fitment with no model", { fitments: [{ carBrand: "Toyota", carModel: null }] }],
  ])("is false with %s", (_label, patch) => {
    expect(canBuildProductName({ ...base, ...(patch as Partial<ProductNameInput>) })).toBe(false);
  });
});
