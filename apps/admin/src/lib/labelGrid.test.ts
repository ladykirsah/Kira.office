import { describe, it, expect } from "vitest";
import { pageDimensions, planLabelGrid } from "./labelGrid";

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
