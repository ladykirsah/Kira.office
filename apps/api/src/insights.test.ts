import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { insightsFor } from "./insights";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations",
);

/** A migrated in-memory D1: replays every migration in apply order. */
function migratedDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  return db;
}

/** The slice of the D1 API the insights queries use: prepare → bind → all/first. */
function asD1(db: DatabaseSync): D1Database {
  const make = (sql: string) => {
    let binds: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        binds = args;
        return stmt;
      },
      async all<T = unknown>(): Promise<{ results: T[] }> {
        return { results: db.prepare(sql).all(...(binds as never[])) as T[] };
      },
      async first<T = unknown>(): Promise<T | null> {
        return (db.prepare(sql).get(...(binds as never[])) as T | undefined) ?? null;
      },
      async run() {
        return db.prepare(sql).run(...(binds as never[]));
      },
    };
    return stmt;
  };
  return { prepare: (sql: string) => make(sql) } as unknown as D1Database;
}

function bkk(s: string): number {
  return Date.parse(`${s}+07:00`);
}

/** 18:00 Bangkok, 4 Aug 2026 — matching the owner's Shopee screenshots. */
const NOW = bkk("2026-08-04T18:00:00");
const TODAY_13 = bkk("2026-08-04T13:00:00");
const YESTERDAY_13 = bkk("2026-08-03T13:00:00");

/**
 * One AirPlus order with a single line. `costSatang` null models an order whose SKUs were never
 * matched to Kira products — sales are real, profit is unknowable.
 */
function seedOrder(
  db: DatabaseSync,
  o: {
    id: string;
    at: number;
    grand: number;
    cost: number | null;
    status?: string;
    customer?: string;
    productId?: string;
    qty?: number;
    channel?: string;
  },
) {
  db.prepare(
    `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status,
                               order_created_at, imported_at, subtotal_satang, discount_total_satang,
                               grand_total_satang, shipping_fee_satang, profit_satang,
                               storefront_customer_id)
     VALUES (?, ?, ?, ?, 'paid', ?, ?, ?, 0, ?, 0, ?, ?)`,
  ).run(
    o.id,
    o.channel ?? "airplus",
    o.id.toUpperCase(),
    o.status ?? "delivered",
    o.at,
    o.at,
    o.grand,
    o.grand,
    o.cost == null ? null : o.grand - o.cost,
    o.customer ?? null,
  );
  if (o.productId) {
    db.prepare(
      `INSERT INTO sales_order_lines (id, sales_order_id, product_variant_id, quantity,
                                      unit_price_satang, unit_cost_satang, line_total_satang, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(`${o.id}-l1`, o.id, `${o.productId}-v`, o.qty ?? 1, o.grand, o.cost ?? 0, o.grand, o.at);
  }
}

/** sales_orders.storefront_customer_id is a real FK, so a linked buyer must exist first. */
function seedCustomer(db: DatabaseSync, id: string) {
  db.prepare(
    `INSERT INTO storefront_customers (id, phone, name, created_at, updated_at, customer_code)
     VALUES (?, ?, ?, 0, 0, ?)`,
  ).run(id, `08${id}`, id, `AP-${id}`);
}

function seedProduct(db: DatabaseSync, id: string, name: string) {
  db.prepare(
    `INSERT INTO products (id, name, product_ref, created_at, updated_at) VALUES (?, ?, ?, 0, 0)`,
  ).run(id, name, id.toUpperCase());
  db.prepare(
    `INSERT INTO product_variants (id, product_id, sku, created_at) VALUES (?, ?, ?, 0)`,
  ).run(`${id}-v`, id, `${id}-sku`);
}

function seedEvent(
  db: DatabaseSync,
  e: { at: number; kind: string; visitor: string; source?: string; productId?: string },
) {
  db.prepare(
    `INSERT INTO storefront_events (id, occurred_at, kind, visitor_hash, source, path, product_id)
     VALUES (?, ?, ?, ?, ?, '/', ?)`,
  ).run(`e-${Math.random()}`, e.at, e.kind, e.visitor, e.source ?? "direct", e.productId ?? null);
}

describe("insightsFor > empty shop", () => {
  it("given no data at all > then every number is zero and nothing is NaN", async () => {
    // The state AirPlus is genuinely in today: live, but with no real orders. The page must read
    // as a calm set of zeros, not as a wall of NaN or a crash.
    const payload = await insightsFor(asD1(migratedDb()), "realtime", NOW);
    for (const v of Object.values(payload.totals)) expect(v).toBe(0);
    for (const v of Object.values(payload.previous)) expect(v).toBe(0);
    expect(payload.products).toEqual([]);
    expect(payload.sources).toEqual([]);
    expect(payload.series.buckets).toHaveLength(24);
  });
});

describe("insightsFor > money totals", () => {
  it("given orders today and yesterday > then only today's count, and yesterday is the base", async () => {
    const db = migratedDb();
    seedCustomer(db, "c1");
    seedCustomer(db, "c2");
    seedOrder(db, { id: "a", at: TODAY_13, grand: 45000, cost: 33000, customer: "c1" });
    seedOrder(db, { id: "b", at: YESTERDAY_13, grand: 125000, cost: 100000, customer: "c2" });

    const p = await insightsFor(asD1(db), "realtime", NOW);
    expect(p.totals.salesSatang).toBe(45000);
    expect(p.totals.orders).toBe(1);
    expect(p.totals.buyers).toBe(1);
    // The like-for-like base: 00:00-18:00 yesterday, which contains the 13:00 order.
    expect(p.previous.salesSatang).toBe(125000);
  });

  it("given a cancelled and an expired order > then neither is counted as a sale", async () => {
    const db = migratedDb();
    seedOrder(db, { id: "ok", at: TODAY_13, grand: 45000, cost: 33000 });
    seedOrder(db, { id: "x", at: TODAY_13, grand: 99900, cost: 1, status: "cancelled" });
    seedOrder(db, { id: "y", at: TODAY_13, grand: 88800, cost: 1, status: "expired" });

    const p = await insightsFor(asD1(db), "realtime", NOW);
    expect(p.totals.salesSatang).toBe(45000);
    expect(p.totals.orders).toBe(1);
  });

  it("given a Shopee order > then it is excluded; this page is AirPlus", async () => {
    const db = migratedDb();
    seedOrder(db, { id: "sp", at: TODAY_13, grand: 70000, cost: 50000, channel: "shopee" });
    expect((await insightsFor(asD1(db), "realtime", NOW)).totals.orders).toBe(0);
  });

  it("given a known cost > then profit is sales minus that cost", async () => {
    const db = migratedDb();
    seedProduct(db, "p1", "วาล์วแอร์");
    seedOrder(db, { id: "a", at: TODAY_13, grand: 45000, cost: 33000, productId: "p1" });

    const p = await insightsFor(asD1(db), "realtime", NOW);
    expect(p.totals.profitSatang).toBe(12000);
    expect(p.unknownCostOrders).toBe(0);
  });

  it("given an order with no cost snapshot > then sales count but profit does NOT", async () => {
    // The rule orderMoney already holds for one order, applied to the aggregate: an unmatched SKU
    // means no profit may be claimed. Adding it in as zero-cost would invent margin out of nothing.
    const db = migratedDb();
    seedProduct(db, "p1", "วาล์วแอร์");
    seedOrder(db, { id: "known", at: TODAY_13, grand: 45000, cost: 33000, productId: "p1" });
    seedOrder(db, { id: "unknown", at: TODAY_13, grand: 60000, cost: null });

    const p = await insightsFor(asD1(db), "realtime", NOW);
    expect(p.totals.salesSatang).toBe(105000);
    expect(p.totals.orders).toBe(2);
    expect(p.totals.profitSatang).toBe(12000);
    expect(p.unknownCostOrders).toBe(1);
  });

  it("given two orders from one customer > then buyers counts the person once", async () => {
    const db = migratedDb();
    seedCustomer(db, "c1");
    seedOrder(db, { id: "a", at: TODAY_13, grand: 10000, cost: 5000, customer: "c1" });
    seedOrder(db, { id: "b", at: TODAY_13, grand: 20000, cost: 5000, customer: "c1" });

    const p = await insightsFor(asD1(db), "realtime", NOW);
    expect(p.totals.orders).toBe(2);
    expect(p.totals.buyers).toBe(1);
  });
});

describe("insightsFor > traffic totals", () => {
  it("given repeat views from one visitor > then visitors counts them once, views every time", async () => {
    const db = migratedDb();
    seedEvent(db, { at: TODAY_13, kind: "page_view", visitor: "v1" });
    seedEvent(db, { at: TODAY_13, kind: "product_view", visitor: "v1", productId: "p1" });
    seedEvent(db, { at: TODAY_13, kind: "product_view", visitor: "v1", productId: "p1" });
    seedEvent(db, { at: TODAY_13, kind: "product_view", visitor: "v2", productId: "p1" });

    const p = await insightsFor(asD1(db), "realtime", NOW);
    expect(p.totals.visitors).toBe(2);
    expect(p.totals.productViews).toBe(3);
  });

  it("given one visitor adding twice > then addToCartVisitors counts the PERSON, not the adds", async () => {
    // Shopee's ผู้เข้าชมที่เพิ่มในรถเข็น is a headcount; counting adds would let one indecisive
    // shopper push the add-to-cart rate above 100%.
    const db = migratedDb();
    seedEvent(db, { at: TODAY_13, kind: "page_view", visitor: "v1" });
    seedEvent(db, { at: TODAY_13, kind: "add_to_cart", visitor: "v1", productId: "p1" });
    seedEvent(db, { at: TODAY_13, kind: "add_to_cart", visitor: "v1", productId: "p2" });

    const p = await insightsFor(asD1(db), "realtime", NOW);
    expect(p.totals.addToCartVisitors).toBe(1);
    expect(p.totals.visitors).toBe(1);
  });

  it("given events outside the window > then they are not counted", async () => {
    const db = migratedDb();
    seedEvent(db, { at: YESTERDAY_13, kind: "page_view", visitor: "old" });
    expect((await insightsFor(asD1(db), "realtime", NOW)).totals.visitors).toBe(0);
  });
});

describe("insightsFor > series", () => {
  it("given an order at 13:00 > then it lands in the 13:00 bucket and nowhere else", async () => {
    const db = migratedDb();
    seedOrder(db, { id: "a", at: TODAY_13, grand: 45000, cost: 33000 });

    const p = await insightsFor(asD1(db), "realtime", NOW);
    expect(p.series.totals[13]?.salesSatang).toBe(45000);
    expect(p.series.totals.reduce((n, t) => n + t.salesSatang, 0)).toBe(45000);
  });

  it("given a visitor at 13:00 > then that hour's visitor count is 1", async () => {
    const db = migratedDb();
    seedEvent(db, { at: TODAY_13, kind: "page_view", visitor: "v1" });

    const p = await insightsFor(asD1(db), "realtime", NOW);
    expect(p.series.totals[13]?.visitors).toBe(1);
    expect(p.series.totals[12]?.visitors).toBe(0);
  });

  it("given a 7d period > then there are seven daily buckets", async () => {
    const p = await insightsFor(asD1(migratedDb()), "7d", NOW);
    expect(p.series.buckets).toHaveLength(7);
    expect(p.series.totals).toHaveLength(7);
  });
});

describe("insightsFor > traffic sources", () => {
  it("given arrivals from several places > then each source is one row, biggest first", async () => {
    const db = migratedDb();
    seedEvent(db, { at: TODAY_13, kind: "page_view", visitor: "v1", source: "search" });
    seedEvent(db, { at: TODAY_13, kind: "page_view", visitor: "v2", source: "search" });
    seedEvent(db, { at: TODAY_13, kind: "page_view", visitor: "v3", source: "ai" });

    const p = await insightsFor(asD1(db), "realtime", NOW);
    expect(p.sources.map((s) => s.source)).toEqual(["search", "ai"]);
    expect(p.sources[0]?.visitors).toBe(2);
  });

  it("given internal navigation > then it is not listed as a traffic source", async () => {
    // A hop from the home page to a PDP is not an arrival; listing it would make the site its own
    // biggest referrer and bury every real source under it.
    const db = migratedDb();
    seedEvent(db, { at: TODAY_13, kind: "page_view", visitor: "v1", source: "internal" });
    seedEvent(db, { at: TODAY_13, kind: "page_view", visitor: "v2", source: "search" });

    const p = await insightsFor(asD1(db), "realtime", NOW);
    expect(p.sources.map((s) => s.source)).toEqual(["search"]);
  });
});

describe("insightsFor > product ranking", () => {
  it("given two products > then they rank by sales, carrying views and clicks", async () => {
    const db = migratedDb();
    seedProduct(db, "p1", "วาล์วแอร์ มิราจ");
    seedProduct(db, "p2", "คลัชคอม CRV");
    seedOrder(db, { id: "a", at: TODAY_13, grand: 45000, cost: 33000, productId: "p1" });
    seedOrder(db, { id: "b", at: TODAY_13, grand: 90000, cost: 60000, productId: "p2", qty: 2 });
    seedEvent(db, { at: TODAY_13, kind: "product_view", visitor: "v1", productId: "p1" });
    seedEvent(db, { at: TODAY_13, kind: "click", visitor: "v1", productId: "p1" });

    const p = await insightsFor(asD1(db), "realtime", NOW);
    expect(p.products.map((r) => r.productId)).toEqual(["p2", "p1"]);
    expect(p.products[0]?.name).toBe("คลัชคอม CRV");
    expect(p.products[0]?.units).toBe(2);
    expect(p.products[1]?.views).toBe(1);
    expect(p.products[1]?.clicks).toBe(1);
    expect(p.products[1]?.profitSatang).toBe(12000);
  });

  it("given a product only viewed, never bought > then it still ranks, with zero sales", async () => {
    // The most useful row on the whole page: interest that isn't converting.
    const db = migratedDb();
    seedProduct(db, "p1", "ตู้แอร์รีโว่");
    seedEvent(db, { at: TODAY_13, kind: "product_view", visitor: "v1", productId: "p1" });

    const p = await insightsFor(asD1(db), "realtime", NOW);
    expect(p.products).toHaveLength(1);
    expect(p.products[0]).toMatchObject({ productId: "p1", salesSatang: 0, views: 1, units: 0 });
  });
});
