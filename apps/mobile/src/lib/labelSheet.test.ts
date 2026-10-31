import { describe, expect, it } from "vitest";
import { labelHeightMm, type LabelSize } from "./barcodeLabel";
import { pageSize, planLabelPages, sheetSummary, SHEET_MARGIN_MM } from "./labelSheet";

const many = (n: number, size: LabelSize, lines: number) =>
  Array.from({ length: n }, () => ({ size, lines }));

describe("pageSize", () => {
  it("given A4 or A5, upright or sideways > then its width and height in mm", () => {
    expect(pageSize("A4", "portrait")).toEqual({ width: 210, height: 297 });
    expect(pageSize("A4", "landscape")).toEqual({ width: 297, height: 210 });
    expect(pageSize("A5", "portrait")).toEqual({ width: 148, height: 210 });
    expect(pageSize("A5", "landscape")).toEqual({ width: 210, height: 148 });
  });
});

describe("planLabelPages", () => {
  it("given no labels > then no pages", () => {
    expect(planLabelPages([], "A4", "portrait")).toEqual([]);
  });

  it("given labels of one size > then they stack down a column from the margin, touching, no gap", () => {
    const [page] = planLabelPages(many(3, "S", 5), "A4", "portrait");
    const h = labelHeightMm("S", 5);
    expect(page!.map((p) => [p.x, p.y])).toEqual([
      [SHEET_MARGIN_MM, SHEET_MARGIN_MM],
      [SHEET_MARGIN_MM, SHEET_MARGIN_MM + h],
      [SHEET_MARGIN_MM, SHEET_MARGIN_MM + 2 * h],
    ]);
  });

  it("given a label that would cross the bottom margin > then it starts the next column", () => {
    // Six 46.5 mm labels fit in A4's 281 mm; the seventh moves right by one label width.
    const [page] = planLabelPages(many(7, "S", 5), "A4", "portrait");
    expect(page!.slice(0, 6).every((p) => p.x === SHEET_MARGIN_MM)).toBe(true);
    expect(page![6]).toMatchObject({ x: SHEET_MARGIN_MM + 35, y: SHEET_MARGIN_MM });
  });

  it("given shorter labels > then more fit in a column (paper is not wasted)", () => {
    const [page] = planLabelPages(many(7, "S", 1), "A4", "portrait");
    expect(page!.every((p) => p.x === SHEET_MARGIN_MM)).toBe(true);
  });

  it("given a change of size > then a new column, even with room left", () => {
    const [page] = planLabelPages([...many(2, "L", 3), ...many(2, "S", 2)], "A4", "portrait");
    expect(page!.map((p) => p.x)).toEqual([8, 8, 8 + 46, 8 + 46]);
    expect(page![2]!.y).toBe(SHEET_MARGIN_MM);
  });

  it("given more columns than the page is wide > then a second page, starting top left", () => {
    // A4 upright holds five 35 mm columns of six; the 31st label goes to page 2.
    const pages = planLabelPages(many(31, "S", 5), "A4", "portrait");
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(30);
    expect(pages[1]![0]).toMatchObject({ x: SHEET_MARGIN_MM, y: SHEET_MARGIN_MM, index: 30 });
  });

  it("given every label on a page > then none crosses the margins", () => {
    for (const [paper, way] of [
      ["A4", "portrait"],
      ["A4", "landscape"],
      ["A5", "portrait"],
      ["A5", "landscape"],
    ] as const) {
      const { width, height } = pageSize(paper, way);
      for (const page of planLabelPages([...many(9, "L", 5), ...many(12, "S", 1)], paper, way)) {
        for (const p of page) {
          expect(p.x + (p.size === "L" ? 46 : 35)).toBeLessThanOrEqual(
            width - SHEET_MARGIN_MM + 1e-9,
          );
          expect(p.y + labelHeightMm(p.size, p.lines)).toBeLessThanOrEqual(
            height - SHEET_MARGIN_MM + 1e-9,
          );
        }
      }
    }
  });

  it("given the approved sample (compressor L ×4, blower L ×6, valve S ×4) > then one page, three columns", () => {
    const pages = planLabelPages(
      [...many(4, "L", 3), ...many(6, "L", 2), ...many(4, "S", 2)],
      "A4",
      "portrait",
    );
    expect(pages).toHaveLength(1);
    expect(new Set(pages[0]!.map((p) => p.x))).toEqual(new Set([8, 54, 100]));
    expect(pages[0]!.map((p) => p.index)).toEqual([...Array(14).keys()]);
  });
});

describe("sheetSummary", () => {
  it("given labels and pages > then '14 ป้าย · 1 หน้า A4'", () => {
    expect(sheetSummary(14, 1, "A4")).toEqual({
      th: "14 ป้าย · 1 หน้า A4",
      en: "14 labels · 1 A4 page",
    });
  });

  it("given two A5 pages > then the plural in English", () => {
    expect(sheetSummary(40, 2, "A5")).toEqual({
      th: "40 ป้าย · 2 หน้า A5",
      en: "40 labels · 2 A5 pages",
    });
  });
});
