import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { D1Database } from "@cloudflare/workers-types";
import { carModelOptions } from "./db";

/**
 * Plan 13.1 (owner, 21 Nov 2026: "now, first"): the shop read about 211 million rows a day from a
 * 2.6 MB database. Cloudflare's query list for the 7 days to 21 Nov showed why: the รถของฉัน model
 * list read ~100,000 rows a visit (it scanned every fitment again for each car model), and the
 * product list ~25,000 (each latest-price lookup read the whole price table, which had no index).
 * Every test runs against a real sqlite built from the real migrations.
 */

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/db/migrations",
);

function migrated(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(migrationsDir)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    db.exec("BEGIN");
    db.exec(readFileSync(join(migrationsDir, f), "utf8"));
    db.exec("COMMIT");
  }
  return db;
}

/** The slice of D1 the storefront reads use, keeping every query it is handed. */
function asD1(db: DatabaseSync, seen: string[]): D1Database {
  const make = (sql: string) => {
    seen.push(sql);
    let binds: unknown[] = [];
    const stmt = {
      bind(...args: unknown[]) {
        binds = args;
        return stmt;
      },
      async all<T = unknown>(): Promise<{ results: T[] }> {
        return { results: db.prepare(sql).all(...(binds as never[])) as T[] };
      },
    };
    return stmt;
  };
  return { prepare: (sql: string) => make(sql) } as unknown as D1Database;
}

/** How sqlite runs a query: one line per table it scans or searches. */
function plan(raw: DatabaseSync, sql: string, binds: unknown[] = []): string[] {
  return (
    raw.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...(binds as never[])) as { detail: string }[]
  ).map((r) => r.detail);
}

const NOW = Date.now();
const BRAND = "ทดสอบมอเตอร์";

function seedCars(raw: DatabaseSync) {
  raw
    .prepare(`INSERT INTO car_brands (id, name, sort_order, created_at) VALUES ('cb-t', ?, 999, ?)`)
    .run(BRAND, NOW);
  const model = (id: string, name: string, from: number | null, to: number | null, order: number) =>
    raw
      .prepare(
        `INSERT INTO car_models (id, car_brand_id, name, year_from, year_to, sort_order, created_at)
         VALUES (?, 'cb-t', ?, ?, ?, ?, ?)`,
      )
      .run(id, name, from, to, order, NOW);
  model("cm-a1", "รุ่นเอ", 2010, 2015, 1);
  model("cm-a2", "รุ่นเอ", 2016, 2020, 1);
  model("cm-b", "รุ่นบี", null, null, 2);
  model("cm-c", "รุ่นซี", null, null, 3);
}

function addProduct(raw: DatabaseSync, id: string, status: string) {
  raw
    .prepare(
      `INSERT INTO products (id, product_ref, name, status, created_at, type_id, brand_id)
       VALUES (?, ?, ?, ?, ?, 'pt-evaporator', 'br-denso')`,
    )
    .run(id, `REF-${id}`, `ตู้แอร์ ${id}`, status, NOW);
}

/** A variant and its stock moves (each a ledger row), the way the back office saves stock. */
function addVariant(raw: DatabaseSync, id: string, product: string, moves: number[]) {
  raw
    .prepare(
      `INSERT INTO product_variants (id, product_id, sku, barcode_primary, status, created_at)
       VALUES (?, ?, ?, ?, 'active', ?)`,
    )
    .run(id, product, `SKU-${id}`, `BC-${id}`, NOW);
  let after = 0;
  moves.forEach((delta, i) => {
    after += delta;
    raw
      .prepare(
        `INSERT INTO stock_ledger_entries (id, product_variant_id, movement_type, quantity_delta,
           quantity_after, created_at)
         VALUES (?, ?, 'manual_adjustment', ?, ?, ?)`,
      )
      .run(`${id}-m${i}`, id, delta, after, NOW + i);
  });
}

function fit(raw: DatabaseSync, id: string, product: string, model: string, yearFrom?: number) {
  raw
    .prepare(
      `INSERT INTO product_fitments (id, product_id, car_brand, car_model, year_from, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, product, BRAND, model, yearFrom ?? null, NOW);
}

describe("shop reads (plan 13.1)", () => {
  it("a product's latest price > given the price table > then it is found by index, not by reading every price", () => {
    const raw = migrated();
    const sql =
      "SELECT id FROM pricing_profiles WHERE product_variant_id = ? ORDER BY active_from DESC LIMIT 1";
    expect(plan(raw, sql, ["v1"]).join(" | ")).toMatch(
      /SEARCH pricing_profiles USING (COVERING )?INDEX/,
    );
  });

  it("products fitted to one car > given a brand and model > then they are found by index", () => {
    const raw = migrated();
    const sql = "SELECT product_id FROM product_fitments WHERE car_brand = ? AND car_model = ?";
    expect(plan(raw, sql, ["Toyota", "Vigo"]).join(" | ")).toMatch(
      /SEARCH product_fitments USING (COVERING )?INDEX/,
    );
  });

  it("carModelOptions > given many car models > then the fitments are read once, not again for each model", async () => {
    const raw = migrated();
    const seen: string[] = [];
    await carModelOptions(asD1(raw, seen));
    const sql = seen.find((s) => s.includes("car_models"));
    expect(sql).toBeDefined();
    expect(plan(raw, sql!).filter((d) => /CORRELATED/.test(d))).toEqual([]);
  });

  it("carModelOptions > given in-stock, sold-out, hidden and unfitted products > then each model counts its active in-stock products once", async () => {
    const raw = migrated();
    seedCars(raw);
    // In stock, fitted to รุ่นเอ twice (two year ranges): counts once for each รุ่นเอ era.
    addProduct(raw, "p-in", "active");
    addVariant(raw, "v-in", "p-in", [2]);
    fit(raw, "f1", "p-in", "รุ่นเอ", 2012);
    fit(raw, "f2", "p-in", "รุ่นเอ", 2018);
    // Sold out (in, then out): not counted.
    addProduct(raw, "p-sold", "active");
    addVariant(raw, "v-sold", "p-sold", [1, -1]);
    fit(raw, "f3", "p-sold", "รุ่นเอ");
    // In stock but paused: not counted.
    addProduct(raw, "p-paused", "paused");
    addVariant(raw, "v-paused", "p-paused", [3]);
    fit(raw, "f4", "p-paused", "รุ่นบี");
    // Two sizes, only one in stock: counts once.
    addProduct(raw, "p-two", "active");
    addVariant(raw, "v-two-a", "p-two", []);
    addVariant(raw, "v-two-b", "p-two", [5]);
    fit(raw, "f5", "p-two", "รุ่นบี");

    const ours = (await carModelOptions(asD1(raw, []))).filter((o) => o.brand === BRAND);
    expect(ours).toEqual([
      { brand: BRAND, model: "รุ่นเอ", yearFrom: 2010, yearTo: 2015, productCount: 1 },
      { brand: BRAND, model: "รุ่นเอ", yearFrom: 2016, yearTo: 2020, productCount: 1 },
      { brand: BRAND, model: "รุ่นบี", yearFrom: null, yearTo: null, productCount: 1 },
      { brand: BRAND, model: "รุ่นซี", yearFrom: null, yearTo: null, productCount: 0 },
    ]);
  });
});
