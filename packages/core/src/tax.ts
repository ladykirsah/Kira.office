import { round2, toSatang } from "./money";

export interface TaxInput {
  /** Price after discount, in THB. */
  netOfDiscount: number;
  /** VAT rate as a fraction, e.g. 0.07 for 7%. */
  vatRate: number;
  /** True if the listed price already includes VAT. */
  priceIncludesVat: boolean;
  /** Defaults to true. When false, no VAT is applied. */
  isTaxable?: boolean;
}

export interface TaxResult {
  /** VAT amount remitted (not income). */
  taxAmount: number;
  /** Seller revenue with VAT removed. */
  salesExTax: number;
  /** What the buyer pays for the item. */
  buyerPrice: number;
}

/** Compute VAT split for a sale line. See docs/PRICING_AND_FINANCE.md. */
export function computeTax(input: TaxInput): TaxResult {
  const { netOfDiscount, vatRate, priceIncludesVat, isTaxable = true } = input;

  // Each branch derives the third field from the other two ROUNDED fields, so the rows always
  // reconcile (salesExTax + taxAmount === buyerPrice) and finance postings tie out exactly.
  if (!isTaxable || vatRate <= 0) {
    const amount = round2(netOfDiscount);
    return { taxAmount: 0, salesExTax: amount, buyerPrice: amount };
  }

  if (priceIncludesVat) {
    const buyerPrice = round2(netOfDiscount);
    const taxAmount = round2(netOfDiscount - netOfDiscount / (1 + vatRate));
    return { taxAmount, salesExTax: round2(buyerPrice - taxAmount), buyerPrice };
  }

  const salesExTax = round2(netOfDiscount);
  const taxAmount = round2(netOfDiscount * vatRate);
  return { taxAmount, salesExTax, buyerPrice: round2(salesExTax + taxAmount) };
}

export interface LineTaxInput {
  unitPriceSatang: number;
  quantity: number;
  discountSatang?: number;
  /** Basis points, e.g. 700 = 7%. Defaults to 700. */
  vatRateBp?: number;
  /** Defaults to true (Thailand shop default). */
  priceIncludesVat?: boolean;
  isTaxable?: boolean;
}

/** VAT portion in satang for one sale line (after line discount). */
export function lineTaxSatang(input: LineTaxInput): number {
  const grossSatang = input.unitPriceSatang * input.quantity;
  const netSatang = grossSatang - (input.discountSatang ?? 0);
  if (netSatang <= 0) return 0;
  const vatRate = (input.vatRateBp ?? 700) / 10000;
  const { taxAmount } = computeTax({
    netOfDiscount: netSatang / 100,
    vatRate,
    priceIncludesVat: input.priceIncludesVat ?? true,
    isTaxable: input.isTaxable ?? true,
  });
  return toSatang(taxAmount);
}
