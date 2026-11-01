import {
  METRICS,
  pctChange,
  type InsightPeriod,
  type InsightTotals,
  type InsightWindow,
  type MetricKey,
} from "@l-shopee/core";
import type { Phrase } from "@l-shopee/shared";
import type { MetricFormat } from "./insightChart";
import { formatBaht } from "./money";

/**
 * ภาพรวม AirPlus (owner approved the drawing, canvas v233, 1 Nov 2026): the words, the order and
 * the colour rules of the page. The numbers themselves come from the server and core's
 * metricValues, the same ones the web back office reads. Pure, so the owner's rules are tested here.
 */

/** One source's arrivals in the period (GET /insights, apps/api/src/insights.ts). */
export interface SourceRow {
  source: string;
  visitors: number;
  productViews: number;
  clicks: number;
}

/** One product's sales and views in the period, most sales first. */
export interface ProductInsightRow {
  productId: string;
  productRef: string | null;
  name: string;
  imageKey: string | null;
  salesSatang: number;
  profitSatang: number;
  units: number;
  views: number;
  clicks: number;
}

export interface InsightsPayload {
  period: InsightPeriod;
  window: InsightWindow;
  comparison: InsightWindow;
  totals: InsightTotals;
  previous: InsightTotals;
  series: { buckets: number[]; totals: InsightTotals[] };
  sources: SourceRow[];
  products: ProductInsightRow[];
  unknownCostOrders: number;
}

export interface Change {
  text: string;
  /** Green when the shop did better, red when worse, grey when there is nothing to say. */
  tone: "better" | "worse" | "same";
}

export interface SourceShare {
  source: string;
  label: Phrase;
  visitors: number;
  views: number;
  /** Whole percent of all arrivals. */
  pct: number;
  colour: string;
}

const HOUR_MS = 3_600_000;
const BANGKOK_MS = 7 * HOUR_MS;
const TOP_SELLERS = 5;
/** At most two lines in the graph, as in Shopee ("ตัวชี้วัดที่ถูกเลือก 2/4"). */
const MAX_LINES = 2;
const DASH = "—";
/** Averages read in whole baht. */
const AVERAGES: readonly MetricKey[] = ["aov", "salesPerBuyer"];
/** The one number where up is bad. */
const LOWER_IS_BETTER: readonly MetricKey[] = ["failRate"];

export const PERIOD_OPTIONS: { key: InsightPeriod; label: Phrase }[] = [
  { key: "realtime", label: { th: "วันนี้", en: "Today" } },
  { key: "yesterday", label: { th: "เมื่อวาน", en: "Yesterday" } },
  { key: "7d", label: { th: "7 วันล่าสุด", en: "Last 7 days" } },
  { key: "30d", label: { th: "30 วันล่าสุด", en: "Last 30 days" } },
  { key: "month", label: { th: "เดือนนี้", en: "This month" } },
];

/** The tiles, three lines (owner, 1 Nov): money · what people saw · orders. */
export const TILE_LINES: MetricKey[][] = [
  ["sales", "profit"],
  ["productViews", "visitors", "addToCartVisitors"],
  ["orders", "aov"],
];

/** The two lists under the best sellers; a number on a tile is not repeated here. */
export const LIST_ROWS: { money: MetricKey[]; traffic: MetricKey[] } = {
  money: ["buyers", "units", "salesPerBuyer", "margin", "failRate"],
  traffic: ["conversionRate", "newAccounts"],
};

const LABELS: Record<MetricKey, Phrase> = {
  sales: { th: "ยอดขาย", en: "Sales" },
  profit: { th: "กำไร", en: "Profit" },
  productViews: { th: "มองเห็นสินค้า", en: "Product views" },
  visitors: { th: "ผู้เข้าชม", en: "Visitors" },
  addToCartVisitors: { th: "เพิ่มลงตะกร้า", en: "Added to cart" },
  orders: { th: "จำนวนออเดอร์", en: "Orders" },
  aov: { th: "เฉลี่ยต่อออเดอร์", en: "Per order" },
  buyers: { th: "ผู้ซื้อ", en: "Buyers" },
  units: { th: "จำนวนชิ้นที่ขาย", en: "Pieces sold" },
  salesPerBuyer: { th: "ยอดขายต่อผู้ซื้อ", en: "Sales per buyer" },
  margin: { th: "อัตรากำไร", en: "Margin" },
  failRate: { th: "ออเดอร์ไม่สำเร็จ", en: "Failed orders" },
  conversionRate: { th: "ซื้อจริง", en: "Bought" },
  newAccounts: { th: "สมัครสมาชิกใหม่", en: "New sign-ups" },
  addToCartRate: { th: "อัตราการเพิ่มลงตะกร้า", en: "Add-to-cart rate" },
};

/** Where visitors came from (the web back office's words); each keeps its own colour. */
const SOURCES: Record<string, { label: Phrase; colour: string }> = {
  search: { label: { th: "การค้นหา", en: "Search" }, colour: "#2A78D6" },
  direct: { label: { th: "เข้าตรง", en: "Direct" }, colour: "#EB6834" },
  social: { label: { th: "โซเชียล", en: "Social" }, colour: "#1BAF7A" },
  ai: { label: { th: "ผู้ช่วย AI", en: "AI assistants" }, colour: "#EDA100" },
  referral: { label: { th: "เว็บอื่น", en: "Other sites" }, colour: "#E87BA4" },
};
const OTHER_SOURCE_COLOUR = "#8A8A8E";

export function metricLabel(key: MetricKey): Phrase {
  return LABELS[key];
}

export function formatOf(key: MetricKey): MetricFormat {
  return METRICS.find((m) => m.key === key)?.format ?? "count";
}

const clock = (ms: number) => {
  const d = new Date(ms + BANGKOK_MS);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

/** The grey line under the period button: what every ▲ / ▼ on the page is measured against. */
export function compareLine(period: InsightPeriod, comparison: InsightWindow): Phrase {
  switch (period) {
    case "realtime": {
      const span = `${clock(comparison.start)}–${clock(comparison.end)}`;
      return { th: `เทียบกับ ${span} ของเมื่อวาน`, en: `Against ${span} yesterday` };
    }
    case "yesterday":
      return { th: "เทียบกับวันก่อนหน้า", en: "Against the day before" };
    case "7d":
      return { th: "เทียบกับ 7 วันก่อนหน้า", en: "Against the 7 days before" };
    case "30d":
      return { th: "เทียบกับ 30 วันก่อนหน้า", en: "Against the 30 days before" };
    case "month":
      return { th: "เทียบกับช่วงเดียวกันของเดือนที่แล้ว", en: "Against the same days last month" };
  }
}

/** A number as the page shows it: ฿12,840 · 1,080 · 30.53%. */
export function valueText(key: MetricKey, value: number): string {
  const format = formatOf(key);
  if (format === "percent") return `${value.toFixed(2)}%`;
  if (format === "count") return Math.round(value).toLocaleString("en-US");
  const satang = AVERAGES.includes(key) ? Math.round(value / 100) * 100 : Math.round(value);
  return satang < 0 ? `−${formatBaht(-satang)}` : formatBaht(satang);
}

/** ▲ / ▼ against the comparison period, and whether that is good for the shop. */
export function changeOf(key: MetricKey, current: number, previous: number): Change {
  const pct = pctChange(current, previous);
  if (pct == null) return { text: DASH, tone: "same" };
  if (pct === 0) return { text: "0.00%", tone: "same" };
  const up = pct > 0;
  const better = LOWER_IS_BETTER.includes(key) ? !up : up;
  return {
    text: `${up ? "▲" : "▼"}${Math.abs(pct).toFixed(2)}%`,
    tone: better ? "better" : "worse",
  };
}

/**
 * A tap on a tile: on → its line joins the graph (the older of two leaves); off → it leaves, but
 * never the last one, so the graph is never empty.
 */
export function toggleSeries(selected: readonly MetricKey[], key: MetricKey): MetricKey[] {
  if (selected.includes(key)) {
    return selected.length === 1 ? [...selected] : selected.filter((k) => k !== key);
  }
  return selected.length < MAX_LINES ? [...selected, key] : [...selected.slice(1), key];
}

/** Each source's share of the arrivals, in the server's order (busiest first). */
export function sourceShares(rows: readonly SourceRow[]): SourceShare[] {
  const total = rows.reduce((sum, r) => sum + r.visitors, 0);
  if (total === 0) return [];
  return rows
    .filter((r) => r.visitors > 0)
    .map((r) => {
      const known = SOURCES[r.source];
      return {
        source: r.source,
        label: known?.label ?? { th: r.source, en: r.source },
        visitors: r.visitors,
        views: r.productViews,
        pct: Math.round((r.visitors / total) * 100),
        colour: known?.colour ?? OTHER_SOURCE_COLOUR,
      };
    });
}

/** The five under the graph. The server already sorts by sales, then views. */
export function topSellers(rows: readonly ProductInsightRow[]): ProductInsightRow[] {
  return rows.slice(0, TOP_SELLERS);
}

/** The grey half of a best-seller row: pieces sold and views (owner, 1 Nov). */
export function sellerLine(row: ProductInsightRow): Phrase {
  const sold = row.units.toLocaleString("en-US");
  const views = row.views.toLocaleString("en-US");
  return { th: `ขาย ${sold} · ดู ${views}`, en: `${sold} sold · ${views} views` };
}

/** A product removed since its views were counted has no name left. */
export function sellerName(row: ProductInsightRow): string {
  return row.name.trim() || DASH;
}

/** Nothing happened at all: no order, no visitor, no product looked at. */
export function isQuiet(payload: InsightsPayload): boolean {
  return (
    payload.totals.orders === 0 && payload.totals.visitors === 0 && payload.products.length === 0
  );
}

export function quietText(period: InsightPeriod): Phrase {
  return period === "realtime"
    ? { th: "ยังไม่มีออเดอร์ในวันนี้", en: "No orders today yet" }
    : { th: "ยังไม่มีออเดอร์ในช่วงนี้", en: "No orders in this period" };
}
