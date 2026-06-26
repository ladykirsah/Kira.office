/** A cart/bill line for total math — parts and services share this shape. */
export interface SaleLineLike {
  quantity: number;
  unitPriceSatang: number;
}

/** Line total in satang (quantity × unit price), clamping garbage/negative inputs to zero. */
export function lineTotalSatang(l: SaleLineLike): number {
  const qty = Math.max(0, Math.round(l.quantity || 0));
  const price = Math.max(0, Math.round(l.unitPriceSatang || 0));
  return qty * price;
}

/** Sum of all line totals in satang. */
export function cartTotalSatang(lines: SaleLineLike[]): number {
  return lines.reduce((sum, l) => sum + lineTotalSatang(l), 0);
}

export type DiscountKind = "thb" | "pct";

/** Discount in satang from a subtotal: a THB amount or a percentage, clamped to [0, subtotal]. */
export function discountSatangOf(subtotalSatang: number, kind: DiscountKind, raw: string): number {
  const n = parseFloat(raw) || 0;
  if (n <= 0) return 0;
  const d = kind === "pct" ? Math.round((subtotalSatang * n) / 100) : Math.round(n * 100);
  return Math.max(0, Math.min(subtotalSatang, d));
}

/**
 * Spread a sale-level discount across lines, proportional to each line's subtotal. Any rounding
 * remainder is given to the largest line so the parts always sum to exactly the total discount —
 * which keeps the server's per-line discount + gross-profit math consistent with the bill.
 */
export function distributeDiscount(lineSubtotals: number[], totalDiscountSatang: number): number[] {
  const total = lineSubtotals.reduce((a, b) => a + b, 0);
  if (total <= 0 || totalDiscountSatang <= 0) return lineSubtotals.map(() => 0);
  const out = lineSubtotals.map((s) => Math.round((totalDiscountSatang * s) / total));
  const diff = totalDiscountSatang - out.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    let idx = 0;
    let max = -Infinity;
    lineSubtotals.forEach((s, i) => {
      if (s > max) {
        max = s;
        idx = i;
      }
    });
    out[idx] += diff;
  }
  return out;
}
