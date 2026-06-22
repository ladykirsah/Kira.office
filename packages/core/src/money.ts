/**
 * Round a THB amount to 2 decimal places, half away from zero.
 * Rounding the magnitude and reapplying the sign keeps negative amounts
 * (refunds, cancellations, write-offs, over-discounts) symmetric with positive ones.
 */
export function round2(value: number): number {
  const scaled = Math.abs(value) * 100;
  const rounded = Math.round(scaled + Number.EPSILON) / 100;
  if (rounded === 0) return 0; // normalize -0 to +0
  return value < 0 ? -rounded : rounded;
}

/**
 * Convert THB to integer satang (minor units) for D1 storage.
 * Rounds to the nearest satang, half away from zero, sidestepping float error
 * (e.g. 30.51 * 100 === 3050.9999999999995 in IEEE-754).
 */
export function toSatang(thb: number): number {
  const satang = Math.round(Math.abs(thb) * 100 + Number.EPSILON);
  if (satang === 0) return 0; // normalize -0 to +0
  return thb < 0 ? -satang : satang;
}

/** Convert integer satang back to a THB number for display/compute. */
export function fromSatang(satang: number): number {
  return satang / 100;
}
