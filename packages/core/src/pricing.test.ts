import { describe, it, expect } from "vitest";
import { computeSaleProfit } from "./pricing";

describe("computeSaleProfit", () => {
  it("on-site, VAT-inclusive > profit excludes any marketplace fee", () => {
    const r = computeSaleProfit({
      unitPrice: 107,
      quantity: 1,
      vatRate: 0.07,
      priceIncludesVat: true,
      landedUnitCost: 60,
      channel: "onsite",
    });
    expect(r.taxAmount).toBe(7);
    expect(r.salesExTax).toBe(100);
    expect(r.marketplaceFee).toBe(0);
    expect(r.landedCost).toBe(60);
    expect(r.grossProfit).toBe(40);
    expect(r.grossMarginPct).toBe(40);
  });

  it("online (Shopee), VAT-inclusive > subtracts commission/transaction/fixed fees", () => {
    const r = computeSaleProfit({
      unitPrice: 107,
      quantity: 1,
      vatRate: 0.07,
      priceIncludesVat: true,
      landedUnitCost: 60,
      channel: "online",
      fees: { commissionRate: 0.05, transactionFeeRate: 0.02, serviceFeeRate: 0, fixedFee: 2 },
    });
    expect(r.marketplaceFee).toBe(9.49);
    expect(r.grossProfit).toBe(30.51);
    expect(r.grossMarginPct).toBe(30.51);
  });

  it("VAT-exclusive on-site > ex-tax revenue equals the listed price", () => {
    const r = computeSaleProfit({
      unitPrice: 100,
      quantity: 1,
      vatRate: 0.07,
      priceIncludesVat: false,
      landedUnitCost: 60,
      channel: "onsite",
    });
    expect(r.taxAmount).toBe(7);
    expect(r.salesExTax).toBe(100);
    expect(r.buyerPrice).toBe(107);
    expect(r.grossProfit).toBe(40);
  });

  it("zero ex-tax sales > margin is 0, not NaN", () => {
    const r = computeSaleProfit({
      unitPrice: 0,
      quantity: 1,
      landedUnitCost: 0,
      channel: "onsite",
    });
    expect(r.grossMarginPct).toBe(0);
  });

  it("quantity > 2 multiplies cost and revenue", () => {
    const r = computeSaleProfit({
      unitPrice: 107,
      quantity: 2,
      vatRate: 0.07,
      priceIncludesVat: true,
      landedUnitCost: 60,
      channel: "onsite",
    });
    expect(r.salesExTax).toBe(200);
    expect(r.landedCost).toBe(120);
    expect(r.grossProfit).toBe(80);
  });

  it("on-site with a pre-tax discount > VAT splits on the discounted amount", () => {
    const r = computeSaleProfit({
      unitPrice: 107,
      quantity: 1,
      discountAmount: 10.7,
      vatRate: 0.07,
      priceIncludesVat: true,
      landedUnitCost: 60,
      channel: "onsite",
    });
    expect(r.netOfDiscount).toBe(96.3);
    expect(r.salesExTax).toBe(90);
    expect(r.grossProfit).toBe(30);
  });

  it("online with feeBase 'ex_tax' > fee applies to ex-tax revenue, not buyer price", () => {
    const r = computeSaleProfit({
      unitPrice: 107,
      quantity: 1,
      vatRate: 0.07,
      priceIncludesVat: true,
      landedUnitCost: 60,
      channel: "online",
      fees: { commissionRate: 0.05, transactionFeeRate: 0.02, fixedFee: 2, feeBase: "ex_tax" },
    });
    expect(r.marketplaceFee).toBe(9);
    expect(r.grossProfit).toBe(31);
  });

  it("online with no fee config > marketplace fee is 0 (documented default)", () => {
    const r = computeSaleProfit({
      unitPrice: 107,
      quantity: 1,
      vatRate: 0.07,
      priceIncludesVat: true,
      landedUnitCost: 60,
      channel: "online",
    });
    expect(r.marketplaceFee).toBe(0);
    expect(r.grossProfit).toBe(40);
  });
});
