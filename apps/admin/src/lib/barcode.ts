/**
 * Pick a renderable barcode symbology for a typed value, or null when there's nothing to show.
 * 13 digits → EAN-13 (the retail/Shopee standard); anything else non-empty → Code 128 (encodes any
 * value). A 13-digit value with a bad EAN-13 checksum is caught at render time and falls back.
 */
export function chooseBarcodeFormat(value: string): "EAN13" | "CODE128" | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d{13}$/.test(v)) return "EAN13";
  return "CODE128";
}
