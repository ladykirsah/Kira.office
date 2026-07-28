/** Label-sheet geometry: paper sizes and how many labels tile onto a page (all units mm). */

export type Paper = "A4" | "A5";
export type Orientation = "portrait" | "landscape";

export interface PageSize {
  width: number;
  height: number;
}

/** A4/A5 dimensions in millimetres, portrait. */
export const PAPER_MM: Record<Paper, PageSize> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
};

/** Page size for a paper + orientation (landscape swaps width/height). */
export function pageDimensions(paper: Paper, orientation: Orientation): PageSize {
  const p = PAPER_MM[paper];
  return orientation === "landscape" ? { width: p.height, height: p.width } : { ...p };
}

export interface GridPlan {
  cols: number;
  rows: number;
  perPage: number;
}

/** How many labels of (labelW × labelH) fit on a page, given equal outer margin and inter-label gap. */
export function planLabelGrid(args: {
  page: PageSize;
  labelW: number;
  labelH: number;
  margin: number;
  gap: number;
}): GridPlan {
  const { page, labelW, labelH, margin, gap } = args;
  const usableW = page.width - 2 * margin;
  const usableH = page.height - 2 * margin;
  // N labels need N*size + (N-1)*gap ≤ usable  →  N ≤ (usable + gap) / (size + gap)
  const cols = labelW > 0 ? Math.max(0, Math.floor((usableW + gap) / (labelW + gap))) : 0;
  const rows = labelH > 0 ? Math.max(0, Math.floor((usableH + gap) / (labelH + gap))) : 0;
  return { cols, rows, perPage: cols * rows };
}

/**
 * Outer margin kept clear on every sheet. Lasers reserve ~4.2 mm on every edge and inkjets can
 * reserve 10–15 mm at the bottom, so 8 mm keeps the last row well clear of both — and it costs
 * nothing: a label only loses ~1 mm of width, and the rows per page are unchanged.
 */
export const SHEET_MARGIN = 8;

/**
 * How much a label may be scaled DOWN to win another column. The label keeps its exact
 * proportions — it only gets a little smaller, never stretched.
 */
export const MAX_SHRINK = 0.1;

/**
 * Fit a label across the page: the most columns it can make if it may shrink by at most
 * MAX_SHRINK, scaling width and height together. A label is never enlarged to fill the row, and
 * one wider than the page is scaled down to fit.
 */
export function fitColumns(args: {
  naturalW: number;
  naturalH: number;
  usableW: number;
  maxShrink?: number;
}): { cols: number; w: number; h: number } {
  const { naturalW, naturalH, usableW, maxShrink = MAX_SHRINK } = args;
  if (naturalW <= 0 || naturalH <= 0 || usableW <= 0) return { cols: 0, w: 0, h: 0 };
  const smallest = naturalW * (1 - maxShrink);
  const cols = Math.max(1, Math.floor(usableW / smallest));
  const w = Math.min(naturalW, usableW / cols);
  return { cols, w, h: naturalH * (w / naturalW) };
}

export interface SheetItem {
  w: number;
  h: number;
  amount: number;
}

export interface Placement {
  index: number;
  page: number;
  x: number;
  y: number;
}

export interface SheetPlan {
  pages: number;
  placements: Placement[];
}

/**
 * Lay several products' labels onto pages. Each product's labels fill their own rows (cols sized to
 * that product's width); the next product starts on a fresh row below. Rows flow to a new page when
 * they don't fit. Items too big for the page (or with no copies) are skipped.
 */
export function planSheet(args: {
  items: SheetItem[];
  page: PageSize;
  margin: number;
  gap: number;
}): SheetPlan {
  const { items, page, margin, gap } = args;
  const usableW = page.width - 2 * margin;
  const usableH = page.height - 2 * margin;
  const maxY = margin + usableH; // a row fits while y + h ≤ maxY
  const placements: Placement[] = [];
  let pageNum = 0;
  let y = margin;

  for (let index = 0; index < items.length; index++) {
    const { w, h, amount } = items[index];
    if (w <= 0 || h <= 0 || amount <= 0 || w > usableW || h > usableH) continue;
    const cols = Math.max(1, Math.floor((usableW + gap) / (w + gap)));
    let placed = 0;
    while (placed < amount) {
      if (y + h > maxY) {
        pageNum++;
        y = margin;
      }
      const inRow = Math.min(cols, amount - placed);
      for (let c = 0; c < inRow; c++) {
        placements.push({ index, page: pageNum, x: margin + c * (w + gap), y });
        placed++;
      }
      y += h + gap; // next product starts on the row below
    }
  }

  return { pages: placements.length ? pageNum + 1 : 0, placements };
}

export interface FittedSheetPlan extends SheetPlan {
  /** The size each item actually prints at, after fitting it across the page. */
  printed: { w: number; h: number }[];
}

/**
 * Plan a sheet that uses the paper: every label is first fitted across the page width (shrunk a
 * little if that wins a column), then tiled edge to edge. The one planner behind both the PDF and
 * the on-screen count, so they can never disagree.
 */
export function planFittedSheet(args: {
  items: SheetItem[];
  page: PageSize;
  margin?: number;
  maxShrink?: number;
}): FittedSheetPlan {
  const { items, page, margin = SHEET_MARGIN, maxShrink } = args;
  const usableW = page.width - 2 * margin;
  const printed = items.map((it) => {
    const { w, h } = fitColumns({ naturalW: it.w, naturalH: it.h, usableW, maxShrink });
    return { w, h };
  });
  const plan = planSheet({
    items: items.map((it, i) => ({ ...printed[i], amount: it.amount })),
    page,
    margin,
    gap: 0,
  });
  return { ...plan, printed };
}
