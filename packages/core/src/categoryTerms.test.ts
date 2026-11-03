import { describe, expect, it } from "vitest";
import {
  TERMS_FIELDS,
  fillCategoryTerms,
  joinDescriptions,
  unknownTermsFields,
  warrantyThai,
} from "./categoryTerms";

const RULES =
  "สินค้า: {{product_name}}\nยี่ห้อ: {{brand}}\nรับประกัน {{warranty}} นับจากวันที่ซื้อ";

describe("categoryTerms", () => {
  it("TERMS_FIELDS > the three a product fills, in the order the sheet lists them", () => {
    expect(TERMS_FIELDS).toEqual(["product_name", "brand", "warranty"]);
  });

  it("fillCategoryTerms > given a product > its name, brand and the category's warranty", () => {
    expect(
      fillCategoryTerms(RULES, {
        productName: "ตู้แอร์ Toyota Vigo",
        brand: "DENSO",
        warrantyDays: 365,
      }),
    ).toBe("สินค้า: ตู้แอร์ Toyota Vigo\nยี่ห้อ: DENSO\nรับประกัน 1 ปี นับจากวันที่ซื้อ");
  });

  it("fillCategoryTerms > given spaces inside the braces > still filled", () => {
    expect(
      fillCategoryTerms("{{ brand }}", { productName: "x", brand: "DENSO", warrantyDays: null }),
    ).toBe("DENSO");
  });

  it("fillCategoryTerms > given no brand and no warranty > empty brand, ไม่มีรับประกัน", () => {
    expect(fillCategoryTerms(RULES, { productName: "Evap", brand: null, warrantyDays: null })).toBe(
      "สินค้า: Evap\nยี่ห้อ: \nรับประกัน ไม่มีรับประกัน นับจากวันที่ซื้อ",
    );
  });

  it("warrantyThai > years, months, days, none — as ตั้งค่าอะไหล่ says them", () => {
    expect(warrantyThai(730)).toBe("2 ปี");
    expect(warrantyThai(180)).toBe("6 เดือน");
    expect(warrantyThai(30)).toBe("30 วัน");
    expect(warrantyThai(45)).toBe("45 วัน");
    expect(warrantyThai(0)).toBe("ไม่มีรับประกัน");
    expect(warrantyThai(null)).toBe("ไม่มีรับประกัน");
  });

  it("unknownTermsFields > given a name a product does not have (Thai or English) > it, once each", () => {
    expect(unknownTermsFields(RULES)).toEqual([]);
    expect(
      unknownTermsFields("{{รับประกันศูนย์}} {{ price }} {{brand}} {{รับประกันศูนย์}}"),
    ).toEqual(["รับประกันศูนย์", "price"]);
  });

  it("joinDescriptions > the product's text, one empty line, the category's; either alone; neither > null", () => {
    expect(joinDescriptions(" own \n", "cat")).toBe("own\n\ncat");
    expect(joinDescriptions(null, "cat")).toBe("cat");
    expect(joinDescriptions("own", "  ")).toBe("own");
    expect(joinDescriptions(null, null)).toBeNull();
  });
});
