import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { applySyncToDb, priceBillLines } from "./index";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

// VAT on every line while the shop's VAT billing switch is on (plan 10.2, owner 17 Nov 2026): a
// VAT-registered shop's prices include VAT on labour too, not only on parts. The server works it
// out; a figure sent by a phone is never trusted. Real schema, real migrations.

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations",
);

function shop() {
  const raw = new DatabaseSync(":memory:");
  for (const f of readdirSync(migrationsDir)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    raw.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  raw.exec("INSERT INTO products (id, name, created_at) VALUES ('comp', 'คอมเพรสเซอร์', 0)");
  raw.exec(
    "INSERT INTO product_variants (id, product_id, sku, created_at) VALUES ('v-comp', 'comp', 'COMP', 0)",
  );
  raw.exec(
    `INSERT INTO stock_ledger_entries (id, product_variant_id, movement_type, quantity_delta, quantity_after, created_at)
     VALUES ('s1', 'v-comp', 'receive', 5, 5, 0)`,
  );
  const db = {
    prepare: (sql: string) => {
      let binds: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          binds = args;
          return stmt;
        },
        async all<T>() {
          return { results: raw.prepare(sql).all(...(binds as never[])) as T[] };
        },
        async first<T>() {
          return (raw.prepare(sql).get(...(binds as never[])) as T | undefined) ?? null;
        },
        __exec() {
          return raw.prepare(sql).run(...(binds as never[]));
        },
      };
      return stmt;
    },
    async batch(stmts: { __exec: () => unknown }[]) {
      raw.exec("BEGIN");
      try {
        const out = stmts.map((s) => s.__exec());
        raw.exec("COMMIT");
        return out;
      } catch (err) {
        raw.exec("ROLLBACK");
        throw err;
      }
    },
  } as unknown as D1Database;
  return { raw, db };
}

const labour = {
  lineType: "service" as const,
  description: "ค่าแรงเปลี่ยนคอม",
  quantity: 1,
  unitPriceSatang: 107_000,
};
const part = {
  lineType: "part" as const,
  productVariantId: "v-comp",
  description: "คอมเพรสเซอร์",
  quantity: 1,
  unitPriceSatang: 214_000,
};

describe("priceBillLines > VAT on every line", () => {
  it("given VAT billing on > then labour carries 7% inside its price, like parts", async () => {
    const { db } = shop();
    const [l, p] = await priceBillLines(db, [labour, part], { vatOn: true });
    expect(l).toMatchObject({ taxSatang: 7_000, grossProfitSatang: 100_000 });
    expect(p).toMatchObject({ taxSatang: 14_000 });
  });

  it("given VAT billing off > then no line carries VAT", async () => {
    const { db } = shop();
    const [l, p] = await priceBillLines(db, [labour, part], { vatOn: false });
    expect(l).toMatchObject({ taxSatang: 0, grossProfitSatang: 107_000 });
    expect(p).toMatchObject({ taxSatang: 0 });
  });

  it("given a VAT figure sent by a phone > then the server's own is used", async () => {
    const { db } = shop();
    const [l] = await priceBillLines(db, [{ ...labour, taxSatang: 1 }], { vatOn: true });
    expect(l?.taxSatang).toBe(7_000);
  });
});

describe("applySyncToDb > the counter's bill carries VAT on labour", () => {
  const sale = (clientUuid: string) => ({
    clientUuid,
    saleNumber: `DAS-${clientUuid}`,
    paymentMethod: "cash",
    lines: [labour, part],
  });
  const taxOf = (raw: DatabaseSync, clientUuid: string) =>
    raw
      .prepare(
        `SELECT s.tax_total_satang AS total,
                (SELECT tax_satang FROM onsite_sale_lines WHERE onsite_sale_id = s.id AND line_type = 'service') AS labour
         FROM onsite_sales s WHERE s.client_uuid = ?`,
      )
      .get(clientUuid);

  it("given VAT billing on (the default) > then the labour line and the bill's VAT include it", async () => {
    const { raw, db } = shop();
    await applySyncToDb(db, [sale("on")]);
    expect(taxOf(raw, "on")).toEqual({ total: 21_000, labour: 7_000 });
  });

  it("given VAT billing off > then the bill carries none", async () => {
    const { raw, db } = shop();
    await applySyncToDb(db, [sale("off")], { vatOn: false });
    expect(taxOf(raw, "off")).toEqual({ total: 0, labour: 0 });
  });
});
