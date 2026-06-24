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
