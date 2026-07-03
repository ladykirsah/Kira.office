/** Rows the Onsite CSV export needs (a subset of SaleRow). */
export interface CsvSaleRow {
  saleNumber: string | null;
  createdAt: number;
  vehicle: string | null;
  licensePlate: string | null;
  grandTotalSatang: number;
  grossProfitSatang: number;
  saleStatus: string;
}

const esc = (v: string): string => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const baht = (satang: number): string => (satang / 100).toFixed(2);
const stamp = (ms: number): string => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

const HEADER = "Bill ID,Date,Vehicle,Plate,Total (THB),Profit (THB),Status";

/** CSV of the current Onsite view (client-side, so it reflects the active search/filter/period). */
export function onsiteSalesToCsv(rows: CsvSaleRow[]): string {
  const lines = [HEADER];
  for (const r of rows) {
    lines.push(
      [
        esc(r.saleNumber ?? ""),
        stamp(r.createdAt),
        esc(r.vehicle ?? ""),
        esc(r.licensePlate ?? ""),
        baht(r.grandTotalSatang),
        baht(r.grossProfitSatang),
        esc(r.saleStatus),
      ].join(","),
    );
  }
  return lines.join("\n");
}
