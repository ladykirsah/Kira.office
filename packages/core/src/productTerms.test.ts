import { describe, it, expect } from "vitest";
import { buildTermsVars, generateProductTerms, canTransitionTermsStatus } from "./productTerms";

describe("buildTermsVars", () => {
  it("maps product fields to placeholder keys", () => {
    expect(buildTermsVars({ productName: "ครีม", brand: "ABC" })).toMatchObject({
      product_name: "ครีม",
      brand: "ABC",
      product_type: "",
    });
  });
});

describe("generateProductTerms", () => {
  it("fills template and reports missing placeholders", () => {
    const out = generateProductTerms("สินค้า: {{product_name}} คืน {{return_days}}", {
      productName: "X",
    });
    expect(out.body).toBe("สินค้า: X คืน ");
    expect(out.missingPlaceholders).toEqual(["return_days"]);
    expect(out.canPublish).toBe(false);
  });

  it("canPublish when all placeholders filled", () => {
    const out = generateProductTerms("{{product_name}}", { productName: "Y" });
    expect(out.canPublish).toBe(true);
  });
});

describe("canTransitionTermsStatus", () => {
  it("draft to approved > manager > allowed", () => {
    expect(canTransitionTermsStatus("draft", "approved", "manager")).toBe(true);
  });

  it("draft to published > skips approve > denied", () => {
    expect(canTransitionTermsStatus("draft", "published", "owner")).toBe(false);
  });

  it("approved to published > owner > allowed", () => {
    expect(canTransitionTermsStatus("approved", "published", "owner")).toBe(true);
  });

  it("stock_operator > cannot approve", () => {
    expect(canTransitionTermsStatus("draft", "approved", "stock_operator")).toBe(false);
  });
});
