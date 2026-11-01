import { describe, expect, it } from "vitest";
import {
  axisTicks,
  bucketLabel,
  chartGeometry,
  nearestBucket,
  niceMax,
  seriesScales,
  shownBuckets,
} from "./insightChart";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const bkk = (s: string) => Date.parse(`${s}+07:00`);
const hours = (from: string) => Array.from({ length: 24 }, (_, i) => bkk(from) + i * HOUR);
const days = (from: string, n: number) => Array.from({ length: n }, (_, i) => bkk(from) + i * DAY);

describe("niceMax", () => {
  it("given all zeros > then 1, so the chart still has a scale to divide by", () => {
    expect(niceMax([0, 0, 0])).toBe(1);
  });

  it("given values > then a round number at or above the largest", () => {
    expect(niceMax([0, 345000, 120000])).toBe(400000);
  });

  it("given an empty series > then 1 rather than -Infinity", () => {
    expect(niceMax([])).toBe(1);
  });
});

describe("chartGeometry", () => {
  const BOX = { width: 600, height: 160 };

  it("given a series > then one point per value, spanning the full width", () => {
    const g = chartGeometry([0, 10, 5], 10, BOX);
    expect(g.points.map((p) => p.x)).toEqual([0, 300, 600]);
  });

  it("given the largest value > then it sits at the top of the box, not off it", () => {
    const g = chartGeometry([0, 10], 10, BOX);
    expect(g.points.map((p) => p.y)).toEqual([160, 0]);
  });

  it("given any series > then the paths contain no NaN (one NaN blanks the whole graph)", () => {
    for (const values of [[0, 0], [5], [], [1, 2, 3]]) {
      const g = chartGeometry(values, niceMax(values), BOX, "smooth");
      expect(g.line).not.toContain("NaN");
      expect(g.area).not.toContain("NaN");
    }
  });

  it("given a single point > then it is drawn in the middle instead of dividing by zero", () => {
    expect(chartGeometry([7], 10, BOX).points).toEqual([{ x: 300, y: 48 }]);
  });

  it("given straight lines > then M…L through the points", () => {
    expect(chartGeometry([0, 10], 10, BOX).line).toBe("M0 160 L600 0");
  });

  it("given smooth > then a spike between two empty hours never dips under the baseline", () => {
    const g = chartGeometry([0, 0, 10, 0, 0], 10, BOX, "smooth");
    const ys = [...g.line.matchAll(/[-\d.]+ ([-\d.]+)/g)].map((m) => Number(m[1]));
    expect(g.line).toContain("C");
    expect(Math.max(...ys)).toBeLessThanOrEqual(160.001);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-0.001);
  });

  it("given smooth > then a quiet stretch stays flat and the area closes", () => {
    const g = chartGeometry([0, 0, 0, 0], 10, BOX, "smooth");
    const ys = [...g.line.matchAll(/[-\d.]+ ([-\d.]+)/g)].map((m) => Number(m[1]));
    expect(new Set(ys.map((y) => y.toFixed(3))).size).toBe(1);
    expect(g.area.endsWith("Z")).toBe(true);
  });
});

describe("seriesScales", () => {
  it("given two money lines > then one shared scale, so profit can never out-peak sales", () => {
    const scales = seriesScales([
      { format: "money", values: [0, 345000] },
      { format: "money", values: [0, 105000] },
    ]);
    expect(scales).toEqual([400000, 400000]);
  });

  it("given money and a headcount > then each keeps its own scale", () => {
    const scales = seriesScales([
      { format: "money", values: [0, 345000] },
      { format: "count", values: [0, 28] },
    ]);
    expect(scales).toEqual([400000, 30]);
  });

  it("given no lines > then no scales", () => {
    expect(seriesScales([])).toEqual([]);
  });
});

describe("shownBuckets", () => {
  it("given วันนี้ at 14:30 > then the hours up to now (00:00–14:00), not the empty rest of the day", () => {
    const b = hours("2026-11-01T00:00:00");
    expect(shownBuckets("realtime", b, bkk("2026-11-01T14:30:00"))).toBe(15);
  });

  it("given just after midnight > then the first hour still shows", () => {
    const b = hours("2026-11-01T00:00:00");
    expect(shownBuckets("realtime", b, bkk("2026-11-01T00:05:00"))).toBe(1);
  });

  it("given any other period > then every bucket", () => {
    expect(
      shownBuckets("yesterday", hours("2026-10-31T00:00:00"), bkk("2026-11-01T14:30:00")),
    ).toBe(24);
    expect(shownBuckets("30d", days("2026-10-02T00:00:00", 30), Date.now())).toBe(30);
  });
});

describe("axisTicks", () => {
  it("given today up to 14:00 > then 00:00 · 06:00 · 12:00 and the last hour, as drawn", () => {
    const b = hours("2026-11-01T00:00:00").slice(0, 15);
    expect(axisTicks(b, "hour").map((t) => t.label.th)).toEqual([
      "00:00",
      "06:00",
      "12:00",
      "14:00",
    ]);
    expect(axisTicks(b, "hour").map((t) => t.position)).toEqual([0, 6 / 14, 12 / 14, 1]);
  });

  it("given the last hour right next to a label > then it is left out so the two never overlap", () => {
    const b = hours("2026-11-01T00:00:00").slice(0, 14);
    expect(axisTicks(b, "hour").map((t) => t.label.th)).toEqual(["00:00", "06:00", "12:00"]);
  });

  it("given a whole day > then 00:00 · 06:00 · 12:00 · 18:00 · 23:00", () => {
    expect(axisTicks(hours("2026-10-31T00:00:00"), "hour").map((t) => t.label.th)).toEqual([
      "00:00",
      "06:00",
      "12:00",
      "18:00",
      "23:00",
    ]);
  });

  it("given 30 days in one month > then four days, the month named on the first only", () => {
    const ticks = axisTicks(days("2026-10-01T00:00:00", 30), "day");
    expect(ticks.map((t) => t.label.th)).toEqual(["1 ต.ค.", "10", "20", "30"]);
    expect(ticks.map((t) => t.label.en)).toEqual(["1 Oct", "10", "20", "30"]);
    expect(ticks.map((t) => t.position)).toEqual([0, 9 / 29, 19 / 29, 1]);
  });

  it("given days across two months > then the new month is named where it starts", () => {
    const ticks = axisTicks(days("2026-10-02T00:00:00", 30), "day");
    expect(ticks.map((t) => t.label.th)).toEqual(["2 ต.ค.", "11", "21", "31"]);
    const across = axisTicks(days("2026-10-26T00:00:00", 7), "day");
    expect(across.map((t) => t.label.th)).toEqual(["26 ต.ค.", "28", "30", "1 พ.ย."]);
  });

  it("given one day > then one label in the middle", () => {
    expect(axisTicks(days("2026-11-01T00:00:00", 1), "day")).toEqual([
      { position: 0.5, label: { th: "1 พ.ย.", en: "1 Nov" } },
    ]);
  });

  it("given no buckets > then no labels rather than a crash", () => {
    expect(axisTicks([], "hour")).toEqual([]);
  });
});

describe("bucketLabel", () => {
  it("given an hour > then its span, as on the drawing's tap (11:00–12:00)", () => {
    expect(bucketLabel(bkk("2026-11-01T11:00:00"), "hour")).toEqual({
      th: "11:00–12:00",
      en: "11:00–12:00",
    });
    expect(bucketLabel(bkk("2026-11-01T23:00:00"), "hour").th).toBe("23:00–24:00");
  });

  it("given a day > then the day and month", () => {
    expect(bucketLabel(bkk("2026-10-12T00:00:00"), "day")).toEqual({ th: "12 ต.ค.", en: "12 Oct" });
  });
});

describe("nearestBucket", () => {
  it("given a tap > then the closest point, never past either end", () => {
    expect(nearestBucket(0, 300, 15)).toBe(0);
    expect(nearestBucket(160, 300, 15)).toBe(7);
    expect(nearestBucket(299, 300, 15)).toBe(14);
    expect(nearestBucket(-20, 300, 15)).toBe(0);
    expect(nearestBucket(400, 300, 15)).toBe(14);
  });

  it("given a single point > then that point", () => {
    expect(nearestBucket(10, 300, 1)).toBe(0);
  });
});
