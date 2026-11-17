import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { D1Database } from "@cloudflare/workers-types";
import { listHeldCoupons, listWebCouponRows } from "./db";

/**
 * The coupons the website reads (plan 8.7): the coupon list (แสดงบนเว็บ on) and My coupons, each
 * with its name and the names of what it is for. Real migrations; foreign keys off so a redemption
 * needs no whole order behind it.
 */

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/db/migrations",
);

function shop(): DatabaseSync {
  const db = new DatabaseSync(":memory:", { enableForeignKeyConstraints: false });
  for (const f of readdirSync(migrationsDir)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    db.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  db.prepare(
    `INSERT INTO storefront_customers (id, phone, name, created_at, updated_at, customer_code)
     VALUES ('c1', '0811111111', 'สมชาย', 1500, 1500, 'C-1')`,
  ).run();
  return db;
}

/** The slice of D1 the storefront reads use. */
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
    };
    return stmt;
  };
  return { prepare: make } as unknown as D1Database;
}

function coupon(
  db: DatabaseSync,
  id: string,
  over: { web?: 0 | 1; status?: string; scope?: string; signup?: [number, number] } = {},
) {
  db.prepare(
    `INSERT INTO coupons (id, code, name, type, value, status, scope, show_on_web, signup_from,
                          signup_to, valid_days, max_uses, created_at)
     VALUES (?, ?, ?, 'fixed', 30000, ?, ?, ?, ?, ?, ?, 100, 1)`,
  ).run(
    id,
    id.toUpperCase(),
    `ชื่อ ${id}`,
    over.status ?? "active",
    over.scope ?? "all",
    over.web ?? 1,
    over.signup?.[0] ?? null,
    over.signup?.[1] ?? null,
    over.signup ? 365 : null,
  );
}

describe("listWebCouponRows > the coupons the owner put on the website", () => {
  it("given coupons on and off the web, switched off, and ลูกค้าใหม่ > then only the ones on the web for everyone", async () => {
    const raw = shop();
    coupon(raw, "web");
    coupon(raw, "codeonly", { web: 0 });
    coupon(raw, "off", { status: "disabled" });
    coupon(raw, "welcome", { signup: [1000, 2000] });
    const rows = await listWebCouponRows(asD1(raw), null);
    expect(rows.map((r) => r.code)).toEqual(["WEB"]);
    expect(rows[0]).toMatchObject({ name: "ชื่อ web", targets: [], total: 0, byCustomer: 0 });
  });

  it("given a brand coupon used twice, once by this customer > then the brand's name and both counts", async () => {
    const raw = shop();
    coupon(raw, "denso", { scope: "brand" });
    raw
      .prepare(`INSERT INTO coupon_targets (coupon_id, target_id) VALUES ('denso', 'br-denso')`)
      .run();
    for (const [id, who] of [
      ["r1", "c1"],
      ["r2", "c2"],
    ]) {
      raw
        .prepare(
          `INSERT INTO coupon_redemptions (id, coupon_id, customer_id, sales_order_id,
                                           amount_discounted_satang, created_at)
           VALUES (?, 'denso', ?, ?, 30000, 1)`,
        )
        .run(id, who, `o-${id}`);
    }
    const [row] = await listWebCouponRows(asD1(raw), "c1");
    expect(row).toMatchObject({ targets: ["DENSO"], total: 2, byCustomer: 1, maxUses: 100 });
  });
});

describe("listHeldCoupons > My coupons, with names", () => {
  it("given a ลูกค้าใหม่ coupon for one brand > then its name and the brand's name come along", async () => {
    const raw = shop();
    coupon(raw, "welcome", { scope: "brand", signup: [1000, 2000] });
    raw
      .prepare(`INSERT INTO coupon_targets (coupon_id, target_id) VALUES ('welcome', 'br-sanden')`)
      .run();
    const held = await listHeldCoupons(asD1(raw), "c1");
    expect(held?.rows[0]).toMatchObject({ name: "ชื่อ welcome", targets: ["Sanden"] });
  });
});
