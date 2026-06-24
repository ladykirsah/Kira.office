import { describe, it, expect } from "vitest";
import { pageDimensions, planLabelGrid, planSheet } from "./labelGrid";

const A4 = { width: 210, height: 297 };

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
