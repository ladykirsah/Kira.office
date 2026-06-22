/**
 * Finance posting: turn a completed sale's totals into financial-ledger record drafts (in satang)
 * for persistence. VAT and marketplace-fee rows are emitted only when non-zero.
 */
import { toSatang } from "./money";
import type { SaleChannel, SaleSummary } from "./pricing";

export type FinanceRecordType =
  | "sale_revenue"
  | "product_cost"
  | "gross_profit"
  | "vat_collected"
  | "marketplace_fee";

export interface FinanceRecordDraft {
  recordType: FinanceRecordType;
  channel: SaleChannel;
  amountSatang: number;
}

/** Build the financial-ledger rows for one completed sale (revenue is ex-VAT seller revenue). */
export function buildSaleFinanceRecords(
  channel: SaleChannel,
  summary: SaleSummary,
): FinanceRecordDraft[] {
  const records: FinanceRecordDraft[] = [
    { recordType: "sale_revenue", channel, amountSatang: toSatang(summary.salesExTaxTotal) },
    { recordType: "product_cost", channel, amountSatang: toSatang(summary.costTotal) },
    { recordType: "gross_profit", channel, amountSatang: toSatang(summary.grossProfitTotal) },
  ];
  if (summary.taxTotal > 0) {
    records.push({
      recordType: "vat_collected",
      channel,
      amountSatang: toSatang(summary.taxTotal),
    });
  }
  if (summary.feeTotal > 0) {
    records.push({
      recordType: "marketplace_fee",
      channel,
      amountSatang: toSatang(summary.feeTotal),
    });
  }
  return records;
}
