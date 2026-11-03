import { describe, expect, it } from "vitest";
import {
  graphScale,
  graphSeries,
  graphTop,
  graphStarts,
  graphStep,
  graphTicks,
  moneyOf,
  runningTotals,
  stepTitle,
} from "./financeChart";

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();
const NOW = at(2026, 10, 29, 14, 30);
const DAY = 86_400_000;

describe("which graph a period gets (owner, 2 Nov: based on time selection, line graph)", () => {
  it("graphStep > given วันนี้ > then by hour", () => {
    expect(graphStep("today", { from: at(2026, 10, 29), to: NOW + 1 })).toBe("hour");
  });
  it("graphStep > given เดือนนี้ > then the running total against last month", () => {
    expect(graphStep("month", { from: at(2026, 10, 1), to: NOW + 1 })).toBe("running");
  });
  it("graphStep > given 7 days, 30 days or last month > then by day", () => {
    expect(graphStep("7d", { from: NOW - 7 * DAY, to: NOW + 1 })).toBe("day");
    expect(graphStep("30d", { from: NOW - 30 * DAY, to: NOW + 1 })).toBe("day");
    expect(graphStep("lastmonth", { from: at(2026, 9, 1), to: at(2026, 10, 1) })).toBe("day");
  });
  it("graphStep > given ทุกวัน > then by month", () => {
    expect(graphStep("all", { from: 0, to: NOW + 1 })).toBe("month");
  });
  it("graphStep > given กำหนดเอง > then by its length: 1 day, 2 months, 6 months, longer", () => {
    expect(graphStep("custom", { from: at(2026, 10, 5), to: at(2026, 10, 6) })).toBe("hour");
    expect(graphStep("custom", { from: at(2026, 9, 1), to: at(2026, 10, 30) })).toBe("day");
    expect(graphStep("custom", { from: at(2026, 8, 1), to: at(2026, 10, 30) })).toBe("week");
    expect(graphStep("custom", { from: at(2026, 1, 1), to: at(2026, 10, 30) })).toBe("month");
  });
});

describe("the points along the bottom", () => {
  it("graphStarts > given today by hour > then 00:00 up to the hour we are in", () => {
    const starts = graphStarts("hour", { from: at(2026, 10, 29), to: NOW + 1 });
    expect(starts).toHaveLength(15);
    expect(starts[14]).toBe(at(2026, 10, 29, 14));
  });
  it("graphStarts > given a month to date by day > then one point a day", () => {
    const starts = graphStarts("day", { from: at(2026, 10, 1), to: NOW + 1 });
    expect(starts).toHaveLength(29);
    expect(starts[28]).toBe(at(2026, 10, 29));
  });
  it("graphStarts > given 1 Aug – 29 Oct by week > then 13 weeks from 1 Aug", () => {
    const starts = graphStarts("week", { from: at(2026, 8, 1), to: at(2026, 10, 30) });
    expect(starts).toHaveLength(13);
    expect(starts[12]).toBe(at(2026, 10, 24));
  });
  it("graphStarts > given May to now by month > then one point a month", () => {
    const starts = graphStarts("month", { from: at(2026, 5, 3), to: NOW + 1 });
    expect(starts).toEqual([5, 6, 7, 8, 9, 10].map((m) => at(2026, m, 1)));
  });
});

describe("the two lines", () => {
  it("graphSeries > then each point adds its money in, and profit takes off expenses", () => {
    const starts = graphStarts("day", { from: at(2026, 10, 27), to: at(2026, 10, 30) });
    const series = graphSeries(
      [
        { at: at(2026, 10, 27, 9), revenue: 406000, profit: 132000 },
        { at: at(2026, 10, 27, 16), revenue: 89000, profit: 20000 },
        { at: at(2026, 10, 28), revenue: 0, profit: -385000 },
        { at: at(2026, 10, 30, 1), revenue: 999, profit: 999 },
      ],
      starts,
      at(2026, 10, 30),
    );
    expect(series).toEqual({ revenue: [495000, 0, 0], profit: [152000, -385000, 0] });
  });
  it("graphScale > given a loss > then the scale goes below zero as far as it needs", () => {
    expect(
      graphScale([
        [180000, 90000],
        [40000, -38500],
      ]),
    ).toEqual({ min: -40000, max: 200000 });
    expect(graphScale([[180000], [40000]])).toEqual({ min: 0, max: 200000 });
  });
});

describe("the number at the graph's top", () => {
  it("graphTop > given money above zero > then the scale's top", () => {
    expect(graphTop(200000, [[180000], [-38500]])).toBe(200000);
  });
  it("graphTop > given nothing, or only a loss so far > then no number (not ฿0.01)", () => {
    expect(
      graphTop(1, [
        [0, 0],
        [0, 0],
      ]),
    ).toBeNull();
    expect(
      graphTop(1, [
        [0, 0],
        [0, -12000],
      ]),
    ).toBeNull();
  });
});

describe("words on the graph", () => {
  it("stepTitle > then the hour, the day, the week or the month a tap reads", () => {
    expect(stepTitle(at(2026, 10, 29, 11), "hour", NOW + 1).th).toBe("11:00");
    expect(stepTitle(at(2026, 10, 28), "day", NOW + 1).th).toBe("28 ต.ค.");
    expect(stepTitle(at(2026, 10, 22), "week", NOW + 1).th).toBe("22–28 ต.ค.");
    expect(stepTitle(at(2026, 10, 24), "week", at(2026, 10, 30)).th).toBe("24–29 ต.ค.");
    expect(stepTitle(at(2026, 10, 1), "month", NOW + 1).th).toBe("ต.ค. 2569");
  });
  it("graphTicks > given 30 days > then five labels, the ends with their month", () => {
    const starts = graphStarts("day", { from: at(2026, 9, 30), to: NOW + 1 });
    const ticks = graphTicks(starts, "day", NOW);
    expect(ticks.map((t) => t.label.th)).toEqual(["30 ก.ย.", "7", "15", "22", "29 ต.ค."]);
    expect(ticks.map((t) => t.index)).toEqual([0, 7, 15, 22, 29]);
  });
  it("graphTicks > given today by hour and months > then 00:00 … 14:00 and month names", () => {
    const hours = graphStarts("hour", { from: at(2026, 10, 29), to: NOW + 1 });
    expect(graphTicks(hours, "hour", NOW).map((t) => t.label.th)).toEqual([
      "00:00",
      "04:00",
      "07:00",
      "11:00",
      "14:00",
    ]);
    const months = graphStarts("month", { from: at(2025, 12, 1), to: NOW + 1 });
    expect(graphTicks(months, "month", NOW).map((t) => t.label.th)).toEqual([
      "ธ.ค. 68",
      "มี.ค.",
      "พ.ค.",
      "ส.ค.",
      "ต.ค.",
    ]);
  });
});

describe("labels when there are few points", () => {
  it("graphTicks > given seven points or fewer > then every point is named", () => {
    const months = graphStarts("month", { from: at(2026, 6, 1), to: NOW + 1 });
    expect(graphTicks(months, "month", NOW).map((t) => t.label.th)).toEqual([
      "มิ.ย.",
      "ก.ค.",
      "ส.ค.",
      "ก.ย.",
      "ต.ค.",
    ]);
    const week = graphStarts("day", { from: at(2026, 10, 23), to: NOW + 1 });
    expect(graphTicks(week, "day", NOW)).toHaveLength(7);
  });
});

describe("เดือนนี้: added up day by day, against last month", () => {
  it("runningTotals > then this month to today, last month whole, and how far ahead", () => {
    const totals = runningTotals(
      [
        { at: at(2026, 10, 1, 10), revenue: 1000, profit: 0 },
        { at: at(2026, 10, 3, 10), revenue: 500, profit: 0 },
        { at: at(2026, 10, 3), revenue: 0, profit: -200 },
      ],
      [
        { at: at(2026, 9, 2, 10), revenue: 800, profit: 0 },
        { at: at(2026, 9, 30, 10), revenue: 100, profit: 0 },
      ],
      at(2026, 10, 3, 12),
    );
    expect(totals).toEqual({
      days: 31,
      now: [1000, 1000, 1500],
      before: [0, 800, ...Array(27).fill(800), 900],
      ahead: 700,
    });
  });
});

describe("what goes on the graph", () => {
  it("moneyOf > then done bills and money-moved orders in, refunded bills out, expenses as −profit", () => {
    const points = moneyOf(
      [
        {
          createdAt: 1,
          saleStatus: "completed",
          grandTotalSatang: 406000,
          grossProfitSatang: 132000,
        },
        { createdAt: 2, saleStatus: "refunded", grandTotalSatang: 89000, grossProfitSatang: 20000 },
      ],
      [{ at: 3, salesSatang: 353000, profitSatang: 102000 }],
      [{ occurredAt: 4, amountSatang: 385000 }],
    );
    expect(points).toEqual([
      { at: 1, revenue: 406000, profit: 132000 },
      { at: 3, revenue: 353000, profit: 102000 },
      { at: 4, revenue: 0, profit: -385000 },
    ]);
  });
});
