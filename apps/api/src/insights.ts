import {
  bucketIndexFor,
  comparisonWindow,
  granularityFor,
  insightWindow,
  orderMoney,
  seriesBuckets,
  type InsightPeriod,
  type InsightTotals,
  type InsightWindow,
} from "@l-shopee/core";

/**
 * The AirPlus Insight aggregate — everything the admin's Insight page draws, for one period.
 *
 * Three decisions worth knowing before editing.
 *
 * **Profit goes through `orderMoney`, never through SQL.** It would be quicker to write the margin
 * formula into the GROUP BY, and it would drift the first time a claim, a refund or a shipping
 * shortfall changed how one order's profit is figured. `orderMoney` is the single definition of
 * "what we kept" and /orders, /orders/:id and this page all call it, so they cannot disagree. The
 * cost is one row per order in the window, which for this shop is tens, not millions.
 *
 * **Traffic is bucketed in SQL, money in JS.** Events are the high-volume table, so their per-bucket
 * counts are a single GROUP BY on an integer-divided timestamp. Orders are few and each needs
 * `orderMoney`, so they are bucketed in a loop. Neither approach scales to the other's table.
 *
 * **Orders are not attributed to a traffic source.** Shopee can tell you which surface produced a
 * sale because it owns the session that spans browsing and checkout. AirPlus deliberately does not:
 * the visitor hash rotates at midnight and is never written onto an order, precisely so a purchase
 * can never be joined back to a browsing trail (migration 0087). So the source table reports
 * traffic only, and the page says so rather than inventing an attribution it cannot support.
 */

/** Not `cancelled`/`expired` — the closest honest equivalent of Shopee's "ยืนยันแล้ว" filter. */
const VOID_STATUSES = ["cancelled", "expired"];

export interface SourceRow {
  source: string;
  visitors: number;
  productViews: number;
  clicks: number;
}

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
  /**
   * Orders in the window whose cost snapshot is missing, so their profit is unknowable and excluded
   * from `totals.profitSatang`. Surfaced rather than hidden: a margin computed over an unknown
   * subset is a number nobody can act on unless they know how big the subset is.
   */
  unknownCostOrders: number;
}

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
};

function zeroTotals(): InsightTotals {
  return { ...ZERO };
}

/** One AirPlus order with everything `orderMoney` needs, flattened by the query below. */
interface OrderFactRow {
  id: string;
  occurredAt: number;
  buyer: string | null;
  subtotalSatang: number;
  discountTotalSatang: number;
  grandTotalSatang: number;
  shippingFeeSatang: number;
  shippingRealSatang: number | null;
  profitSatang: number | null;
  refundSatang: number | null;
  itemCostSatang: number;
  units: number;
  claimShippingSatang: number;
}

/**
 * Money facts for every countable AirPlus order in a window.
 *
 * `COALESCE(order_created_at, imported_at)` because a CSV-imported row may have no created-at, and
 * dropping those would quietly shrink history. The line cost and claim shipping arrive as correlated
 * subqueries rather than joins so a two-line order stays one row and its total isn't multiplied.
 */
async function orderFacts(db: D1Database, w: InsightWindow): Promise<OrderFactRow[]> {
  const { results } = await db
    .prepare(
      `SELECT o.id,
              COALESCE(o.order_created_at, o.imported_at) AS occurredAt,
              COALESCE(o.storefront_customer_id, o.buyer_username) AS buyer,
              o.subtotal_satang AS subtotalSatang,
              o.discount_total_satang AS discountTotalSatang,
              o.grand_total_satang AS grandTotalSatang,
              o.shipping_fee_satang AS shippingFeeSatang,
              o.shipping_real_satang AS shippingRealSatang,
              o.profit_satang AS profitSatang,
              o.refund_satang AS refundSatang,
              COALESCE((SELECT SUM(l.unit_cost_satang * l.quantity) FROM sales_order_lines l
                        WHERE l.sales_order_id = o.id), 0) AS itemCostSatang,
              COALESCE((SELECT SUM(l.quantity) FROM sales_order_lines l
                        WHERE l.sales_order_id = o.id), 0) AS units,
              COALESCE((SELECT SUM(c.shipping_fee_satang) FROM order_claims c
                        WHERE c.sales_order_id = o.id), 0) AS claimShippingSatang
       FROM sales_orders o
       WHERE o.channel = 'airplus'
         AND COALESCE(o.order_created_at, o.imported_at) >= ?
         AND COALESCE(o.order_created_at, o.imported_at) < ?
         AND (o.order_status IS NULL OR o.order_status NOT IN (${VOID_STATUSES.map(() => "?").join(", ")}))`,
    )
    .bind(w.start, w.end, ...VOID_STATUSES)
    .all<OrderFactRow>();
  return results ?? [];
}

/**
 * Fold order rows into totals, counting each buyer once.
 *
 * The synthetic single line handed to `orderMoney` carries the order's already-summed item cost at
 * quantity 1 — the function only ever multiplies cost by quantity, so this is exact, and it keeps
 * the one definition of profit in one place instead of re-deriving it here.
 */
function foldOrders(rows: readonly OrderFactRow[]): { totals: InsightTotals; unknownCost: number } {
  const totals = zeroTotals();
  const buyers = new Set<string>();
  let unknownCost = 0;

  for (const r of rows) {
    totals.orders += 1;
    totals.salesSatang += r.grandTotalSatang;
    totals.units += r.units;
    if (r.buyer) buyers.add(r.buyer);

    const money = orderMoney({
      subtotalSatang: r.subtotalSatang,
      discountTotalSatang: r.discountTotalSatang,
      grandTotalSatang: r.grandTotalSatang,
      shippingChargedSatang: r.shippingFeeSatang,
      shippingRealSatang: r.shippingRealSatang,
      lines: [{ unitCostSatang: r.itemCostSatang, quantity: 1 }],
      storedProfitSatang: r.profitSatang,
      refundedSatang: r.refundSatang ?? 0,
      claimShippingSatang: r.claimShippingSatang,
    });
    if (money.profitSatang == null) unknownCost += 1;
    else totals.profitSatang += money.profitSatang;
  }

  // An order with no linked customer still happened; count it as one anonymous buyer rather than
  // dropping it, or conversion rate would read low for exactly the guest checkouts we encourage.
  totals.buyers = buyers.size + rows.filter((r) => !r.buyer).length;
  return { totals, unknownCost };
}

/** Distinct-visitor and event counts for a window, in one pass. */
async function trafficTotals(db: D1Database, w: InsightWindow): Promise<Partial<InsightTotals>> {
  const row = await db
    .prepare(
      `SELECT COUNT(DISTINCT visitor_hash) AS visitors,
              SUM(CASE WHEN kind = 'product_view' THEN 1 ELSE 0 END) AS productViews,
              SUM(CASE WHEN kind = 'click' THEN 1 ELSE 0 END) AS clicks,
              COUNT(DISTINCT CASE WHEN kind = 'add_to_cart' THEN visitor_hash END) AS addToCartVisitors
       FROM storefront_events
       WHERE occurred_at >= ? AND occurred_at < ?`,
    )
    .bind(w.start, w.end)
    .first<{
      visitors: number;
      productViews: number | null;
      clicks: number | null;
      addToCartVisitors: number;
    }>();
  return {
    visitors: row?.visitors ?? 0,
    productViews: row?.productViews ?? 0,
    clicks: row?.clicks ?? 0,
    addToCartVisitors: row?.addToCartVisitors ?? 0,
  };
}

/** Totals for one window: money folded in JS, traffic counted in SQL, merged. */
async function windowTotals(
  db: D1Database,
  w: InsightWindow,
): Promise<{ totals: InsightTotals; unknownCost: number }> {
  const [{ totals, unknownCost }, traffic] = await Promise.all([
    orderFacts(db, w).then(foldOrders),
    trafficTotals(db, w),
  ]);
  return { totals: { ...totals, ...traffic }, unknownCost };
}

/**
 * Per-bucket traffic, grouped by integer-divided timestamp.
 *
 * The distinct counts have to happen inside SQL: a visitor seen at 09:00 and again at 15:00 is one
 * visitor for the day but must appear in both hours, and that is only right if each bucket does its
 * own DISTINCT. Summing the buckets therefore does NOT give the window total — which is correct,
 * and why the totals are queried separately rather than derived from the series.
 */
async function trafficSeries(
  db: D1Database,
  w: InsightWindow,
  bucketMs: number,
): Promise<Map<number, Partial<InsightTotals>>> {
  const { results } = await db
    .prepare(
      `SELECT ((occurred_at - ?) / ?) AS bucket,
              COUNT(DISTINCT visitor_hash) AS visitors,
              SUM(CASE WHEN kind = 'product_view' THEN 1 ELSE 0 END) AS productViews,
              SUM(CASE WHEN kind = 'click' THEN 1 ELSE 0 END) AS clicks,
              COUNT(DISTINCT CASE WHEN kind = 'add_to_cart' THEN visitor_hash END) AS addToCartVisitors
       FROM storefront_events
       WHERE occurred_at >= ? AND occurred_at < ?
       GROUP BY bucket`,
    )
    .bind(w.start, bucketMs, w.start, w.end)
    .all<{
      bucket: number;
      visitors: number;
      productViews: number | null;
      clicks: number | null;
      addToCartVisitors: number;
    }>();

  return new Map(
    (results ?? []).map((r) => [
      Number(r.bucket),
      {
        visitors: r.visitors ?? 0,
        productViews: r.productViews ?? 0,
        clicks: r.clicks ?? 0,
        addToCartVisitors: r.addToCartVisitors ?? 0,
      },
    ]),
  );
}

/** Arrivals by source, busiest first. `internal` is navigation, not an arrival, so it is excluded. */
async function sourceRows(db: D1Database, w: InsightWindow): Promise<SourceRow[]> {
  const { results } = await db
    .prepare(
      `SELECT source,
              COUNT(DISTINCT visitor_hash) AS visitors,
              SUM(CASE WHEN kind = 'product_view' THEN 1 ELSE 0 END) AS productViews,
              SUM(CASE WHEN kind = 'click' THEN 1 ELSE 0 END) AS clicks
       FROM storefront_events
       WHERE occurred_at >= ? AND occurred_at < ? AND source <> 'internal'
       GROUP BY source
       ORDER BY visitors DESC, source`,
    )
    .bind(w.start, w.end)
    .all<SourceRow>();
  return (results ?? []).map((r) => ({
    source: r.source,
    visitors: r.visitors ?? 0,
    productViews: r.productViews ?? 0,
    clicks: r.clicks ?? 0,
  }));
}

/**
 * The product table: what sold, and what was looked at.
 *
 * Two independent aggregates merged by product id, deliberately outer-joined in JS rather than in
 * SQL, because each side has rows the other lacks and both matter. A product that sold without a
 * recorded view (a direct link, a returning customer) must not vanish; a product viewed twenty times
 * and never bought is the single most actionable row the page can show, and an inner join would hide
 * exactly that one.
 */
async function productRows(db: D1Database, w: InsightWindow): Promise<ProductInsightRow[]> {
  const [sold, seen] = await Promise.all([
    db
      .prepare(
        `SELECT p.id AS productId, p.name, p.product_ref AS productRef, p.image_key AS imageKey,
                SUM(l.line_total_satang) AS salesSatang,
                SUM((l.unit_price_satang - l.unit_cost_satang) * l.quantity) AS profitSatang,
                SUM(l.quantity) AS units
         FROM sales_order_lines l
         JOIN sales_orders o ON o.id = l.sales_order_id
         JOIN product_variants v ON v.id = l.product_variant_id
         JOIN products p ON p.id = v.product_id
         WHERE o.channel = 'airplus'
           AND COALESCE(o.order_created_at, o.imported_at) >= ?
           AND COALESCE(o.order_created_at, o.imported_at) < ?
           AND (o.order_status IS NULL OR o.order_status NOT IN (${VOID_STATUSES.map(() => "?").join(", ")}))
         GROUP BY p.id`,
      )
      .bind(w.start, w.end, ...VOID_STATUSES)
      .all<{
        productId: string;
        name: string;
        productRef: string | null;
        imageKey: string | null;
        salesSatang: number;
        profitSatang: number;
        units: number;
      }>(),
    db
      .prepare(
        `SELECT e.product_id AS productId,
                COALESCE(p.name, '') AS name,
                p.product_ref AS productRef,
                p.image_key AS imageKey,
                SUM(CASE WHEN e.kind = 'product_view' THEN 1 ELSE 0 END) AS views,
                SUM(CASE WHEN e.kind = 'click' THEN 1 ELSE 0 END) AS clicks
         FROM storefront_events e
         LEFT JOIN products p ON p.id = e.product_id
         WHERE e.occurred_at >= ? AND e.occurred_at < ? AND e.product_id IS NOT NULL
         GROUP BY e.product_id`,
      )
      .bind(w.start, w.end)
      .all<{
        productId: string;
        name: string;
        productRef: string | null;
        imageKey: string | null;
        views: number | null;
        clicks: number | null;
      }>(),
  ]);

  const byId = new Map<string, ProductInsightRow>();
  for (const r of sold.results ?? []) {
    byId.set(r.productId, {
      productId: r.productId,
      productRef: r.productRef,
      name: r.name,
      imageKey: r.imageKey,
      salesSatang: r.salesSatang ?? 0,
      profitSatang: r.profitSatang ?? 0,
      units: r.units ?? 0,
      views: 0,
      clicks: 0,
    });
  }
  for (const r of seen.results ?? []) {
    const existing = byId.get(r.productId);
    if (existing) {
      existing.views = r.views ?? 0;
      existing.clicks = r.clicks ?? 0;
      continue;
    }
    byId.set(r.productId, {
      productId: r.productId,
      productRef: r.productRef,
      name: r.name,
      imageKey: r.imageKey,
      salesSatang: 0,
      profitSatang: 0,
      units: 0,
      views: r.views ?? 0,
      clicks: r.clicks ?? 0,
    });
  }

  // Sales first — the owner's ranking. Views break the tie so an unsold-but-watched product floats
  // to the top of the zero-sales tail instead of sorting arbitrarily.
  return [...byId.values()].sort(
    (a, b) => b.salesSatang - a.salesSatang || b.views - a.views || a.name.localeCompare(b.name),
  );
}

const HOUR_MS = 60 * 60 * 1000;

/** Everything the Insight page needs for one period, in one round of queries. */
export async function insightsFor(
  db: D1Database,
  period: InsightPeriod,
  now: number,
): Promise<InsightsPayload> {
  const window = insightWindow(period, now);
  const comparison = comparisonWindow(period, now);
  const buckets = seriesBuckets(period, now);
  const bucketMs = granularityFor(period) === "hour" ? HOUR_MS : 24 * HOUR_MS;

  const [current, previous, sources, products, seriesTraffic, seriesOrders] = await Promise.all([
    windowTotals(db, window),
    windowTotals(db, comparison),
    sourceRows(db, window),
    productRows(db, window),
    trafficSeries(db, window, bucketMs),
    // Re-read the window's orders rather than reusing `current`'s: the series needs each order's
    // timestamp to place it, which the folded totals have already thrown away.
    orderFacts(db, window),
  ]);

  const seriesTotals = buckets.map((_, i) => ({
    ...zeroTotals(),
    ...(seriesTraffic.get(i) ?? {}),
  }));
  for (const row of seriesOrders) {
    const i = bucketIndexFor(row.occurredAt, period, now);
    if (i == null) continue;
    const bucket = seriesTotals[i];
    if (!bucket) continue;
    const { totals } = foldOrders([row]);
    bucket.salesSatang += totals.salesSatang;
    bucket.profitSatang += totals.profitSatang;
    bucket.orders += totals.orders;
    bucket.buyers += totals.buyers;
    bucket.units += totals.units;
  }

  return {
    period,
    window,
    comparison,
    totals: current.totals,
    previous: previous.totals,
    series: { buckets, totals: seriesTotals },
    sources,
    products,
    unknownCostOrders: current.unknownCost,
  };
}
