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
