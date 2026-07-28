/**
 * The "Add a label" compose form: the two label versions, the two printed sizes, and building a
 * sheet item from the form.
 *
 * The label design is proportion-locked (owner-approved 2026-07-27): the artwork is drawn in a fixed
 * template — 620 × 294 for Full, 632 × 212 for Minimal — and the chosen size only scales that block.
 * So height is the single dimension the user picks (L = 50 mm, S = 35 mm) and width follows.
 */

import type { Fitment } from "./api";

/** Barcode ON prints the Full label (barcode + ID + shop name); OFF prints the Minimal one. */
export type LabelVersion = "full" | "minimal";
export type LabelSize = "L" | "S";

/** The two printed heights, in millimetres. */
export const LABEL_HEIGHT_MM: Record<LabelSize, number> = { L: 50, S: 35 };

/** Locked width:height of each version's artwork template. */
export const LABEL_ASPECT: Record<LabelVersion, number> = {
  full: 620 / 294,
  minimal: 632 / 212,
};

/** Printed size in mm: the picked height, widened to the version's locked proportion. */
export function labelDimensions(version: LabelVersion, size: LabelSize): { w: number; h: number } {
  const h = LABEL_HEIGHT_MM[size];
  return { w: Math.round(h * LABEL_ASPECT[version] * 10) / 10, h };
}

/** Human-readable size, e.g. "50 mm tall" — shown under the size selector. */
export function sizeHint(size: LabelSize): string {
  return `${LABEL_HEIGHT_MM[size]} mm tall`;
}

/**
 * The fitment lines printed on a label: "Brand Model Year", at most three (the design's block).
 * A fitment with nothing in it is skipped; a real year range prints as "from–to".
 */
export function fitmentLines(fitments: Fitment[], max = 3): string[] {
  const lines: string[] = [];
  for (const f of fitments) {
    const from = f.yearFrom ?? null;
    const to = f.yearTo ?? null;
    const years = from && to && to !== from ? `${from}–${to}` : (from ?? to ?? "");
    const text = [f.carBrand, f.carModel, years]
      .map((p) => (p == null ? "" : String(p).trim()))
      .filter(Boolean)
      .join(" ");
    if (!text) continue;
    lines.push(text);
    if (lines.length === max) break;
  }
  return lines;
}

/**
 * Wrap `text` to at most `maxLines` lines no wider than `maxW`, measured by `measure` (the label
 * renderer passes canvas text measuring; tests pass a fake).
 *
 * Breaks between words when it can — a product name reading "Compressor Asse / mbly" looks broken
 * on a printed label. Words longer than a line (and Thai, which has no spaces) still break inside
 * the word, and text that overruns the last line is ellipsized.
 */
export function wrapLines(
  measure: (s: string) => number,
  text: string,
  maxW: number,
  maxLines: number,
): string[] {
  const queue = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  while (queue.length && lines.length < maxLines) {
    const word = queue.shift() as string;
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxW) {
      line = candidate;
      continue;
    }
    if (line) {
      // Start the word on the next line instead of splitting it here.
      lines.push(line);
      line = "";
      queue.unshift(word);
      continue;
    }
    // The word alone is wider than the line — take as much of it as fits.
    let cut = "";
    for (const ch of [...word]) {
      if (measure(cut + ch) > maxW) break;
      cut += ch;
    }
    if (!cut) cut = [...word][0] ?? ""; // one very wide glyph: still make progress
    line = cut;
    const rest = word.slice(cut.length);
    if (rest) {
      lines.push(line);
      line = "";
      queue.unshift(rest);
    }
  }

  if (line && lines.length < maxLines) lines.push(line);
  else if (line) queue.unshift(line);

  // Something didn't fit → mark the cut with an ellipsis on the last line.
  if (queue.length && lines.length) {
    let t = lines[lines.length - 1];
    while (t && measure(`${t}…`) > maxW) t = t.slice(0, -1);
    lines[lines.length - 1] = `${t}…`;
  }
  return lines;
}

/** File name for a single saved label image, e.g. "label-261470-0290-full-L.png". */
export function labelFileName(code: string, version: LabelVersion, size: LabelSize): string {
  const safe = (code ?? "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return ["label", safe, version, size].filter(Boolean).join("-") + ".png";
}

/**
 * Turn the compose-form state into a sheet item: the product plus the version, the picked size and
 * the printed width/height it resolves to, and how many copies to print.
 */
export function buildLabelItem<T>(
  product: T,
  version: LabelVersion,
  size: LabelSize,
  amount: number,
): {
  product: T;
  version: LabelVersion;
  size: LabelSize;
  w: number;
  h: number;
  amount: number;
} {
  const { w, h } = labelDimensions(version, size);
  const amt = Math.max(1, Math.round(Number.isFinite(amount) ? amount : 1));
  return { product, version, size, w, h, amount: amt };
}
