import { describe, it, expect } from "vitest";
import { onsiteSalesToCsv, onlineOrdersToCsv, type CsvSaleRow, type CsvOrderRow } from "./salesCsv";

const order = (over: Partial<CsvOrderRow> = {}): CsvOrderRow => ({
  externalOrderId: "SP-2026-0001",
  orderCreatedAt: Date.UTC(2026, 6, 3, 10, 48, 0),
  importedAt: Date.UTC(2026, 6, 4, 0, 0, 0),
  orderStatus: "completed",
  paymentStatus: "paid",
  grandTotalSatang: 235000,
  feeTotalSatang: 18000,
  ...over,
});

describe("onlineOrdersToCsv", () => {
  it("starts with a header row", () => {
    expect(onlineOrdersToCsv([]).split("\n")[0]).toBe(
      "Order ID,Date,Status,Payment,Total (THB),Fees (THB)",
    );
  });

  it("renders a row with baht amounts and the order timestamp", () => {
    const line = onlineOrdersToCsv([order()]).split("\n")[1];
    expect(line).toBe("SP-2026-0001,2026-07-03 10:48:00,completed,paid,2350.00,180.00");
  });

  it("falls back to the imported timestamp when there is no order date", () => {
    const line = onlineOrdersToCsv([order({ orderCreatedAt: null })]).split("\n")[1];
    expect(line).toContain("2026-07-04 00:00:00");
  });
});

const row = (over: Partial<CsvSaleRow> = {}): CsvSaleRow => ({
  saleNumber: "DAS202607-01001",
  createdAt: Date.UTC(2026, 6, 3, 10, 48, 0),
  vehicle: "Toyota Vigo",
  licensePlate: "1กก1234",
  grandTotalSatang: 470000,
  grossProfitSatang: 120000,
  saleStatus: "completed",
  ...over,
});

describe("onsiteSalesToCsv", () => {
  it("starts with a header row", () => {
    expect(onsiteSalesToCsv([]).split("\n")[0]).toBe(
      "Bill ID,Date,Vehicle,Plate,Total (THB),Profit (THB),Status",
    );
  });

  it("renders a row with baht amounts and a timestamp", () => {
    const line = onsiteSalesToCsv([row()]).split("\n")[1];
    expect(line).toBe(
      "DAS202607-01001,2026-07-03 10:48:00,Toyota Vigo,1กก1234,4700.00,1200.00,completed",
    );
  });

  it("quotes fields containing a comma", () => {
    const line = onsiteSalesToCsv([row({ vehicle: "Vigo, 2.5" })]).split("\n")[1];
    expect(line).toContain('"Vigo, 2.5"');
  });
});
