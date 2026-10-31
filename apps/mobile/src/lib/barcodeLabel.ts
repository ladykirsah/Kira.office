import qrcode from "qrcode-generator";
import type { Fitment, ProductRow } from "./productList";
import type { Attributes, CarBrand } from "./productsApi";

/**
 * The barcode label the owner drew themselves and approved (31 Oct 2026, canvas boards 1–4):
 * type in Thai over the brand in English, the product code in grey, a hairline, up to five car lines
 * (model bold, years regular), then the QR of the code with the shop's name and phone beside it.
 *
 * Every position below is in the owner's picture's own pixels (413 × 549, grey edge included) —
 * measured from it, then rebuilt and measured again until each line landed within 1–2 px. S is that
 * picture at 35 mm wide and L at 46 mm wide ("pick a side to be fixed, the other adjustable"); a
 * label with fewer cars is cut shorter by the missing rows so no paper is wasted. No screen code here.
 */

export type LabelSize = "S" | "L";

export const LABEL_WIDTH_MM: Record<LabelSize, number> = { S: 35, L: 46 };

/** "product list 5 line max" — and no "and N more" line. */
export const MAX_CAR_LINES = 5;

/** The picture's layout, in its pixels. The label screen draws from this; nothing else does. */
export const PICTURE = {
  width: 413,
  height: 549,
  /** The grey paper edge drawn round the label on screen (not printed). */
  edge: 3,
  /** Left edge of the words. */
  x: 31,
  /** Line-box tops at line-height 1 for the font sizes below. */
  nameTop: 25,
  brandTop: 76,
  codeTop: 135,
  hairY: 178,
  hairRight: 379,
  /** Baselines of the five car lines. */
  rowBase: [233, 267, 300, 334, 367],
  /** A car line's line box starts this many em above its baseline. */
  rowAscent: 0.846,
  bullet: 13,
  /** The bullet's centre sits this far above the baseline. */
  bulletRaise: 13,
  modelX: 63,
  yearGap: 17,
  qrX: 36,
  qrY: 405,
  qrSide: 112,
  shopX: 174,
  shopTop: 457,
  phoneTop: 493,
  /** Font sizes. The picture's Latin digits are smaller next to its Thai than the system font's, so
   * the years and the Thai shop name have their own sizes. */
  font: { name: 45.4, code: 29.8, model: 26.2, years: 24.4, shop: 26, phone: 28.4 },
} as const;

/** One car line on the label. */
export interface CarLine {
  model: string;
  years: string;
}

/** Everything a label says, before it is drawn. */
export interface LabelText {
  /** The part's kind in Thai (คอมเพรสเซอร์). */
  kind: string;
  /** The brand in English (Denso). */
  brand: string;
  code: string;
  cars: CarLine[];
}

/** How far up the label is cut for `lines` car lines (0 for five). */
export function cutFor(lines: number): number {
  const n = Math.min(MAX_CAR_LINES, Math.max(1, lines));
  return PICTURE.rowBase[MAX_CAR_LINES - 1]! - PICTURE.rowBase[n - 1]!;
}

/** The label's height in mm: the picture's shape at the size's width, shorter for fewer car lines. */
export function labelHeightMm(size: LabelSize, lines: number): number {
  return ((PICTURE.height - cutFor(lines)) * LABEL_WIDTH_MM[size]) / PICTURE.width;
}

function yearsText(from: number | null, to: number | null): string {
  if (from != null && to != null) return from === to ? `${from}` : `${from}-${to}`;
  return `${from ?? to ?? ""}`;
}

/**
 * The car lines: each fitment's model by its Thai name (from รุ่นรถที่ใช้ได้), or the name it is
 * saved under until someone adds a Thai one; a whole-make fitment shows the make. First five only.
 */
export function carLines(fitments: readonly Fitment[], brands: readonly CarBrand[]): CarLine[] {
  const lines: CarLine[] = [];
  for (const f of fitments) {
    if (lines.length === MAX_CAR_LINES) break;
    const make = brands.find((b) => b.name === f.carBrand);
    let name: string | null = null;
    if (f.carModel) {
      const model =
        make?.models.find((m) => m.name === f.carModel) ??
        brands.flatMap((b) => b.models).find((m) => m.name === f.carModel);
      name = model?.nameTh || f.carModel;
    } else if (f.carBrand) {
      name = make?.nameTh || f.carBrand;
    }
    if (name) lines.push({ model: name, years: yearsText(f.yearFrom, f.yearTo) });
  }
  return lines;
}

/** What a product's label says: kind in Thai, brand in English, code, cars. Nothing invented. */
export function labelText(
  row: ProductRow,
  attrs: Attributes,
  brands: readonly CarBrand[],
): LabelText {
  const type = attrs.types.find((a) => a.name === row.typeName);
  const brand = attrs.brands.find((a) => a.name === row.brandName);
  return {
    kind: row.typeName ? type?.nameTh || row.typeName : row.name,
    brand: row.brandName ? brand?.nameEn || row.brandName : "",
    code: row.productRef,
    cars: carLines(row.fitments, brands),
  };
}

/** Letters a QR can hold in its compact mode (digits, capitals and a few signs). */
const COMPACT = /^[0-9A-Z $%*+\-./:]*$/;

/**
 * The label's QR: the product code, which Scan looks up. Error correction Q (still reads with a
 * quarter of it scuffed); the compact mode when the code allows, so a code of up to 16 capitals
 * and digits stays the smallest QR — bigger squares on a small label scan easier.
 */
export function labelQr(code: string): boolean[][] {
  const qr = qrcode(0, "Q");
  qr.addData(code, COMPACT.test(code) ? "Alphanumeric" : "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}
