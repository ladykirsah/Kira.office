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
  | "marketplace_fee"
  | "refund"
  | "cancellation"
  | "write_off"
  | "payment_fee"
  | "manual_adjustment";

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

/**
 * Reversing finance records for a refund or cancellation of (a portion of) a sale. Amounts are the
 * sale postings sign-flipped; the revenue line is typed `refund`/`cancellation`. `summary` is the
 * refunded portion (full sale or a partial subset re-summarized via summarizeSale).
 */
export function buildRefundFinanceRecords(
  channel: SaleChannel,
  summary: SaleSummary,
  kind: "refund" | "cancellation" = "refund",
): FinanceRecordDraft[] {
  const negSatang = (thb: number): number => {
    const satang = toSatang(thb);
    return satang === 0 ? 0 : -satang;
  };
  const records: FinanceRecordDraft[] = [
    { recordType: kind, channel, amountSatang: negSatang(summary.salesExTaxTotal) },
    { recordType: "product_cost", channel, amountSatang: negSatang(summary.costTotal) },
    { recordType: "gross_profit", channel, amountSatang: negSatang(summary.grossProfitTotal) },
  ];
  if (summary.taxTotal > 0) {
    records.push({
      recordType: "vat_collected",
      channel,
      amountSatang: negSatang(summary.taxTotal),
    });
  }
  if (summary.feeTotal > 0) {
    records.push({
      recordType: "marketplace_fee",
      channel,
      amountSatang: negSatang(summary.feeTotal),
    });
  }
  return records;
}
