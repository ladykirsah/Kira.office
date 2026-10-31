import type { Phrase } from "@l-shopee/shared/lang";
import { labelHeightMm, LABEL_WIDTH_MM, type LabelSize } from "./barcodeLabel";

/**
 * How ออกบาร์โค้ด lays labels on paper (owner approved the A4 page, 31 Oct 2026): one size per
 * column, labels stacked top-down touching (the grey edge is the cut line), each only as tall as its
 * car lines; a column ends when the next label would cross the margin or the size changes, and a page
 * ends when the next column would cross the right margin. List order is kept, so one product's labels
 * stay together and cutting stays simple: down between the columns, then across. No screen code here.
 */

export type Paper = "A4" | "A5";
export type PaperWay = "portrait" | "landscape";

/** The old back office's page margin (labelGrid SHEET_MARGIN): printers keep ~4–15 mm clear. */
export const SHEET_MARGIN_MM = 8;

const PAPER_MM: Record<Paper, { short: number; long: number }> = {
  A4: { short: 210, long: 297 },
  A5: { short: 148, long: 210 },
};

/** One label's place on a page, in mm from the page's top-left corner. */
export interface PlacedLabel {
  x: number;
  y: number;
  size: LabelSize;
  lines: number;
  /** Its position in the list given (each copy counts). */
  index: number;
}

export function pageSize(paper: Paper, way: PaperWay): { width: number; height: number } {
  const { short, long } = PAPER_MM[paper];
  return way === "portrait" ? { width: short, height: long } : { width: long, height: short };
}

/** Every label's place, page by page. `labels` is the list in order, one entry per copy. */
export function planLabelPages(
  labels: readonly { size: LabelSize; lines: number }[],
  paper: Paper,
  way: PaperWay,
): PlacedLabel[][] {
  const { width, height } = pageSize(paper, way);
  const right = width - SHEET_MARGIN_MM;
  const bottom = height - SHEET_MARGIN_MM;
  const pages: PlacedLabel[][] = [];
  let page: PlacedLabel[] = [];
  let x = SHEET_MARGIN_MM;
  let y = SHEET_MARGIN_MM;
  let column: LabelSize | null = null;

  labels.forEach(({ size, lines }, index) => {
    const h = labelHeightMm(size, lines);
    if (column && (size !== column || y + h > bottom)) {
      x += LABEL_WIDTH_MM[column];
      y = SHEET_MARGIN_MM;
    }
    if (x + LABEL_WIDTH_MM[size] > right) {
      pages.push(page);
      page = [];
      x = SHEET_MARGIN_MM;
      y = SHEET_MARGIN_MM;
    }
    page.push({ x, y, size, lines, index });
    y += h;
    column = size;
  });
  if (page.length) pages.push(page);
  return pages;
}

/** The page's grey line: "14 ป้าย · 1 หน้า A4". */
export function sheetSummary(labels: number, pages: number, paper: Paper): Phrase {
  return {
    th: `${labels} ป้าย · ${pages} หน้า ${paper}`,
    en: `${labels} label${labels === 1 ? "" : "s"} · ${pages} ${paper} page${pages === 1 ? "" : "s"}`,
  };
}
