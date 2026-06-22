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

  if (!isTaxable || vatRate <= 0) {
    return {
      taxAmount: 0,
      salesExTax: round2(netOfDiscount),
      buyerPrice: round2(netOfDiscount),
    };
  }

  if (priceIncludesVat) {
    const taxAmount = netOfDiscount - netOfDiscount / (1 + vatRate);
    return {
      taxAmount: round2(taxAmount),
      salesExTax: round2(netOfDiscount - taxAmount),
      buyerPrice: round2(netOfDiscount),
    };
  }

  const taxAmount = netOfDiscount * vatRate;
  return {
    taxAmount: round2(taxAmount),
    salesExTax: round2(netOfDiscount),
    buyerPrice: round2(netOfDiscount + taxAmount),
  };
}
