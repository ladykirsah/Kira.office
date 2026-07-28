import { describe, it, expect } from "vitest";
import { fitColumns, pageDimensions, planFittedSheet, planLabelGrid, planSheet } from "./labelGrid";

const A4 = { width: 210, height: 297 };

describe("fitColumns", () => {
  // A4 portrait with the 5 mm print margin leaves 200 mm of usable width.
  const usableW = 200;

  it("given a label that nearly fits twice > shrinks it slightly so two fit", () => {
    // Full · L is 105.4 × 50: two need 210.8 mm. A 5% shrink gets them to 100 mm each.
    const fit = fitColumns({ naturalW: 105.4, naturalH: 50, usableW });
    expect(fit.cols).toBe(2);
    expect(fit.w).toBeCloseTo(100, 5);
    expect(fit.h).toBeCloseTo(47.44, 2); // scaled by the same factor — never stretched
  });

  it("keeps the label's proportion exactly", () => {
    const fit = fitColumns({ naturalW: 105.4, naturalH: 50, usableW });
    expect(fit.w / fit.h).toBeCloseTo(105.4 / 50, 6);
  });

  it("given room for a third column within the shrink limit > uses three", () => {
    // Full · S is 73.8 × 35: three at 66.67 mm is a 9.7% shrink — inside the limit.
    const fit = fitColumns({ naturalW: 73.8, naturalH: 35, usableW });
    expect(fit.cols).toBe(3);
    expect(fit.w).toBeCloseTo(200 / 3, 5);
  });

  it("given a label that would need more than the shrink limit > keeps fewer columns", () => {
    // Minimal · L is 149.1 wide: two would mean a 33% shrink, so it stays one per row.
    const fit = fitColumns({ naturalW: 149.1, naturalH: 50, usableW });
    expect(fit).toMatchObject({ cols: 1, w: 149.1, h: 50 });
  });

  it("never enlarges a label to fill the row", () => {
    const fit = fitColumns({ naturalW: 40, naturalH: 20, usableW });
    expect(fit.w).toBe(40);
    expect(fit.h).toBe(20);
    expect(fit.cols).toBe(5);
  });

  it("given a label wider than the page > shrinks it to the usable width", () => {
    const fit = fitColumns({ naturalW: 400, naturalH: 100, usableW });
    expect(fit).toMatchObject({ cols: 1, w: 200, h: 50 });
  });
});

describe("planFittedSheet", () => {
  it("lays Full · L two per row and six rows down an A4 page", () => {
    const sheet = planFittedSheet({ items: [{ w: 105.4, h: 50, amount: 24 }], page: A4 });
    // Default 8 mm print margin → 194 mm usable → two 97 mm labels.
    expect(sheet.printed[0].w).toBeCloseTo(97, 5);
    expect(sheet.printed[0].h).toBeCloseTo(46.02, 2);
    expect(sheet.pages).toBe(2); // 12 per page
    // second label of the first row sits flush against the first — no gap
    expect(sheet.placements[1]).toMatchObject({ index: 0, page: 0, y: 8 });
    expect(sheet.placements[1].x).toBeCloseTo(105, 5);
  });

  it("leaves the last row clear of the bottom edge, where inkjets can't print", () => {
    const sheet = planFittedSheet({ items: [{ w: 105.4, h: 50, amount: 12 }], page: A4 });
    const last = sheet.placements[sheet.placements.length - 1];
    const bottomOfLastRow = last.y + sheet.printed[0].h;
    expect(A4.height - bottomOfLastRow).toBeGreaterThan(10);
  });

  it("reports the printed size for every item, in order", () => {
    const sheet = planFittedSheet({
      items: [
        { w: 105.4, h: 50, amount: 1 },
        { w: 149.1, h: 50, amount: 1 },
      ],
      page: A4,
      margin: 5,
    });
    expect(sheet.printed[0].w).toBeCloseTo(100, 5);
    expect(sheet.printed[1]).toMatchObject({ w: 149.1, h: 50 });
  });
});

describe("pageDimensions", () => {
  it("returns portrait dimensions as-is and swaps for landscape", () => {
    expect(pageDimensions("A4", "portrait")).toEqual({ width: 210, height: 297 });
    expect(pageDimensions("A4", "landscape")).toEqual({ width: 297, height: 210 });
    expect(pageDimensions("A5", "portrait")).toEqual({ width: 148, height: 210 });
  });
});

describe("planLabelGrid", () => {
  it("tiles a 50x30 label on A4 portrait with 8mm margin and 4mm gap", () => {
    const plan = planLabelGrid({
      page: { width: 210, height: 297 },
      labelW: 50,
      labelH: 30,
      margin: 8,
      gap: 4,
    });
    expect(plan).toEqual({ cols: 3, rows: 8, perPage: 24 });
  });

  it("fits fewer on A5 portrait", () => {
    const plan = planLabelGrid({
      page: { width: 148, height: 210 },
      labelW: 50,
      labelH: 30,
      margin: 8,
      gap: 4,
    });
    expect(plan).toEqual({ cols: 2, rows: 5, perPage: 10 });
  });

  it("returns zero when the label is wider than the usable page", () => {
    const plan = planLabelGrid({
      page: { width: 210, height: 297 },
      labelW: 300,
      labelH: 30,
      margin: 8,
      gap: 4,
    });
    expect(plan.cols).toBe(0);
    expect(plan.perPage).toBe(0);
  });
});

describe("planSheet", () => {
  it("tiles a single product across one page", () => {
    const plan = planSheet({ items: [{ w: 50, h: 30, amount: 24 }], page: A4, margin: 8, gap: 4 });
    expect(plan.pages).toBe(1);
    expect(plan.placements).toHaveLength(24);
    expect(plan.placements[0]).toMatchObject({ index: 0, page: 0, x: 8, y: 8 });
    // 3 cols, so the 4th label wraps to the second row
    expect(plan.placements[3]).toMatchObject({ index: 0, page: 0, x: 8, y: 42 });
  });

  it("starts the next product on a fresh row below the previous one", () => {
    const plan = planSheet({
      items: [
        { w: 50, h: 30, amount: 6 },
        { w: 50, h: 30, amount: 6 },
      ],
      page: A4,
      margin: 8,
      gap: 4,
    });
    // product 0 takes rows at y=8 and y=42; product 1 begins at y=76
    expect(plan.placements.find((p) => p.index === 1)).toMatchObject({ page: 0, x: 8, y: 76 });
  });

  it("flows onto a second page when the column is full", () => {
    const plan = planSheet({ items: [{ w: 50, h: 30, amount: 30 }], page: A4, margin: 8, gap: 4 });
    expect(plan.pages).toBe(2);
    expect(plan.placements[24]).toMatchObject({ index: 0, page: 1, x: 8, y: 8 });
  });
});
