import { describe, it, expect } from "vitest";
import {
  rangeFor,
  summarize,
  totalChannelSales,
  toDateInputValue,
  matchesSalesSearch,
  salesView,
  growthRatePct,
  type SaleLike,
} from "./salesSummary";

describe("growthRatePct", () => {
  it("computes percent change vs the previous period", () => {
    expect(growthRatePct(150, 100)).toBe(50);
    expect(growthRatePct(50, 100)).toBe(-50);
    expect(growthRatePct(100, 100)).toBe(0);
  });

  it("returns 0 when both are zero", () => {
    expect(growthRatePct(0, 0)).toBe(0);
  });

  it("returns null when there is no baseline (previous 0, current > 0)", () => {
    expect(growthRatePct(100, 0)).toBeNull();
  });
});

const searchable = (over = {}) => ({
  saleNumber: "DAS202607-01001",
  vehicle: "Toyota Vigo",
  licensePlate: "1กก1234",
  grandTotalSatang: 470000,
  saleStatus: "completed",
  ...over,
});

describe("matchesSalesSearch", () => {
  it("empty query matches everything", () => {
    expect(matchesSalesSearch(searchable(), "")).toBe(true);
    expect(matchesSalesSearch(searchable(), "  ")).toBe(true);
  });

  it("matches bill ID, car model, and plate (case-insensitive)", () => {
    expect(matchesSalesSearch(searchable(), "01001")).toBe(true);
    expect(matchesSalesSearch(searchable(), "vigo")).toBe(true);
    expect(matchesSalesSearch(searchable(), "1กก")).toBe(true);
  });

  it("matches the paid amount in baht", () => {
    expect(matchesSalesSearch(searchable(), "4700")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(matchesSalesSearch(searchable(), "honda")).toBe(false);
  });
});

describe("salesView", () => {
  const a = searchable({ saleNumber: "A", vehicle: "Toyota", saleStatus: "completed" });
  const b = searchable({ saleNumber: "B", vehicle: "Honda", saleStatus: "refunded" });

  it("filters by search text", () => {
    expect(salesView([a, b], { search: "honda", status: "" })).toEqual([b]);
  });

  it("filters by status", () => {
    expect(salesView([a, b], { search: "", status: "refunded" })).toEqual([b]);
  });

  it("empty status keeps everything (search-only)", () => {
    expect(salesView([a, b], { search: "", status: "" })).toEqual([a, b]);
  });

  it("combines search and status", () => {
    expect(salesView([a, b], { search: "honda", status: "completed" })).toEqual([]);
  });

  it("filters by type (Products = parts / Service = repair); empty keeps all", () => {
    const p = searchable({ saleNumber: "P", saleType: "parts" });
    const s = searchable({ saleNumber: "S", saleType: "repair" });
    expect(salesView([p, s], { search: "", status: "", type: "parts" })).toEqual([p]);
    expect(salesView([p, s], { search: "", status: "", type: "repair" })).toEqual([s]);
    expect(salesView([p, s], { search: "", status: "", type: "" })).toEqual([p, s]);
  });
});

describe("toDateInputValue", () => {
  it("formats a timestamp as local YYYY-MM-DD", () => {
    expect(toDateInputValue(new Date(2026, 6, 3, 14, 30).getTime())).toBe("2026-07-03");
  });

  it("zero-pads single-digit month and day", () => {
    expect(toDateInputValue(new Date(2026, 0, 5).getTime())).toBe("2026-01-05");
  });
});

describe("totalChannelSales", () => {
  it("sums count and revenue across channels", () => {
    const rows = [
      { key: "onsite", label: "Onsite", count: 3, revenueSatang: 30000 },
      { key: "shopee", label: "Shopee", count: 2, revenueSatang: 20000 },
      { key: "airplus", label: "AirPlus", count: 0, revenueSatang: 0 },
    ];
    expect(totalChannelSales(rows)).toEqual({ count: 5, revenueSatang: 50000 });
  });

  it("given no channels > returns zeros", () => {
    expect(totalChannelSales([])).toEqual({ count: 0, revenueSatang: 0 });
  });
});

/** Build a local-time timestamp (month is 0-based), so expectations are timezone-independent. */
const ts = (y: number, m: number, d: number, h = 0, mi = 0) =>
  new Date(y, m, d, h, mi, 0, 0).getTime();

const DAY = 24 * 60 * 60 * 1000;

// Wednesday, 17 June 2026, 14:30 local.
const NOW = ts(2026, 5, 17, 14, 30);

describe("rangeFor", () => {
  it("given today > returns local midnight to next midnight", () => {
    const r = rangeFor("today", NOW);
    expect(r.startMs).toBe(ts(2026, 5, 17));
    expect(r.endMs).toBe(ts(2026, 5, 18));
  });

  it("given thisWeek > spans 7 days from a Sunday midnight containing now", () => {
    const r = rangeFor("thisWeek", NOW);
    const start = new Date(r.startMs);
    expect(start.getDay()).toBe(0); // Sunday
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(r.endMs - r.startMs).toBe(7 * DAY);
    expect(r.startMs).toBeLessThanOrEqual(NOW);
    expect(NOW).toBeLessThan(r.endMs);
  });

  it("given lastWeek > is the 7 days immediately before thisWeek", () => {
    const tw = rangeFor("thisWeek", NOW);
    const lw = rangeFor("lastWeek", NOW);
    expect(lw.endMs).toBe(tw.startMs);
    expect(tw.startMs - lw.startMs).toBe(7 * DAY);
  });

  it("given thisMonth > spans the 1st of this month to the 1st of next", () => {
    const r = rangeFor("thisMonth", NOW);
    expect(r.startMs).toBe(ts(2026, 5, 1));
    expect(r.endMs).toBe(ts(2026, 6, 1));
  });

  it("given lastMonth > spans the 1st of last month to the 1st of this month", () => {
    const r = rangeFor("lastMonth", NOW);
    expect(r.startMs).toBe(ts(2026, 4, 1));
    expect(r.endMs).toBe(ts(2026, 5, 1));
  });

  it("given custom with start and end > covers whole days inclusive of the end date", () => {
    const r = rangeFor("custom", NOW, { start: "2026-06-10", end: "2026-06-12" });
    expect(r.startMs).toBe(ts(2026, 5, 10));
    expect(r.endMs).toBe(ts(2026, 5, 13)); // +1 day so the 12th is fully included
  });
});

describe("summarize", () => {
  const sale = (over: Partial<SaleLike>): SaleLike => ({
    createdAt: ts(2026, 5, 17, 12),
    grandTotalSatang: 0,
    taxTotalSatang: 0,
    grossProfitSatang: 0,
    saleStatus: "completed",
    ...over,
  });

  const range = { startMs: ts(2026, 5, 15), endMs: ts(2026, 5, 22) };

  it("given completed and refunded sales in range > totals completed and splits out refunds", () => {
    const sales: SaleLike[] = [
      sale({ grandTotalSatang: 10000, taxTotalSatang: 654, grossProfitSatang: 3000 }),
      sale({ grandTotalSatang: 20000, taxTotalSatang: 1308, grossProfitSatang: 5000 }),
      sale({
        grandTotalSatang: 5000,
        taxTotalSatang: 327,
        grossProfitSatang: 1500,
        saleStatus: "refunded",
      }),
    ];
    const s = summarize(sales, range);
    expect(s.salesCount).toBe(2); // completed only
    expect(s.revenueSatang).toBe(30000);
    expect(s.vatSatang).toBe(1962);
    expect(s.grossProfitSatang).toBe(8000);
    expect(s.refundCount).toBe(1);
    expect(s.refundedSatang).toBe(5000);
  });

  it("given a sale outside the range > excludes it from every total", () => {
    const sales: SaleLike[] = [
      sale({ createdAt: ts(2026, 5, 1), grandTotalSatang: 99999 }), // before start
      sale({ createdAt: ts(2026, 5, 17), grandTotalSatang: 10000, grossProfitSatang: 2000 }),
    ];
    const s = summarize(sales, range);
    expect(s.salesCount).toBe(1);
    expect(s.revenueSatang).toBe(10000);
    expect(s.grossProfitSatang).toBe(2000);
  });

  it("given the half-open boundary > includes startMs and excludes endMs", () => {
    const sales: SaleLike[] = [
      sale({ createdAt: range.startMs, grandTotalSatang: 100 }),
      sale({ createdAt: range.endMs, grandTotalSatang: 200 }),
    ];
    const s = summarize(sales, range);
    expect(s.salesCount).toBe(1);
    expect(s.revenueSatang).toBe(100);
  });
});
