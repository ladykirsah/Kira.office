/**
 * Parcel size at the form boundary: operators think in centimetres, the DB stores millimetres.
 * Same split as weight (kg typed → weight_grams stored), and for the same reason — these feed
 * carrier rating (Shippop prices on w×l×h/5000), so a value that decides money stays an integer
 * rather than a float that drifts.
 */

/**
 * A typed centimetre value → whole millimetres, or null when it isn't a real measurement.
 *
 * null covers empty, zero, negative and junk alike — all of them mean "not measured", which must
 * stay distinguishable from a measured 0. A zero-size parcel is a claim; an empty field is an
 * absence, and only the absence should fail loudly at quote time.
 */
export function cmToMm(cm: string): number | null {
  const trimmed = cm.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 10);
}

/** Stored millimetres → the centimetre string the form shows. Unmeasured renders as an empty box. */
export function mmToCm(mm: number | null): string {
  if (mm == null) return "";
  // Trailing-zero trim: 400mm reads "40", not "40.0"; 125mm keeps its "12.5".
  return String(Math.round(mm) / 10);
}
