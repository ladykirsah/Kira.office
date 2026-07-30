/**
 * Paper for a saved parcel label: always 100 × 150 mm, the standard shipping-label size, which also
 * prints on A4 without fuss.
 *
 * Fixed page rather than one that follows the content, unlike a bill (see billPage): these get stuck
 * onto boxes, so a three-item order and a one-item order must come out the same physical size. A
 * label too long for the page is scaled down to fit — never cropped, because the thing that would get
 * cut off is the bottom of the receiver's address.
 */

export const LABEL_PAGE = { w: 100, h: 150 } as const;

export interface LabelPageLayout {
  page: { w: number; h: number };
  /** Where to place the captured label, in mm. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export function labelPageLayout(capture: { width: number; height: number }): LabelPageLayout {
  const page = { w: LABEL_PAGE.w, h: LABEL_PAGE.h };

  // A 0×0 capture means the node was never laid out. Fall back to filling the page rather than
  // propagating NaN into jsPDF, which renders it as a blank sheet with no error.
  if (!(capture.width > 0) || !(capture.height > 0)) {
    return { page, x: 0, y: 0, w: page.w, h: page.h };
  }

  const ratio = capture.height / capture.width;
  const heightAtFullWidth = page.w * ratio;

  if (heightAtFullWidth <= page.h) {
    return { page, x: 0, y: 0, w: page.w, h: heightAtFullWidth };
  }

  // Taller than the label — shrink to the page height and centre it.
  const h = page.h;
  const w = h / ratio;
  return { page, x: (page.w - w) / 2, y: 0, w, h };
}
