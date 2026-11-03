import { describe, it, expect } from "vitest";
import { joinDescriptions, productTerms } from "./productDescription";

const OWN = "👉🏻 Made in Thailand\n👉🏻 พร้อมโอริงที่ข้อต่อ";
const CATEGORY = "👨🏻‍🔧 คำแนะนำจากช่าง\nหากรถยนต์ของคุณเลขไมล์ถึง 150,000 กม. แล้ว";

describe("joinDescriptions", () => {
  it("given both > the product's text, one empty line, then the category's", () => {
    expect(joinDescriptions(OWN, CATEGORY)).toBe(`${OWN}\n\n${CATEGORY}`);
  });

  it("given only the product's text > that text alone", () => {
    expect(joinDescriptions(OWN, null)).toBe(OWN);
  });

  it("given only the category's text > that text alone", () => {
    expect(joinDescriptions(null, CATEGORY)).toBe(CATEGORY);
  });

  it("given neither > null, so the page shows no description block", () => {
    expect(joinDescriptions(null, null)).toBeNull();
  });

  it("given blank or space-only text > treated as none, and outer spaces trimmed", () => {
    expect(joinDescriptions("  \n ", `\n${CATEGORY}\n\n`)).toBe(CATEGORY);
    expect(joinDescriptions(`${OWN}\n\n\n`, "   ")).toBe(OWN);
  });
});

describe("productTerms", () => {
  const head = { name: "ตู้แอร์ Toyota Vigo", brandName: "DENSO", warrantyDays: 365 };

  it("given the category's เงื่อนไข > filled with this product's name, brand and warranty", () => {
    expect(
      productTerms("สินค้า: {{product_name}}\nยี่ห้อ: {{brand}}\nรับประกัน {{warranty}}", head),
    ).toBe("สินค้า: ตู้แอร์ Toyota Vigo\nยี่ห้อ: DENSO\nรับประกัน 1 ปี");
  });

  it("given none, or only spaces > no เงื่อนไข box", () => {
    expect(productTerms(null, head)).toBeNull();
    expect(productTerms("  \n", head)).toBeNull();
  });
});
