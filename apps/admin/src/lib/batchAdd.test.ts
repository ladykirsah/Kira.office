import { describe, it, expect } from "vitest";
import { carrySummary, clearedProductFields } from "./batchAdd";

describe("clearedProductFields > per-product reset for Save & add next", () => {
  it("returns empty identity/size/pricing fields and zero stock", () => {
    const c = clearedProductFields();
    expect(c.name).toBe("");
    expect(c.productRef).toBe("");
    expect(c.shopeeItemId).toBe("");
    expect(c.stockQty).toBe("0");
    expect(c.weightKg).toBe("");
    expect(c.pricing).toEqual({
      costThb: "",
      taxOnCost: false,
      b2cThb: "",
      b2bThb: "",
      onlineThb: "",
      onlineCommPct: "",
    });
  });
});

describe("carrySummary > pill label for carried batch fields", () => {
  it("given brand, type and fitments > joins brand · type · N รุ่นรถ", () => {
    expect(carrySummary({ brand: "DENSO", usage: "A/C", type: "Compressor" }, 3)).toBe(
      "DENSO · Compressor · 3 รุ่นรถ",
    );
  });

  it("given only a brand > shows just the brand", () => {
    expect(carrySummary({ brand: "Sanden", usage: "", type: "" }, 0)).toBe("Sanden");
  });

  it("given nothing carried > returns null so no pill renders", () => {
    expect(carrySummary({ brand: "", usage: "", type: "" }, 0)).toBeNull();
  });
});
