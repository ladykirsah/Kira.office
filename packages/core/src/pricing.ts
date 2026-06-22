import { round2 } from "./money";
import { computeTax } from "./tax";

export type SaleChannel = "onsite" | "online";

export interface MarketplaceFeeRates {
  commissionRate?: number;
  transactionFeeRate?: number;
  serviceFeeRate?: number;
  fixedFee?: number;
  /** Base the percentage fees apply to. Defaults to buyer_price. */
  feeBase?: "buyer_price" | "ex_tax";
}

export interface SaleLineInput {
  unitPrice: number;
  quantity: number;
  discountAmount?: number;
  vatRate?: number;
  priceIncludesVat?: boolean;
  isTaxable?: boolean;
  /** Resolved landed cost per unit (from the shop's cost method). */
  landedUnitCost: number;
  channel: SaleChannel;
  /** Marketplace fees; applied only when channel === "online". */
  fees?: MarketplaceFeeRates;
}

export interface SaleProfit {
  gross: number;
  netOfDiscount: number;
  taxAmount: number;
  salesExTax: number;
  buyerPrice: number;
  marketplaceFee: number;
  landedCost: number;
  grossProfit: number;
  grossMarginPct: number;
}

/**
 * Profit for one sale line.
 * On-site: price − discount − tax − cost (no marketplace fee).
 * Online (Shopee): the above minus commission/transaction/service/fixed fees.
 * An online line with no `fees` config yields a 0 marketplace fee (treated as fee-free).
 * See docs/PRICING_AND_FINANCE.md.
 */
export function computeSaleProfit(input: SaleLineInput): SaleProfit {
  const {
    unitPrice,
    quantity,
    discountAmount = 0,
    vatRate = 0,
    priceIncludesVat = false,
    isTaxable = true,
    landedUnitCost,
    channel,
    fees,
  } = input;

  const gross = unitPrice * quantity;
  const netOfDiscount = gross - discountAmount;
  const tax = computeTax({ netOfDiscount, vatRate, priceIncludesVat, isTaxable });

  let marketplaceFee = 0;
  if (channel === "online" && fees) {
    const feeBaseAmount = fees.feeBase === "ex_tax" ? tax.salesExTax : tax.buyerPrice;
    const percentRate =
      (fees.commissionRate ?? 0) + (fees.transactionFeeRate ?? 0) + (fees.serviceFeeRate ?? 0);
    marketplaceFee = round2(feeBaseAmount * percentRate + (fees.fixedFee ?? 0));
  }

  const landedCost = round2(landedUnitCost * quantity);
  const grossProfit = round2(tax.salesExTax - marketplaceFee - landedCost);
  const grossMarginPct = tax.salesExTax === 0 ? 0 : round2((grossProfit / tax.salesExTax) * 100);

  return {
    gross: round2(gross),
    netOfDiscount: round2(netOfDiscount),
    taxAmount: tax.taxAmount,
    salesExTax: tax.salesExTax,
    buyerPrice: tax.buyerPrice,
    marketplaceFee,
    landedCost,
    grossProfit,
    grossMarginPct,
  };
}

export interface SaleSummary {
  /** Per-line breakdowns, in input order. */
  lines: SaleProfit[];
  discountTotal: number;
  taxTotal: number;
  /** Marketplace fees across lines (0 for on-site). */
  feeTotal: number;
  costTotal: number;
  /** Seller revenue excluding VAT, summed. */
  salesExTaxTotal: number;
  /** What the buyer pays in total. */
  grandTotal: number;
  grossProfitTotal: number;
  grossMarginPct: number;
}

/**
 * Aggregate multiple sale lines into a single sale's totals (POS basket / imported order).
 * Convention: each line is rounded first, then the rounded lines are summed (round-per-line-then-sum),
 * so a total can differ by up to ~1 satang from rounding the raw aggregate. This keeps the sale's
 * totals equal to the sum of the per-line numbers shown on a receipt.
 */
export function summarizeSale(lines: SaleLineInput[]): SaleSummary {
  const computed = lines.map(computeSaleProfit);
  const sum = (pick: (p: SaleProfit) => number) =>
    round2(computed.reduce((acc, p) => acc + pick(p), 0));
  const discountTotal = round2(lines.reduce((acc, l) => acc + (l.discountAmount ?? 0), 0));
  const salesExTaxTotal = sum((p) => p.salesExTax);
  const grossProfitTotal = sum((p) => p.grossProfit);
  return {
    lines: computed,
    discountTotal,
    taxTotal: sum((p) => p.taxAmount),
    feeTotal: sum((p) => p.marketplaceFee),
    costTotal: sum((p) => p.landedCost),
    salesExTaxTotal,
    grandTotal: sum((p) => p.buyerPrice),
    grossProfitTotal,
    grossMarginPct: salesExTaxTotal === 0 ? 0 : round2((grossProfitTotal / salesExTaxTotal) * 100),
  };
}

export interface TargetMarginInput {
  landedUnitCost: number;
  /** Desired gross margin on ex-VAT revenue, as a percent (e.g. 40 for 40%). */
  targetMarginPct: number;
  vatRate?: number;
  priceIncludesVat?: boolean;
  isTaxable?: boolean;
  channel: SaleChannel;
  fees?: MarketplaceFeeRates;
}

export interface SuggestedPrice {
  /** Price to list (VAT-inclusive amount when priceIncludesVat, else the pre-VAT price). */
  unitPrice: number;
  /** What the buyer pays. */
  buyerPrice: number;
  /** Seller revenue excluding VAT. */
  salesExTax: number;
}

/**
 * Inverse of computeSaleProfit: the unit price that achieves a target gross margin, accounting for
 * VAT (inclusive/exclusive) and online percentage fees that scale with price. Throws if the target
 * margin is infeasible for the given fees/cost. Round-trips through computeSaleProfit (±1 satang).
 */
export function suggestPriceForTargetMargin(input: TargetMarginInput): SuggestedPrice {
  const {
    landedUnitCost,
    targetMarginPct,
    vatRate = 0,
    priceIncludesVat = false,
    isTaxable = true,
    channel,
    fees,
  } = input;

  const m = targetMarginPct / 100;
  const rate = isTaxable ? vatRate : 0;

  let percentRate = 0;
  let fixedFee = 0;
  let feeBaseIsBuyerPrice = true;
  if (channel === "online" && fees) {
    percentRate =
      (fees.commissionRate ?? 0) + (fees.transactionFeeRate ?? 0) + (fees.serviceFeeRate ?? 0);
    fixedFee = fees.fixedFee ?? 0;
    feeBaseIsBuyerPrice = fees.feeBase !== "ex_tax";
  }

  // buyerPrice = salesExTax * (1 + rate); fee base is buyerPrice (k = 1+rate) or salesExTax (k = 1).
  // salesExTax * m = salesExTax(1 − k·percentRate) − fixedFee − landedCost  =>  solve for salesExTax.
  const k = feeBaseIsBuyerPrice ? 1 + rate : 1;
  const denominator = 1 - k * percentRate - m;
  if (denominator <= 0) {
    throw new Error("target margin infeasible for the given cost and fees");
  }

  const salesExTaxRaw = (fixedFee + landedUnitCost) / denominator;
  const salesExTax = round2(salesExTaxRaw);
  const buyerPrice = round2(salesExTaxRaw * (1 + rate));
  // Listed unit price: VAT-inclusive => the buyer price; otherwise the pre-VAT price.
  const unitPrice = priceIncludesVat ? buyerPrice : salesExTax;
  return { unitPrice, buyerPrice, salesExTax };
}
