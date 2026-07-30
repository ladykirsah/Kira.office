import { describe, it, expect } from "vitest";
import { labelPageLayout, LABEL_PAGE } from "./labelPage";

/** A capture 1000px wide and `ratio`× as tall — the shape the label came out at. */
const capture = (ratio: number) => ({ width: 1000, height: 1000 * ratio });

describe("labelPageLayout", () => {
  it("always the same physical page, so every parcel gets the same sticker", () => {
    // A three-item order and a one-item order must not print at different sizes; the operator is
    // sticking these onto boxes, not laying out a document.
    expect(labelPageLayout(capture(0.8)).page).toEqual(LABEL_PAGE);
    expect(labelPageLayout(capture(1.5)).page).toEqual(LABEL_PAGE);
    expect(labelPageLayout(capture(3)).page).toEqual(LABEL_PAGE);
  });

  it("100 × 150 mm — the standard parcel label, which also prints fine on A4", () => {
    expect(LABEL_PAGE).toEqual({ w: 100, h: 150 });
  });

  it("given a label shorter than the page > fills the width and sits at the top", () => {
    // 1000 × 1000 → at 100mm wide the label is 100mm tall, inside the 150mm page.
    const out = labelPageLayout(capture(1));
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
    expect(out.w).toBe(100);
    expect(out.h).toBeCloseTo(100, 5);
  });

  it("given a label exactly the page height > still fills the width", () => {
    const out = labelPageLayout(capture(1.5));
    expect(out.w).toBe(100);
    expect(out.h).toBeCloseTo(150, 5);
  });

  it("given a long item list > scales down to fit rather than cropping", () => {
    // The failure this exists to prevent: a parcel going out with the receiver's postcode cut off.
    const out = labelPageLayout(capture(3));
    expect(out.h).toBeLessThanOrEqual(LABEL_PAGE.h);
    expect(out.w).toBeLessThan(100);
    expect(out.w).toBeCloseTo(50, 5);
  });

  it("a scaled-down label stays centred, not jammed against the left edge", () => {
    const out = labelPageLayout(capture(3));
    expect(out.x).toBeCloseTo((LABEL_PAGE.w - out.w) / 2, 5);
  });

  it("never places content outside the page, at any aspect", () => {
    for (const ratio of [0.2, 0.5, 1, 1.49, 1.5, 1.51, 2, 4, 10]) {
      const out = labelPageLayout(capture(ratio));
      expect(out.x).toBeGreaterThanOrEqual(0);
      expect(out.y).toBeGreaterThanOrEqual(0);
      expect(out.x + out.w).toBeLessThanOrEqual(LABEL_PAGE.w + 0.001);
      expect(out.y + out.h).toBeLessThanOrEqual(LABEL_PAGE.h + 0.001);
    }
  });

  it("preserves the label's aspect ratio, so nothing comes out stretched", () => {
    for (const ratio of [0.5, 1, 2, 5]) {
      const out = labelPageLayout(capture(ratio));
      expect(out.h / out.w).toBeCloseTo(ratio, 5);
    }
  });

  it("given a degenerate zero-width capture > does not return NaN", () => {
    // html2canvas can hand back a 0×0 canvas when the node was not laid out. Better a usable page
    // than a PDF with NaN geometry, which jsPDF renders as a blank sheet.
    const out = labelPageLayout({ width: 0, height: 0 });
    expect(Number.isFinite(out.w)).toBe(true);
    expect(Number.isFinite(out.h)).toBe(true);
    expect(Number.isFinite(out.x)).toBe(true);
    expect(Number.isFinite(out.y)).toBe(true);
  });
});
