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
