import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { listStockMovements } from "./stockMovements";

// ── ประวัติซื้อขาย (owner approved the drawing, 1 Nov 2026): every stock change with the product's
// code and photo, a sale's price, and a date range. Run against a real SQLite built from the real
// migrations, so the joins to the sale lines are proven on the real columns.

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations",
);

function fresh() {
  const raw = new DatabaseSync(":memory:");
  for (const f of readdirSync(migrationsDir)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    raw.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  const db = {
    prepare: (sql: string) => {
      let binds: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          binds = args;
          return stmt;
        },
        async all<T = unknown>(): Promise<{ results: T[] }> {
          return { results: raw.prepare(sql).all(...(binds as never[])) as T[] };
        },
      };
      return stmt;
    },
  } as unknown as D1Database;
  return { raw, db };
}

function product(
  raw: DatabaseSync,
  p: { id: string; name: string; ref: string; imageKey?: string; status?: string },
) {
  raw
    .prepare(
      "INSERT INTO products (id, name, product_ref, image_key, status, created_at) VALUES (?, ?, ?, ?, ?, 0)",
    )
    .run(p.id, p.name, p.ref, p.imageKey ?? null, p.status ?? "active");
  raw
    .prepare("INSERT INTO product_variants (id, product_id, sku, created_at) VALUES (?, ?, ?, 0)")
    .run(`v-${p.id}`, p.id, p.ref);
}

function move(
  raw: DatabaseSync,
  m: {
    id: string;
    productId: string;
    type: string;
    delta: number;
    after: number;
    at: number;
    sourceType?: string;
    sourceId?: string;
  },
) {
  raw
    .prepare(
      `INSERT INTO stock_ledger_entries
         (id, product_variant_id, movement_type, quantity_delta, quantity_after, source_type, source_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      m.id,
      `v-${m.productId}`,
      m.type,
      m.delta,
      m.after,
      m.sourceType ?? null,
      m.sourceId ?? null,
      m.at,
    );
}

describe("listStockMovements", () => {
  it("given an on-site sale > returns the product's code and photo and the price it sold for", async () => {
    const { raw, db } = fresh();
    product(raw, { id: "p1", name: "คอมเพรสเซอร์ DENSO 10S11C", ref: "DN-447220", imageKey: "k1" });
    raw.exec("INSERT INTO onsite_sales (id, client_uuid, created_at) VALUES ('s1', 'c1', 1000)");
    raw
      .prepare(
        `INSERT INTO onsite_sale_lines (id, onsite_sale_id, product_variant_id, quantity, unit_price_satang)
         VALUES ('l1', 's1', 'v-p1', 1, 345000)`,
      )
      .run();
    move(raw, {
      id: "m1",
      productId: "p1",
      type: "onsite_sale",
      delta: -1,
      after: 4,
      at: 1000,
      sourceType: "onsite_sale",
      sourceId: "s1",
    });

    const out = await listStockMovements(db, null);

    expect(out.movements).toEqual([
      {
        id: "m1",
        variantId: "v-p1",
        sku: "DN-447220",
        productName: "คอมเพรสเซอร์ DENSO 10S11C",
        productRef: "DN-447220",
        imageKey: "k1",
        movementType: "onsite_sale",
        quantityDelta: -1,
        quantityAfter: 4,
        salePriceSatang: 345000,
        createdAt: 1000,
      },
    ]);
  });

  it("given an online sale > returns the price on its order line", async () => {
    const { raw, db } = fresh();
    product(raw, { id: "p2", name: "วาล์วแอร์ DENSO Vigo", ref: "DN-447500" });
    raw.exec(
      `INSERT INTO sales_orders (id, channel, external_order_id, imported_at)
       VALUES ('o1', 'airplus', 'AP-1', 0)`,
    );
    raw.exec(
      `INSERT INTO sales_order_lines
         (id, sales_order_id, product_variant_id, quantity, unit_price_satang, line_total_satang, created_at)
       VALUES ('ol1', 'o1', 'v-p2', 2, 120000, 240000, 0)`,
    );
    move(raw, {
      id: "m2",
      productId: "p2",
      type: "online_sale",
      delta: -2,
      after: 0,
      at: 2000,
      sourceType: "sales_order",
      sourceId: "o1",
    });

    const out = await listStockMovements(db, null);

    expect(out.movements.map((m) => [m.id, m.salePriceSatang])).toEqual([["m2", 120000]]);
  });

  it("given a date range > returns only the changes inside it, both ends included, newest first", async () => {
    const { raw, db } = fresh();
    product(raw, { id: "p3", name: "แผงร้อน Honda City 2014", ref: "HC-14" });
    for (const [id, at] of [
      ["before", 999],
      ["first", 1000],
      ["middle", 1500],
      ["last", 2000],
      ["after", 2001],
    ] as const) {
      move(raw, { id, productId: "p3", type: "receive", delta: 1, after: 1, at });
    }

    const out = await listStockMovements(db, { from: 1000, to: 2000 });

    expect(out.movements.map((m) => [m.id, m.salePriceSatang])).toEqual([
      ["last", null],
      ["middle", null],
      ["first", null],
    ]);
  });

  it("given 150 changes > lists the latest 100, but up to 500 inside a date range, and says which", async () => {
    const { raw, db } = fresh();
    product(raw, { id: "p4", name: "โบลเวอร์ DENSO Altis", ref: "DN-116340" });
    for (let i = 1; i <= 150; i++) {
      move(raw, { id: `m${i}`, productId: "p4", type: "receive", delta: 1, after: i, at: i });
    }

    const latest = await listStockMovements(db, null);
    const inRange = await listStockMovements(db, { from: 1, to: 150 });

    expect([latest.movements.length, latest.limit, latest.movements[0]?.id]).toEqual([
      100,
      100,
      "m150",
    ]);
    expect([inRange.movements.length, inRange.limit]).toEqual([150, 500]);
  });
});
