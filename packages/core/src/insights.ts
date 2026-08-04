/**
 * The time arithmetic behind AirPlus Insight — the admin's answer to Shopee's Business Insights.
 *
 * Two things here are worth more than they look.
 *
 * **Bangkok, always.** The API runs on Cloudflare Workers, whose clock is UTC. `new Date().setHours(0)`
 * there lands on 07:00 Bangkok, so a naive "today" would silently drop every order taken between
 * midnight and breakfast — the shop's quietest hours, but not its emptiest. Every boundary below is
 * therefore computed against a fixed +07:00 offset (Thailand has never observed DST, so a fixed
 * offset is exact, not an approximation) and the whole module is pure: same inputs, same answer, on
 * a Worker or in a browser or in a test.
 *
 * **Like-for-like comparison.** Shopee's "▼64.00% เทียบกับ 00:00-18:00 ของเมื่อวาน" is the honest
 * part of their card: a day that is 18 hours old is compared against the first 18 hours of
 * yesterday, never against yesterday's full 24. Comparing a part-day against a whole one makes every
 * morning look like a catastrophe and every late evening like a boom. `comparisonWindow` reproduces
 * that rule for all five presets.
 */

/** Thailand is UTC+7 year-round — no DST, so this offset is exact rather than seasonal. */
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** The period chips, in the order Shopee shows them (and the order the admin renders them). */
export const INSIGHT_PERIODS = ["realtime", "yesterday", "7d", "30d", "month"] as const;
export type InsightPeriod = (typeof INSIGHT_PERIODS)[number];

export function isInsightPeriod(value: string): value is InsightPeriod {
  return (INSIGHT_PERIODS as readonly string[]).includes(value);
}

/** A half-open range `[start, end)` in epoch ms. */
export interface InsightWindow {
  start: number;
  end: number;
}

/** Hourly for a single day, daily for anything longer — the same split Shopee's charts use. */
export type Granularity = "hour" | "day";

/** Midnight in Bangkok on the day `ms` falls in, as epoch ms. */
export function bangkokDayStart(ms: number): number {
  return Math.floor((ms + BKK_OFFSET_MS) / DAY_MS) * DAY_MS - BKK_OFFSET_MS;
}

/**
 * Midnight in Bangkok on the 1st of the month `ms` falls in, `monthsBack` months earlier.
 *
 * Uses the UTC getters on a shifted instant so the calendar rollover (Jan → Dec of the previous
 * year, and month lengths) is `Date.UTC`'s problem rather than ours.
 */
function bangkokMonthStart(ms: number, monthsBack = 0): number {
  const d = new Date(ms + BKK_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsBack, 1) - BKK_OFFSET_MS;
}

/**
 * The range a preset covers.
 *
 * `7d`/`30d` deliberately end at today's midnight — they are the last N *complete* days. Including
 * today would put a part-day bar next to N full ones on the same chart, which always reads as a
 * collapse no matter how the day is actually going. `realtime` and `month` are explicitly
 * to-date views, so a running total is what the owner expects there.
 */
export function insightWindow(period: InsightPeriod, now: number): InsightWindow {
  const today = bangkokDayStart(now);
  switch (period) {
    case "realtime":
      return { start: today, end: now };
    case "yesterday":
      return { start: today - DAY_MS, end: today };
    case "7d":
      return { start: today - 7 * DAY_MS, end: today };
    case "30d":
      return { start: today - 30 * DAY_MS, end: today };
    case "month":
      return { start: bangkokMonthStart(now), end: now };
  }
}

/**
 * The range every percentage on the page is measured against — the equivalent slice of the
 * preceding period, matched in LENGTH so a part-day never faces a whole one.
 *
 * The month case is the only one that needs a clamp: on 31 March, 30 days have elapsed but February
 * only has 28, so an unclamped base would run past 1 March and start counting the current month's
 * own takings as its own baseline. Stopping at this month's 1st under-counts the base slightly in
 * that rare case, which is the safe direction — it can only make a good month look less good.
 */
export function comparisonWindow(period: InsightPeriod, now: number): InsightWindow {
  const w = insightWindow(period, now);
  switch (period) {
    case "realtime": {
      const elapsed = now - w.start;
      const prevDay = w.start - DAY_MS;
      return { start: prevDay, end: prevDay + elapsed };
    }
    case "yesterday":
    case "7d":
    case "30d": {
      const span = w.end - w.start;
      return { start: w.start - span, end: w.start };
    }
    case "month": {
      const elapsed = now - w.start;
      const prevMonth = bangkokMonthStart(now, 1);
      return { start: prevMonth, end: Math.min(prevMonth + elapsed, w.start) };
    }
  }
}

export function granularityFor(period: InsightPeriod): Granularity {
  return period === "realtime" || period === "yesterday" ? "hour" : "day";
}

/**
 * The x-axis: the start instant of every bucket in the window.
 *
 * A single-day preset always returns all 24 hours even when only 18 have happened, so the axis
 * doesn't rescale on every reload and the line keeps its shape as the day fills in — exactly what
 * Shopee's 00:00-23:59 axis does. Multi-day presets return only the days the window actually spans,
 * so a month-to-date chart grows a bar a day rather than showing a flat tail of the future.
 */
export function seriesBuckets(period: InsightPeriod, now: number): number[] {
  const { start, end } = insightWindow(period, now);
  if (granularityFor(period) === "hour") {
    return Array.from({ length: 24 }, (_, i) => start + i * HOUR_MS);
  }
  const days = Math.ceil((end - start) / DAY_MS);
  return Array.from({ length: days }, (_, i) => start + i * DAY_MS);
}

/**
 * Which bucket an instant belongs to, or null when it falls outside the window.
 *
 * Null rather than a clamp on purpose: clamping would pile every older order into bucket 0 and draw
 * a spike on the left edge that never happened. The caller drops what it cannot place.
 */
export function bucketIndexFor(ms: number, period: InsightPeriod, now: number): number | null {
  const buckets = seriesBuckets(period, now);
  const size = granularityFor(period) === "hour" ? HOUR_MS : DAY_MS;
  const first = buckets[0] ?? 0;
  const index = Math.floor((ms - first) / size);
  return index >= 0 && index < buckets.length ? index : null;
}

/**
 * Percentage change from `previous` to `current`, or null when there is no base to measure against.
 *
 * Null — rendered as an em dash — rather than a number for a zero base. The first sale the shop ever
 * makes is not an infinite percentage rise, and "0%" against a zero base would claim we compared
 * something when both windows were empty.
 */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Where an arrival came from.
 *
 * Not Shopee's buckets — theirs name their own internal surfaces (Live, วิดีโอ, พาร์ทเนอร์) which
 * AirPlus does not have. These are the sources a self-hosted shop actually has, and `ai` earns its
 * own row because AirPlus deliberately publishes /llms.txt, /skills.md and /sitemap.md to be
 * readable by assistants: it is the one channel the shop invested in that nothing else can measure.
 */
export const TRAFFIC_SOURCES = [
  "direct",
  "search",
  "social",
  "ai",
  "referral",
  "internal",
] as const;
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

const SEARCH_HOSTS = ["google.", "bing.", "duckduckgo.", "yahoo.", "baidu.", "yandex."];
const SOCIAL_HOSTS = [
  "facebook.",
  "fb.",
  "instagram.",
  "line.me",
  "tiktok.",
  "twitter.",
  "x.com",
  "youtube.",
  "pinterest.",
  "reddit.",
];
const AI_HOSTS = [
  "chatgpt.",
  "openai.",
  "perplexity.",
  "claude.ai",
  "anthropic.",
  "gemini.google",
  "bard.google",
  "copilot.microsoft",
  "you.com",
];

/**
 * Classify a `Referer` against our own origin.
 *
 * Same-origin is `internal`, never `referral` — a hop from the home page to a product page is
 * navigation, and counting it as a source would make the site its own biggest referrer and drown
 * every real one. An unparseable header degrades to `direct` rather than throwing: a junk Referer
 * must never cost us the visit, it just costs us the attribution.
 */
export function trafficSource(referrer: string | null | undefined, origin: string): TrafficSource {
  const raw = (referrer ?? "").trim();
  if (!raw) return "direct";
  let host: string;
  try {
    const url = new URL(raw);
    if (url.origin === origin) return "internal";
    host = url.hostname.toLowerCase();
  } catch {
    return "direct";
  }
  const hit = (list: readonly string[]) => list.some((h) => host === h || host.includes(h));
  if (hit(AI_HOSTS)) return "ai";
  if (hit(SEARCH_HOSTS)) return "search";
  if (hit(SOCIAL_HOSTS)) return "social";
  return "referral";
}

/** The raw countable facts a window yields. Everything on the page is derived from these. */
export interface InsightTotals {
  salesSatang: number;
  profitSatang: number;
  /** Orders that stand — a sale that happened. Excludes cancelled and expired. */
  orders: number;
  buyers: number;
  units: number;
  visitors: number;
  /**
   * Product detail pages opened.
   *
   * The owner collapsed views and clicks into one number ("1 view = 1 click", 4 Aug 2026), and this
   * is that number: a card click always lands on a detail page, and a direct arrival produces one
   * without a card click, so PDP opens is the complete count with nothing double-counted. `clicks`
   * survives below because the product and source tables still break it out, but it is no longer a
   * tile of its own — which is also why the page needs no click-through rate, and therefore no
   * impression tracking.
   */
  productViews: number;
  clicks: number;
  addToCartVisitors: number;
  /** Storefront customers who registered in the window. */
  newAccounts: number;
  /**
   * Orders that did not make it, counted ONCE however many ways they went wrong: cancelled,
   * expired unpaid, claimed, or failed delivery (owner's four, 4 Aug 2026). Counting once is what
   * keeps the ratio inside 0-100% — an order can carry both a failed delivery and a claim.
   */
  failedOrders: number;
  /**
   * Every order placed in the window whatever became of it — the fail ratio's denominator.
   *
   * Deliberately NOT `orders`: that one already drops the cancelled and expired, which are the very
   * failures being measured. Dividing by it would hide the problem inside its own base.
   */
  placedOrders: number;
}

export const MONEY_METRIC_KEYS = [
  "sales",
  "profit",
  "orders",
  "aov",
  "buyers",
  "salesPerBuyer",
  "units",
  "margin",
  "failRate",
] as const;

export const TRAFFIC_METRIC_KEYS = [
  "visitors",
  "productViews",
  "addToCartVisitors",
  "addToCartRate",
  "conversionRate",
  "newAccounts",
] as const;

/**
 * The six the owner reads first (4 Aug 2026), in their order. They lead the page; every other tile
 * follows underneath rather than being hidden — the owner asked to still see all of them.
 *
 * Shopee's fourteen are built for a seller with thousands of orders a day. These six are the ones
 * that answer "how did today go" for this shop: how many came, how many looked, how many nearly
 * bought, how many joined, what we took, and how much of it went wrong.
 */
export const PRIORITY_METRIC_KEYS = [
  "sales",
  "visitors",
  "productViews",
  "addToCartVisitors",
  "newAccounts",
  "failRate",
] as const;

export type MetricKey = (typeof MONEY_METRIC_KEYS)[number] | (typeof TRAFFIC_METRIC_KEYS)[number];

export interface MetricDef {
  key: MetricKey;
  /** Thai first — it is the shop's working language and what Shopee shows. */
  labelTh: string;
  labelEn: string;
  format: "money" | "count" | "percent";
  /** Which mobile tab the tile lives on, mirroring Shopee's ยอดขาย / สินค้า split. */
  group: "money" | "traffic";
  /**
   * A ratio, not a total. Set so nothing ever sums it across buckets: the mean of 24 hourly
   * conversion rates is not the day's conversion rate, and a chart that adds them up is simply
   * wrong. Derived series must be recomputed per bucket from that bucket's own totals.
   */
  derived?: boolean;
}

/**
 * The tiles, in order. Sales and profit lead as twin heroes of equal weight (owner, 4 Aug 2026):
 * Shopee has to lead with GMV because it does not know our cost — Kira does, so the number that
 * says whether a day was actually good sits right beside the one that says how busy it was.
 */
export const METRICS: readonly MetricDef[] = [
  { key: "sales", labelTh: "ยอดขาย", labelEn: "Sales", format: "money", group: "money" },
  { key: "profit", labelTh: "กำไร", labelEn: "Profit", format: "money", group: "money" },
  { key: "orders", labelTh: "คำสั่งซื้อ", labelEn: "Orders", format: "count", group: "money" },
  {
    key: "aov",
    labelTh: "ยอดขายเฉลี่ยต่อคำสั่งซื้อ",
    labelEn: "Sales per order",
    format: "money",
    group: "money",
    derived: true,
  },
  { key: "buyers", labelTh: "ผู้ซื้อ", labelEn: "Buyers", format: "count", group: "money" },
  {
    key: "salesPerBuyer",
    labelTh: "ยอดขายต่อผู้ซื้อ",
    labelEn: "Sales per buyer",
    format: "money",
    group: "money",
    derived: true,
  },
  {
    key: "units",
    labelTh: "จำนวนชิ้นที่ขาย",
    labelEn: "Units sold",
    format: "count",
    group: "money",
  },
  {
    key: "margin",
    labelTh: "อัตรากำไร",
    labelEn: "Margin",
    format: "percent",
    group: "money",
    derived: true,
  },
  {
    key: "failRate",
    labelTh: "อัตราคำสั่งซื้อไม่สำเร็จ",
    labelEn: "Failed-order rate",
    format: "percent",
    group: "money",
    derived: true,
  },
  {
    key: "visitors",
    labelTh: "ผู้เข้าชม",
    labelEn: "Visitors",
    format: "count",
    group: "traffic",
  },
  {
    key: "productViews",
    labelTh: "ยอดการมองเห็นสินค้า",
    labelEn: "Product views",
    format: "count",
    group: "traffic",
  },
  {
    key: "addToCartVisitors",
    labelTh: "ผู้เข้าชมที่เพิ่มในรถเข็น",
    labelEn: "Visitors who added to cart",
    format: "count",
    group: "traffic",
  },
  {
    key: "addToCartRate",
    labelTh: "อัตราการเพิ่มในรถเข็น",
    labelEn: "Add-to-cart rate",
    format: "percent",
    group: "traffic",
    derived: true,
  },
  {
    key: "conversionRate",
    labelTh: "อัตราการซื้อสินค้า",
    labelEn: "Conversion rate",
    format: "percent",
    group: "traffic",
    derived: true,
  },
  {
    key: "newAccounts",
    labelTh: "สมัครสมาชิกใหม่",
    labelEn: "New accounts",
    format: "count",
    group: "traffic",
  },
];

/** Division that yields 0 rather than NaN/Infinity on an empty window — an empty shop is not a bug. */
function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/** Every tile's value for one window. Rates are computed from THIS window's totals, never averaged. */
export function metricValues(t: InsightTotals): Record<MetricKey, number> {
  return {
    sales: t.salesSatang,
    profit: t.profitSatang,
    orders: t.orders,
    aov: ratio(t.salesSatang, t.orders),
    buyers: t.buyers,
    salesPerBuyer: ratio(t.salesSatang, t.buyers),
    units: t.units,
    margin: ratio(t.profitSatang, t.salesSatang) * 100,
    visitors: t.visitors,
    productViews: t.productViews,
    addToCartVisitors: t.addToCartVisitors,
    addToCartRate: ratio(t.addToCartVisitors, t.visitors) * 100,
    conversionRate: ratio(t.buyers, t.visitors) * 100,
    newAccounts: t.newAccounts,
    failRate: ratio(t.failedOrders, t.placedOrders) * 100,
  };
}
