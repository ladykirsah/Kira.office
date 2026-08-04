import { describe, it, expect } from "vitest";
import {
  INSIGHT_PERIODS,
  bangkokDayStart,
  comparisonWindow,
  granularityFor,
  insightWindow,
  pctChange,
  seriesBuckets,
  bucketIndexFor,
  METRICS,
  metricValues,
  trafficSource,
} from "./insights";

/** Bangkok wall-clock → epoch ms, so every expectation reads as the owner's clock. */
function bkk(s: string): number {
  return Date.parse(`${s}+07:00`);
}

/** 18:00 Bangkok on 4 Aug 2026 — the moment the owner's Shopee screenshots were taken. */
const NOW = bkk("2026-08-04T18:00:00");

describe("bangkokDayStart", () => {
  it("given a mid-afternoon instant > then returns that Bangkok day's midnight", () => {
    expect(bangkokDayStart(NOW)).toBe(bkk("2026-08-04T00:00:00"));
  });

  it("given 01:00 Bangkok > then stays on the Bangkok day, not the UTC one", () => {
    // 01:00 Bangkok is still 18:00 UTC the PREVIOUS day. A UTC-based day start would push this
    // instant into the day before and hide every order taken between midnight and 07:00.
    expect(bangkokDayStart(bkk("2026-08-04T01:00:00"))).toBe(bkk("2026-08-04T00:00:00"));
  });

  it("given midnight exactly > then returns that same instant", () => {
    const midnight = bkk("2026-08-04T00:00:00");
    expect(bangkokDayStart(midnight)).toBe(midnight);
  });
});

describe("insightWindow", () => {
  it("given realtime > then runs from Bangkok midnight today to now", () => {
    expect(insightWindow("realtime", NOW)).toEqual({
      start: bkk("2026-08-04T00:00:00"),
      end: NOW,
    });
  });

  it("given yesterday > then covers the whole previous Bangkok day", () => {
    expect(insightWindow("yesterday", NOW)).toEqual({
      start: bkk("2026-08-03T00:00:00"),
      end: bkk("2026-08-04T00:00:00"),
    });
  });

  it("given 7d > then covers the seven COMPLETE days before today", () => {
    // Today is deliberately excluded: a part-day would sit next to six full ones on the chart and
    // always read as a collapse.
    expect(insightWindow("7d", NOW)).toEqual({
      start: bkk("2026-07-28T00:00:00"),
      end: bkk("2026-08-04T00:00:00"),
    });
  });

  it("given 30d > then covers the thirty complete days before today", () => {
    expect(insightWindow("30d", NOW)).toEqual({
      start: bkk("2026-07-05T00:00:00"),
      end: bkk("2026-08-04T00:00:00"),
    });
  });

  it("given month > then runs from the 1st of this Bangkok month to now", () => {
    expect(insightWindow("month", NOW)).toEqual({
      start: bkk("2026-08-01T00:00:00"),
      end: NOW,
    });
  });

  it("given every preset > then start is never after end", () => {
    for (const p of INSIGHT_PERIODS) {
      const w = insightWindow(p, NOW);
      expect(w.end).toBeGreaterThan(w.start);
    }
  });
});

describe("comparisonWindow", () => {
  it("given realtime at 18:00 > then compares against 00:00-18:00 YESTERDAY", () => {
    // The detail that makes Shopee's "▼64.00% เทียบกับ 00:00-18:00 ของเมื่อวาน" honest: a part-day
    // is compared against the same part of the previous day, never against a whole one.
    expect(comparisonWindow("realtime", NOW)).toEqual({
      start: bkk("2026-08-03T00:00:00"),
      end: bkk("2026-08-03T18:00:00"),
    });
  });

  it("given yesterday > then compares against the day before that", () => {
    expect(comparisonWindow("yesterday", NOW)).toEqual({
      start: bkk("2026-08-02T00:00:00"),
      end: bkk("2026-08-03T00:00:00"),
    });
  });

  it("given 7d > then compares against the seven days immediately before the window", () => {
    expect(comparisonWindow("7d", NOW)).toEqual({
      start: bkk("2026-07-21T00:00:00"),
      end: bkk("2026-07-28T00:00:00"),
    });
  });

  it("given month > then compares against the same elapsed span of last month", () => {
    // 4 Aug 18:00 is 3 days 18h into August, so the base is 1 Jul 00:00 → 4 Jul 18:00.
    expect(comparisonWindow("month", NOW)).toEqual({
      start: bkk("2026-07-01T00:00:00"),
      end: bkk("2026-07-04T18:00:00"),
    });
  });

  it("given a month-to-date longer than the whole previous month > then stops at this month's 1st", () => {
    // 31 Mar: 30 days elapsed, but February has only 28. Without a clamp the base window would run
    // into March and count the current month's own sales as its own baseline.
    const mar31 = bkk("2026-03-31T12:00:00");
    expect(comparisonWindow("month", mar31)).toEqual({
      start: bkk("2026-02-01T00:00:00"),
      end: bkk("2026-03-01T00:00:00"),
    });
  });

  it("given every preset > then the comparison ends no later than the window starts", () => {
    for (const p of INSIGHT_PERIODS) {
      expect(comparisonWindow(p, NOW).end).toBeLessThanOrEqual(insightWindow(p, NOW).start);
    }
  });
});

describe("granularityFor", () => {
  it("given a single-day preset > then buckets by hour", () => {
    expect(granularityFor("realtime")).toBe("hour");
    expect(granularityFor("yesterday")).toBe("hour");
  });

  it("given a multi-day preset > then buckets by day", () => {
    expect(granularityFor("7d")).toBe("day");
    expect(granularityFor("30d")).toBe("day");
    expect(granularityFor("month")).toBe("day");
  });
});

describe("seriesBuckets", () => {
  it("given a realtime window > then gives all 24 hours of the day, not just the elapsed ones", () => {
    // Shopee's chart draws the full 00:00-23:59 axis and leaves the future flat, so the line's
    // shape doesn't jump around as the day fills in.
    const buckets = seriesBuckets("realtime", NOW);
    expect(buckets).toHaveLength(24);
    expect(buckets[0]).toBe(bkk("2026-08-04T00:00:00"));
    expect(buckets[23]).toBe(bkk("2026-08-04T23:00:00"));
  });

  it("given a 7d window > then gives one bucket per complete day", () => {
    const buckets = seriesBuckets("7d", NOW);
    expect(buckets).toHaveLength(7);
    expect(buckets[0]).toBe(bkk("2026-07-28T00:00:00"));
    expect(buckets[6]).toBe(bkk("2026-08-03T00:00:00"));
  });

  it("given a month-to-date window > then covers every day so far including today", () => {
    const buckets = seriesBuckets("month", NOW);
    expect(buckets).toHaveLength(4);
    expect(buckets[3]).toBe(bkk("2026-08-04T00:00:00"));
  });
});

describe("bucketIndexFor", () => {
  it("given an event at 13:20 in a realtime window > then lands in the 13:00 bucket", () => {
    expect(bucketIndexFor(bkk("2026-08-04T13:20:00"), "realtime", NOW)).toBe(13);
  });

  it("given an event on the third day of a 7d window > then lands in bucket 2", () => {
    expect(bucketIndexFor(bkk("2026-07-30T09:00:00"), "7d", NOW)).toBe(2);
  });

  it("given an event outside the window > then returns null so it is dropped, not clamped", () => {
    // Clamping would pile every older order onto bucket 0 and invent a spike on the left edge.
    expect(bucketIndexFor(bkk("2026-07-01T09:00:00"), "7d", NOW)).toBeNull();
    expect(bucketIndexFor(bkk("2026-08-04T09:00:00"), "7d", NOW)).toBeNull();
  });
});

describe("pctChange", () => {
  it("given a fall from 1250 to 450 > then reports Shopee's -64.00%", () => {
    expect(pctChange(450, 1250)).toBeCloseTo(-64, 5);
  });

  it("given no change > then reports exactly 0", () => {
    expect(pctChange(1, 1)).toBe(0);
  });

  it("given a zero base > then returns null rather than infinity", () => {
    // The first sale ever is not an "infinite % rise"; the card shows an em dash instead.
    expect(pctChange(450, 0)).toBeNull();
  });

  it("given zero on both sides > then returns null, not 0%", () => {
    // "0% change" would claim we measured something; nothing happened in either window.
    expect(pctChange(0, 0)).toBeNull();
  });
});

describe("trafficSource", () => {
  const ORIGIN = "https://airplusauto.com";

  it("given no referrer > then direct", () => {
    expect(trafficSource("", ORIGIN)).toBe("direct");
    expect(trafficSource(null, ORIGIN)).toBe("direct");
  });

  it("given our own pages > then internal, not a source", () => {
    // Someone moving from the home page to a PDP is navigation, not an arrival. Counting it as a
    // referral would make the site its own biggest traffic source.
    expect(trafficSource("https://airplusauto.com/products/x", ORIGIN)).toBe("internal");
  });

  it("given a search engine > then search", () => {
    expect(trafficSource("https://www.google.com/", ORIGIN)).toBe("search");
    expect(
      trafficSource("https://www.google.co.th/search?q=%E0%B9%81%E0%B8%AD%E0%B8%A3", ORIGIN),
    ).toBe("search");
    expect(trafficSource("https://www.bing.com/search?q=airplus", ORIGIN)).toBe("search");
  });

  it("given a social app > then social", () => {
    expect(trafficSource("https://m.facebook.com/", ORIGIN)).toBe("social");
    expect(trafficSource("https://line.me/R/", ORIGIN)).toBe("social");
    expect(trafficSource("https://www.tiktok.com/@x", ORIGIN)).toBe("social");
  });

  it("given an AI assistant > then ai", () => {
    // AirPlus publishes /llms.txt and /skills.md specifically to be readable by assistants, so
    // arrivals from them are the one traffic bucket worth watching separately.
    expect(trafficSource("https://chatgpt.com/", ORIGIN)).toBe("ai");
    expect(trafficSource("https://www.perplexity.ai/search", ORIGIN)).toBe("ai");
    expect(trafficSource("https://claude.ai/chat/abc", ORIGIN)).toBe("ai");
  });

  it("given any other site > then referral", () => {
    expect(trafficSource("https://pantip.com/topic/1", ORIGIN)).toBe("referral");
  });

  it("given a malformed referrer > then direct rather than a throw", () => {
    // A junk Referer header must never 500 the beacon; the visit still counts, just unattributed.
    expect(trafficSource("not a url", ORIGIN)).toBe("direct");
  });
});

describe("metricValues", () => {
  const TOTALS = {
    salesSatang: 45000,
    profitSatang: 12000,
    orders: 1,
    buyers: 1,
    units: 1,
    visitors: 19,
    productViews: 546,
    clicks: 18,
    addToCartVisitors: 2,
  };

  it("given the shop's own numbers > then reproduces Shopee's derived rates", () => {
    const m = metricValues(TOTALS);
    expect(m.sales).toBe(45000);
    expect(m.orders).toBe(1);
    expect(m.aov).toBe(45000);
    expect(m.salesPerBuyer).toBe(45000);
    // 1 buyer / 19 visitors — Shopee's อัตราการซื้อสินค้า 5.26%.
    expect(m.conversionRate).toBeCloseTo(5.26, 2);
  });

  it("given a margin > then reports profit as a percentage of sales", () => {
    // The number Shopee structurally cannot show, because it does not know our cost.
    expect(metricValues(TOTALS).margin).toBeCloseTo(26.67, 2);
  });

  it("given zero visitors or orders > then rates are 0, never NaN or Infinity", () => {
    const m = metricValues({ ...TOTALS, orders: 0, buyers: 0, visitors: 0, salesSatang: 0 });
    for (const key of [
      "aov",
      "salesPerBuyer",
      "conversionRate",
      "addToCartRate",
      "margin",
    ] as const) {
      expect(Number.isFinite(m[key])).toBe(true);
      expect(m[key]).toBe(0);
    }
  });
});

describe("METRICS catalogue", () => {
  it("given every metric > then metricValues returns a finite number for it", () => {
    // Guards the UI: a tile whose key has no value renders "undefined".
    const m = metricValues({
      salesSatang: 1,
      profitSatang: 1,
      orders: 1,
      buyers: 1,
      units: 1,
      visitors: 1,
      productViews: 1,
      clicks: 1,
      addToCartVisitors: 1,
    });
    for (const def of METRICS) expect(Number.isFinite(m[def.key])).toBe(true);
  });

  it("given a rate metric > then it is marked derived so no caller sums it per bucket", () => {
    // Averaging hourly conversion rates gives a different (wrong) answer from computing the rate
    // over the day's totals. The flag is what stops a chart from doing that.
    for (const key of [
      "aov",
      "salesPerBuyer",
      "conversionRate",
      "addToCartRate",
      "margin",
    ] as const) {
      expect(METRICS.find((d) => d.key === key)?.derived).toBe(true);
    }
    expect(METRICS.find((d) => d.key === "sales")?.derived).toBeFalsy();
  });

  it("given the twin heroes > then sales and profit lead the money group", () => {
    // Owner's call, 4 Aug 2026: sales AND profit, equal weight, at the front.
    const money = METRICS.filter((d) => d.group === "money");
    expect(money.slice(0, 2).map((d) => d.key)).toEqual(["sales", "profit"]);
  });
});
