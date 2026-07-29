/**
 * Paper for a saved bill (owner's rule, 2026-07-29): the bill always prints at A5 width, so a short
 * bill and a long one come out the same physical size. A short bill leaves the rest of the A5 page
 * blank; one too long for A5 moves to A4 — same width, centred, more length. A bill too long even
 * for A4 is scaled down so nothing is cut off.
 */

const A5 = { w: 148, h: 210 };
const A4 = { w: 210, h: 297 };
/** Bill width on the page — A5's width on both papers. */
const BILL_W = A5.w;

export interface BillPageLayout {
  page: { w: number; h: number };
  /** Where to place the captured bill, in mm. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export function billPageLayout(capture: { width: number; height: number }): BillPageLayout {
  const ratio = capture.height / capture.width;
  const heightAtBillWidth = BILL_W * ratio;

  if (heightAtBillWidth <= A5.h) {
    return { page: { ...A5 }, x: 0, y: 0, w: BILL_W, h: heightAtBillWidth };
  }

  // Too long for A5 → A4, same width, centred.
  if (heightAtBillWidth <= A4.h) {
    return {
      page: { ...A4 },
      x: (A4.w - BILL_W) / 2,
      y: 0,
      w: BILL_W,
      h: heightAtBillWidth,
    };
  }

  // Longer than A4 as well — shrink to fit the page rather than crop the bill.
  const h = A4.h;
  const w = h / ratio;
  return { page: { ...A4 }, x: (A4.w - w) / 2, y: 0, w, h };
}
