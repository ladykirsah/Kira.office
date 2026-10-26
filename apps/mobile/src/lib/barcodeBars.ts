import JsBarcode from "jsbarcode";

interface Bars {
  format: "EAN13" | "CODE128";
  /** One character per module: "1" is a black bar, "0" a gap. */
  bits: string;
}

/** Touching black modules drawn as one bar, so a barcode is a few dozen shapes, not ninety-five. */
export function barRuns(bits: string): { start: number; length: number }[] {
  return [...bits.matchAll(/1+/g)].map((m) => ({ start: m.index ?? 0, length: m[0].length }));
}

/** Same rule as the web back office's preview: 13 digits are EAN-13, anything else Code 128. */
function chooseFormat(value: string): Bars["format"] {
  return /^\d{13}$/.test(value) ? "EAN13" : "CODE128";
}

function encode(value: string, format: Bars["format"]): string {
  // JsBarcode writes its result into a plain object when it is given one, so no screen is needed.
  const target: { encodings?: { data: string }[] } = {};
  JsBarcode(target, value, { format, flat: true });
  return (target.encodings ?? []).map((e) => e.data).join("");
}

function tryEncode(value: string, format: Bars["format"]): Bars | null {
  try {
    return { format, bits: encode(value, format) };
  } catch {
    return null;
  }
}

/**
 * The bars of a scannable barcode for a code, ready to draw. A 13-digit code whose check digit is
 * wrong is not a valid EAN-13, so it is drawn as Code 128 instead. Code 128 carries letters, digits
 * and symbols but not Thai, so a code with Thai letters has no barcode to draw.
 */
export function barcodeBars(value: string): Bars | null {
  const v = value.trim();
  if (!v) return null;
  return tryEncode(v, chooseFormat(v)) ?? tryEncode(v, "CODE128");
}
