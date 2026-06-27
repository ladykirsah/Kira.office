import { describe, it, expect } from "vitest";
import { computeTax, lineTaxSatang } from "./tax";
import { round2 } from "./money";

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

  it("VAT-exclusive 9.5 @7% > parts reconcile (regression: was 10.17 vs 10.16)", () => {
    const r = computeTax({ netOfDiscount: 9.5, vatRate: 0.07, priceIncludesVat: false });
    expect(round2(r.salesExTax + r.taxAmount)).toBe(r.buyerPrice);
  });

  it("salesExTax + taxAmount === buyerPrice across fractional nets (both branches)", () => {
    for (let cents = 1; cents <= 10000; cents++) {
      const net = cents / 100;
      for (const priceIncludesVat of [true, false]) {
        const r = computeTax({ netOfDiscount: net, vatRate: 0.07, priceIncludesVat });
        expect(round2(r.salesExTax + r.taxAmount)).toBe(r.buyerPrice);
      }
    }
  });
});

describe("lineTaxSatang", () => {
  it("given VAT-inclusive 107 THB × 1 with no discount > 700 satang", () => {
    expect(lineTaxSatang({ unitPriceSatang: 10700, quantity: 1 })).toBe(700);
  });

  it("given a line discount > taxes the net amount after discount", () => {
    expect(lineTaxSatang({ unitPriceSatang: 10700, quantity: 1, discountSatang: 1070 })).toBe(630);
  });

  it("given non-taxable > zero", () => {
    expect(lineTaxSatang({ unitPriceSatang: 10700, quantity: 1, isTaxable: false })).toBe(0);
  });
});
