/**
 * Round a THB amount to 2 decimal places, half away from zero.
 * Rounding the magnitude and reapplying the sign keeps negative amounts
 * (refunds, cancellations, write-offs, over-discounts) symmetric with positive ones.
 */
export function round2(value: number): number {
  const scaled = Math.abs(value) * 100;
  const rounded = Math.round(scaled + Number.EPSILON) / 100;
  return value < 0 ? -rounded : rounded;
}
