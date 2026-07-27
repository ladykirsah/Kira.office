/**
 * The "Add a label" compose form: fixed S/M/L label sizes + building a sheet item from the form.
 *
 * NOTE: S/M/L dimensions are PLACEHOLDERS pending the owner's real reference sizes from the product.
 * When the real sizes arrive, update LABEL_SIZES here (and the labels in the size selector).
 */

export const LABEL_SIZES = {
  S: { w: 32, h: 25 },
  M: { w: 50, h: 30 },
  L: { w: 70, h: 40 },
} as const;

export type LabelSizeKey = keyof typeof LABEL_SIZES;

/** Human-readable size, e.g. "50 × 30 mm" — shown under the size selector. */
export function sizeHint(size: LabelSizeKey): string {
  const { w, h } = LABEL_SIZES[size];
  return `${w} × ${h} mm`;
}

/**
 * Turn the compose-form state into a sheet item. The item shape matches what the sheet/PDF expects:
 * a product plus its chosen width/height (mm from the S/M/L preset), print count, and barcode flag.
 */
export function buildLabelItem<T>(
  product: T,
  size: LabelSizeKey,
  showBarcode: boolean,
  amount: number,
): { product: T; w: number; h: number; amount: number; showBarcode: boolean } {
  const { w, h } = LABEL_SIZES[size];
  const amt = Math.max(1, Math.round(Number.isFinite(amount) ? amount : 1));
  return { product, w, h, amount: amt, showBarcode };
}
