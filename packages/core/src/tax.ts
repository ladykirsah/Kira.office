import { round2 } from "./money";

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
