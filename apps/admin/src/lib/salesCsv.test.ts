import { describe, it, expect } from "vitest";
import { onsiteSalesToCsv, type CsvSaleRow } from "./salesCsv";

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
