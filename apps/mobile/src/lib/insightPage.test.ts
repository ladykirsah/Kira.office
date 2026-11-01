import type { InsightTotals } from "@l-shopee/core";
import { describe, expect, it } from "vitest";
import {
  LIST_ROWS,
  PERIOD_OPTIONS,
  TILE_LINES,
  changeOf,
  compareLine,
  isQuiet,
  metricLabel,
  quietText,
  sellerLine,
  sellerName,
  sourceShares,
  toggleSeries,
  topSellers,
  valueText,
  type InsightsPayload,
  type ProductInsightRow,
} from "./insightPage";

const bkk = (s: string) => Date.parse(`${s}+07:00`);

const ZERO: InsightTotals = {
  salesSatang: 0,
  profitSatang: 0,
  orders: 0,
  buyers: 0,
  units: 0,
  visitors: 0,
  productViews: 0,
  clicks: 0,
  addToCartVisitors: 0,
  newAccounts: 0,
  failedOrders: 0,
  placedOrders: 0,
};

const product = (over: Partial<ProductInsightRow>): ProductInsightRow => ({
  productId: "p",
  productRef: null,
  name: "คอมเพรสเซอร์ DENSO 10S11C",
  imageKey: null,
  salesSatang: 0,
  profitSatang: 0,
  units: 0,
  views: 0,
  clicks: 0,
  ...over,
});

const payload = (over: Partial<InsightsPayload>): InsightsPayload => ({
  period: "realtime",
  window: { start: 0, end: 1 },
  comparison: { start: 0, end: 1 },
  totals: ZERO,
  previous: ZERO,
  series: { buckets: [], totals: [] },
  sources: [],
  products: [],
  unknownCostOrders: 0,
  ...over,
});

describe("PERIOD_OPTIONS", () => {
  it("given the ▾ menu > then the drawing's five words, วันนี้ first", () => {
    expect(PERIOD_OPTIONS.map((o) => [o.key, o.label.th])).toEqual([
      ["realtime", "วันนี้"],
      ["yesterday", "เมื่อวาน"],
      ["7d", "7 วันล่าสุด"],
      ["30d", "30 วันล่าสุด"],
      ["month", "เดือนนี้"],
    ]);
  });
});

describe("compareLine", () => {
  it("given วันนี้ > then the same hours of yesterday (เทียบกับ 00:00–14:30 ของเมื่อวาน)", () => {
    const line = compareLine("realtime", {
      start: bkk("2026-10-31T00:00:00"),
      end: bkk("2026-10-31T14:30:00"),
    });
    expect(line).toEqual({
      th: "เทียบกับ 00:00–14:30 ของเมื่อวาน",
      en: "Against 00:00–14:30 yesterday",
    });
  });

  it("given the other periods > then what they are measured against", () => {
    const w = { start: 0, end: 1 };
    expect(compareLine("yesterday", w).th).toBe("เทียบกับวันก่อนหน้า");
    expect(compareLine("7d", w).th).toBe("เทียบกับ 7 วันก่อนหน้า");
    expect(compareLine("30d", w).th).toBe("เทียบกับ 30 วันก่อนหน้า");
    expect(compareLine("month", w).th).toBe("เทียบกับช่วงเดียวกันของเดือนที่แล้ว");
  });
});

describe("TILE_LINES and LIST_ROWS", () => {
  it("given the top of the page > then three lines of tiles, as the owner set them", () => {
    expect(TILE_LINES.map((line) => line.map((k) => metricLabel(k).th))).toEqual([
      ["ยอดขาย", "กำไร"],
      ["มองเห็นสินค้า", "ผู้เข้าชม", "เพิ่มลงตะกร้า"],
      ["จำนวนออเดอร์", "เฉลี่ยต่อออเดอร์"],
    ]);
  });

  it("given the lists > then each number once, none of the tiles repeated", () => {
    expect(LIST_ROWS.money.map((k) => metricLabel(k).th)).toEqual([
      "ผู้ซื้อ",
      "จำนวนชิ้นที่ขาย",
      "ยอดขายต่อผู้ซื้อ",
      "อัตรากำไร",
      "ออเดอร์ไม่สำเร็จ",
    ]);
    expect(LIST_ROWS.traffic.map((k) => metricLabel(k).th)).toEqual([
      "ซื้อจริง",
      "สมัครสมาชิกใหม่",
    ]);
    const tiles = TILE_LINES.flat();
    expect(
      [...LIST_ROWS.money, ...LIST_ROWS.traffic].filter((k) => tiles.includes(k as never)),
    ).toEqual([]);
  });
});

describe("valueText", () => {
  it("given money > then baht with commas", () => {
    expect(valueText("sales", 1284000)).toBe("฿12,840");
  });

  it("given a loss > then the minus goes before the baht sign", () => {
    expect(valueText("profit", -5000)).toBe("−฿50");
  });

  it("given an average > then whole baht", () => {
    expect(valueText("aov", 160512.5)).toBe("฿1,605");
    expect(valueText("salesPerBuyer", 183428.57)).toBe("฿1,834");
  });

  it("given a count > then grouped whole numbers", () => {
    expect(valueText("productViews", 24600)).toBe("24,600");
  });

  it("given a rate > then two decimals", () => {
    expect(valueText("margin", 30.529)).toBe("30.53%");
    expect(valueText("failRate", 0)).toBe("0.00%");
  });
});

describe("changeOf", () => {
  it("given a number that went up > then ▲ and better", () => {
    expect(changeOf("sales", 1284000, 1086294)).toEqual({ text: "▲18.20%", tone: "better" });
  });

  it("given a number that went down > then ▼ and worse", () => {
    expect(changeOf("productViews", 1080, 1118)).toEqual({ text: "▼3.40%", tone: "worse" });
  });

  it("given failed orders > then up is worse and down is better", () => {
    expect(changeOf("failRate", 10, 5).tone).toBe("worse");
    expect(changeOf("failRate", 5, 10).tone).toBe("better");
  });

  it("given nothing to compare with > then a dash, neither colour", () => {
    expect(changeOf("sales", 1000, 0)).toEqual({ text: "—", tone: "same" });
  });

  it("given no change > then 0.00%, neither colour", () => {
    expect(changeOf("visitors", 214, 214)).toEqual({ text: "0.00%", tone: "same" });
  });
});

describe("toggleSeries", () => {
  it("given a third tile > then it joins and the oldest of the two leaves", () => {
    expect(toggleSeries(["sales", "profit"], "visitors")).toEqual(["profit", "visitors"]);
  });

  it("given one of two picked tiles > then it leaves the graph", () => {
    expect(toggleSeries(["sales", "profit"], "sales")).toEqual(["profit"]);
  });

  it("given the only line > then it stays, so the graph is never empty", () => {
    expect(toggleSeries(["sales"], "sales")).toEqual(["sales"]);
  });

  it("given one line and a new tile > then both show", () => {
    expect(toggleSeries(["sales"], "orders")).toEqual(["sales", "orders"]);
  });
});

describe("sourceShares", () => {
  const rows = [
    { source: "search", visitors: 98, productViews: 512, clicks: 0 },
    { source: "direct", visitors: 58, productViews: 271, clicks: 0 },
    { source: "social", visitors: 32, productViews: 160, clicks: 0 },
    { source: "ai", visitors: 17, productViews: 98, clicks: 0 },
    { source: "referral", visitors: 9, productViews: 39, clicks: 0 },
  ];

  it("given the sources > then each one's share of the visitors, busiest first", () => {
    expect(sourceShares(rows).map((s) => [s.label.th, s.pct, s.visitors, s.views])).toEqual([
      ["การค้นหา", 46, 98, 512],
      ["เข้าตรง", 27, 58, 271],
      ["โซเชียล", 15, 32, 160],
      ["ผู้ช่วย AI", 8, 17, 98],
      ["เว็บอื่น", 4, 9, 39],
    ]);
  });

  it("given a different order > then each source keeps its own colour", () => {
    const flipped = sourceShares([rows[1]!, rows[0]!]);
    expect(flipped.map((s) => [s.source, s.colour])).toEqual([
      ["direct", sourceShares(rows)[1]!.colour],
      ["search", sourceShares(rows)[0]!.colour],
    ]);
  });

  it("given nobody came > then no rows (and nothing divided by zero)", () => {
    expect(sourceShares([])).toEqual([]);
    expect(sourceShares([{ source: "direct", visitors: 0, productViews: 0, clicks: 0 }])).toEqual(
      [],
    );
  });
});

describe("best sellers", () => {
  it("given the products > then the first five, in the server's order (most sales first)", () => {
    const all = Array.from({ length: 7 }, (_, i) => product({ productId: `p${i}` }));
    expect(topSellers(all).map((p) => p.productId)).toEqual(["p0", "p1", "p2", "p3", "p4"]);
  });

  it("given a row > then pieces sold and views, as drawn", () => {
    expect(sellerLine(product({ units: 2, views: 64 }))).toEqual({
      th: "ขาย 2 · ดู 64",
      en: "2 sold · 64 views",
    });
    expect(sellerLine(product({ units: 0, views: 1200 })).th).toBe("ขาย 0 · ดู 1,200");
  });

  it("given a product whose name is gone > then a dash", () => {
    expect(sellerName(product({ name: "" }))).toBe("—");
    expect(sellerName(product({ name: "โอริงแอร์ ชุด #8" }))).toBe("โอริงแอร์ ชุด #8");
  });
});

describe("quiet periods", () => {
  it("given no orders, no visitors and no products > then the page says so", () => {
    expect(isQuiet(payload({}))).toBe(true);
  });

  it("given visitors but no orders > then the numbers still show", () => {
    expect(isQuiet(payload({ totals: { ...ZERO, visitors: 5 } }))).toBe(false);
  });

  it("given an order > then the numbers show", () => {
    expect(isQuiet(payload({ totals: { ...ZERO, orders: 1 } }))).toBe(false);
  });

  it("given วันนี้ > then the drawing's words; other periods say ช่วงนี้", () => {
    expect(quietText("realtime").th).toBe("ยังไม่มีออเดอร์ในวันนี้");
    expect(quietText("30d").th).toBe("ยังไม่มีออเดอร์ในช่วงนี้");
  });
});
