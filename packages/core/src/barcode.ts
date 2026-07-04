/**
 * Barcode policy (owner decision, 2026-06-29): the Product ID is the single product identifier, and a
 * product's barcode is *made from* its Product ID. In practice the owner scans the manufacturer's box
 * barcode when one exists (those are themselves encodings of the Product ID); only when a product ships
 * without a barcode does the shop mint its own, derived from the Product ID. So this module never
 * invents a random/internal code — it either keeps the existing (scanned) barcode or derives one
 * verbatim from the Product ID, which a Code 128 symbology renders as a scannable label.
 */

/**
 * The barcode value for a product that has no manufacturer barcode: the Product ID itself, trimmed.
 * Verbatim (dashes/letters kept) so the printed barcode's value equals the Product ID exactly.
 * Throws when the Product ID is empty — there is then no source for a barcode.
 */
export function deriveBarcodeFromProductId(productId: string): string {
  const id = productId.trim();
  if (!id) throw new Error("cannot derive a barcode: product id is empty");
  return id;
}

/**
 * Resolve the barcode to store for a product. Keeps an existing scanned/manufacturer barcode when one
 * is present (never overwrites a real EAN/UPC); otherwise derives one from the Product ID. Throws only
 * when there is neither a barcode nor a Product ID to derive from.
 */
export function resolveProductBarcode(opts: {
  productId: string;
  scannedBarcode?: string | null;
}): string {
  const scanned = opts.scannedBarcode?.trim();
  if (scanned) return scanned;
  return deriveBarcodeFromProductId(opts.productId);
}
