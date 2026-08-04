import { describe, it, expect } from "vitest";
import {
  axisTicks,
  chartGeometry,
  formatMetric,
  niceMax,
  deltaLabel,
  seriesScales,
} from "./insightChart";

describe("formatMetric", () => {
  it("given money > then baht with thousands separators and no dead decimals", () => {
    expect(formatMetric(45000, "money")).toBe("฿450");
    expect(formatMetric(125050, "money")).toBe("฿1,250.5");
  });

  it("given a count > then grouped digits", () => {
    expect(formatMetric(1234, "count")).toBe("1,234");
  });

  it("given a percent > then two decimals, matching Shopee's precision", () => {
    expect(formatMetric(5.263, "percent")).toBe("5.26%");
  });

  it("given a fractional count > then rounds, because half a visitor is not a thing", () => {
    expect(formatMetric(2.6, "count")).toBe("3");
  });
});

describe("deltaLabel", () => {
  it("given a fall > then a down arrow and the magnitude", () => {
    expect(deltaLabel(-64)).toEqual({ text: "▼64.00%", tone: "down" });
  });

  it("given a rise > then an up arrow", () => {
    expect(deltaLabel(12.5)).toEqual({ text: "▲12.50%", tone: "up" });
  });

  it("given no change > then a flat 0.00% with no arrow", () => {
    expect(deltaLabel(0)).toEqual({ text: "0.00%", tone: "flat" });
  });

  it("given null > then an em dash, because there was nothing to compare against", () => {
    expect(deltaLabel(null)).toEqual({ text: "—", tone: "flat" });
  });
});

describe("niceMax", () => {
  it("given all zeros > then 1, so the chart still has a scale to divide by", () => {
    // A zero denominator would make every y coordinate NaN and the whole SVG disappear.
    expect(niceMax([0, 0, 0])).toBe(1);
  });

  it("given values > then a round number at or above the largest", () => {
    expect(niceMax([0, 45000, 12000])).toBeGreaterThanOrEqual(45000);
  });

  it("given an empty series > then 1 rather than -Infinity", () => {
    expect(niceMax([])).toBe(1);
  });
});

describe("chartGeometry", () => {
  const BOX = { width: 600, height: 160 };

  it("given a series > then one point per value, spanning the full width", () => {
    const g = chartGeometry([0, 10, 5], niceMax([0, 10, 5]), BOX);
    expect(g.points).toHaveLength(3);
    expect(g.points[0]?.x).toBe(0);
    expect(g.points[2]?.x).toBe(600);
  });

  it("given the largest value > then it sits at the top of the box, not off it", () => {
    const g = chartGeometry([0, 10], 10, BOX);
    expect(g.points[1]?.y).toBe(0);
    expect(g.points[0]?.y).toBe(160);
  });

  it("given any series > then the path strings contain no NaN", () => {
    // The failure mode that silently blanks an SVG: one NaN anywhere voids the whole path.
    for (const values of [[0, 0], [5], [], [1, 2, 3]]) {
      const g = chartGeometry(values, niceMax(values), BOX);
      expect(g.line).not.toContain("NaN");
      expect(g.area).not.toContain("NaN");
    }
  });

  it("given a single point > then it still draws, centred rather than dividing by zero", () => {
    const g = chartGeometry([7], 10, BOX);
    expect(g.points).toHaveLength(1);
    expect(Number.isFinite(g.points[0]?.x)).toBe(true);
  });

  it("given an empty series > then empty paths and no points", () => {
    const g = chartGeometry([], 1, BOX);
    expect(g.points).toEqual([]);
    expect(g.line).toBe("");
  });
});

describe("axisTicks", () => {
  const bkk = (s: string) => Date.parse(`${s}+07:00`);

  it("given 24 hourly buckets > then Shopee's sparse 00:00 / 06:00 / 12:00 / 18:00 axis", () => {
    const buckets = Array.from({ length: 24 }, (_, i) => bkk("2026-08-04T00:00:00") + i * 3600000);
    expect(axisTicks(buckets, "hour").map((t) => t.label)).toEqual([
      "00:00",
      "06:00",
      "12:00",
      "18:00",
    ]);
  });

  it("given daily buckets > then day/month labels at the ends", () => {
    const buckets = [bkk("2026-07-28T00:00:00"), bkk("2026-08-03T00:00:00")];
    expect(axisTicks(buckets, "day").map((t) => t.label)).toEqual(["28/7", "3/8"]);
  });

  it("given no buckets > then no ticks rather than a crash", () => {
    expect(axisTicks([], "day")).toEqual([]);
  });
});

describe("seriesScales", () => {
  it("given two money series > then ONE shared scale, so profit cannot out-peak sales", () => {
    // The bug this exists to prevent: with independent scales, ฿420 of profit and ฿1,350 of sales
    // both touch the top of the box, and the chart says profit equalled revenue. Sales and profit
    // are the DEFAULT pair, so this was the first thing anyone would have seen.
    const scales = seriesScales([
      { format: "money", values: [0, 135000] },
      { format: "money", values: [0, 42000] },
    ]);
    expect(scales[0]).toBe(scales[1]);
    expect(scales[0]).toBeGreaterThanOrEqual(135000);
  });

  it("given mixed units > then each series keeps its own scale", () => {
    // Baht against a headcount share no meaningful axis; forcing one would flatten the visitors
    // line onto the baseline and hide the shape that is the whole reason to plot it.
    const scales = seriesScales([
      { format: "money", values: [0, 135000] },
      { format: "count", values: [0, 28] },
    ]);
    expect(scales[0]).not.toBe(scales[1]);
    expect(scales[1]).toBeGreaterThanOrEqual(28);
  });

  it("given one series > then just its own scale", () => {
    expect(seriesScales([{ format: "money", values: [0, 500] }])).toHaveLength(1);
  });

  it("given no series > then no scales rather than a crash", () => {
    expect(seriesScales([])).toEqual([]);
  });
});

describe("chartGeometry > smooth curve (design 5)", () => {
  const BOX = { width: 600, height: 160 };

  it("given smooth > then the path is cubic, not straight segments", () => {
    const g = chartGeometry([0, 10, 4, 8], 10, BOX, "smooth");
    expect(g.line).toContain("C");
    expect(g.line).not.toContain("L0");
  });

  it("given a spike between two empty hours > then the curve NEVER dips below the baseline", () => {
    // The reason this uses monotone interpolation rather than plain Catmull-Rom. A naive smooth
    // overshoots past the points it joins, so 0 → peak → 0 swings below zero — drawing negative
    // sales on a quiet day, which is exactly the shape AirPlus has right now.
    const g = chartGeometry([0, 0, 10, 0, 0], 10, BOX, "smooth");
    const ys = [...g.line.matchAll(/[-\d.]+ ([-\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys)).toBeLessThanOrEqual(BOX.height + 0.001);
  });

  it("given a spike > then the curve never overshoots above the top either", () => {
    const g = chartGeometry([0, 0, 10, 0, 0], 10, BOX, "smooth");
    const ys = [...g.line.matchAll(/[-\d.]+ ([-\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-0.001);
  });

  it("given a flat run > then it stays flat rather than rippling", () => {
    // Twenty-two empty hours must read as a flat line, not a gentle wave suggesting trade.
    const g = chartGeometry([0, 0, 0, 0], 10, BOX, "smooth");
    const ys = [...g.line.matchAll(/[-\d.]+ ([-\d.]+)/g)].map((m) => Number(m[1]));
    expect(new Set(ys.map((y) => y.toFixed(3))).size).toBe(1);
  });

  it("given smooth > then still no NaN, and the area still closes", () => {
    for (const values of [[0, 0], [5], [1, 2, 3], [0, 9, 0]]) {
      const g = chartGeometry(values, niceMax(values), BOX, "smooth");
      expect(g.line).not.toContain("NaN");
      expect(g.area).not.toContain("NaN");
      if (values.length > 1) expect(g.area.endsWith("Z")).toBe(true);
    }
  });

  it("given no curve argument > then it stays the straight-line geometry", () => {
    expect(chartGeometry([0, 10], 10, BOX).line).toBe("M0 160 L600 0");
  });
});
