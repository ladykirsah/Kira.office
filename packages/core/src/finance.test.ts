import { describe, it, expect } from "vitest";
import { buildSaleFinanceRecords, buildRefundFinanceRecords } from "./finance";
import { summarizeSale } from "./pricing";

describe("buildSaleFinanceRecords", () => {
  const onsite = summarizeSale([
    {
      unitPrice: 107,
      quantity: 1,
      vatRate: 0.07,
      priceIncludesVat: true,
      landedUnitCost: 60,
      channel: "onsite",
    },
    {
      unitPrice: 53.5,
      quantity: 1,
      vatRate: 0.07,
      priceIncludesVat: true,
      landedUnitCost: 30,
      channel: "onsite",
    },
  ]);

  it("posts revenue, cost, profit, and VAT in satang (no fee on-site)", () => {
    const records = buildSaleFinanceRecords("onsite", onsite);
    const byType = Object.fromEntries(records.map((r) => [r.recordType, r.amountSatang]));
    expect(byType).toEqual({
      sale_revenue: 15000,
      product_cost: 9000,
      gross_profit: 6000,
      vat_collected: 1050,
    });
    expect(records.every((r) => r.channel === "onsite")).toBe(true);
  });

  it("includes a marketplace_fee row for online sales with fees", () => {
    const online = summarizeSale([
      {
        unitPrice: 107,
        quantity: 1,
        vatRate: 0.07,
        priceIncludesVat: true,
        landedUnitCost: 60,
        channel: "online",
        fees: { commissionRate: 0.05, transactionFeeRate: 0.02, fixedFee: 2 },
      },
    ]);
    const fee = buildSaleFinanceRecords("online", online).find(
      (r) => r.recordType === "marketplace_fee",
    );
    expect(fee?.amountSatang).toBe(949);
  });
});

describe("buildRefundFinanceRecords", () => {
  const onsite = summarizeSale([
    {
      unitPrice: 107,
      quantity: 1,
      vatRate: 0.07,
      priceIncludesVat: true,
      landedUnitCost: 60,
      channel: "onsite",
    },
  ]);

  it("reverses a sale's postings with negated amounts and a refund revenue line", () => {
    const records = buildRefundFinanceRecords("onsite", onsite);
    const byType = Object.fromEntries(records.map((r) => [r.recordType, r.amountSatang]));
    expect(byType).toEqual({
      refund: -10000,
      product_cost: -6000,
      gross_profit: -4000,
      vat_collected: -700,
    });
  });

  it("labels the revenue line 'cancellation' when kind is cancellation", () => {
    const records = buildRefundFinanceRecords("onsite", onsite, "cancellation");
    expect(records.some((r) => r.recordType === "cancellation")).toBe(true);
    expect(records.some((r) => r.recordType === "refund")).toBe(false);
  });
});
