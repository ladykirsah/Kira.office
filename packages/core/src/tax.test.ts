import { describe, it, expect } from "vitest";
import { computeTax } from "./tax";

describe("computeTax > per-product VAT", () => {
  it("given VAT-inclusive 107 @7% > tax 7, exTax 100, buyer 107", () => {
    expect(computeTax({ netOfDiscount: 107, vatRate: 0.07, priceIncludesVat: true })).toEqual({
      taxAmount: 7,
      salesExTax: 100,
      buyerPrice: 107,
    });
  });

  it("given VAT-exclusive 100 @7% > tax 7, exTax 100, buyer 107", () => {
    expect(computeTax({ netOfDiscount: 100, vatRate: 0.07, priceIncludesVat: false })).toEqual({
      taxAmount: 7,
      salesExTax: 100,
      buyerPrice: 107,
    });
  });

  it("given non-taxable > zero tax, exTax equals price", () => {
    expect(
      computeTax({ netOfDiscount: 100, vatRate: 0.07, priceIncludesVat: true, isTaxable: false }),
    ).toEqual({ taxAmount: 0, salesExTax: 100, buyerPrice: 100 });
  });

  it("given zero rate > zero tax", () => {
    expect(computeTax({ netOfDiscount: 100, vatRate: 0, priceIncludesVat: false })).toEqual({
      taxAmount: 0,
      salesExTax: 100,
      buyerPrice: 100,
    });
  });
});
