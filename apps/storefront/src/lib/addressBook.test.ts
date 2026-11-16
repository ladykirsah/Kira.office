import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { D1Database } from "@cloudflare/workers-types";
import { deleteOwnAddress, findOwnAddress, hasOwnAddress, listOwnAddresses } from "./addressBook";

const MIGRATIONS = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/db/migrations",
);

/** The real schema (foreign keys on), behind the slice of D1 the code uses. */
function shop() {
  const raw = new DatabaseSync(":memory:");
  for (const f of readdirSync(MIGRATIONS)
    .filter((n) => n.endsWith(".sql"))
    .sort())
    raw.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  const prepare = (sql: string) => {
    let binds: unknown[] = [];
    const stmt = {
      bind: (...args: unknown[]) => ((binds = args), stmt),
      first: async () => raw.prepare(sql).get(...(binds as never[])) ?? null,
      all: async () => ({ results: raw.prepare(sql).all(...(binds as never[])) }),
      run: async () => {
        const r = raw.prepare(sql).run(...(binds as never[]));
        return { meta: { changes: Number(r.changes) } };
      },
    };
    return stmt;
  };
  raw
    .prepare(
      `INSERT INTO storefront_customers (id, phone, name, created_at, updated_at, customer_code)
       VALUES ('c1','0811111111','สมชาย',1,1,'C-1')`,
    )
    .run();
  // "used" is the default and an order went to it; "claimed" got a claim's replacement part.
  for (const [id, isDefault, at] of [
    ["used", 1, 1],
    ["claimed", 0, 2],
    ["spare", 0, 3],
  ] as const)
    raw
      .prepare(
        `INSERT INTO addresses (id, storefront_customer_id, recipient_name, phone, address_line1,
           subdistrict, district, province, postal_code, is_default, created_at)
         VALUES (?, 'c1', 'สมชาย', '0811111111', '1 ถนน', 'แขวง', 'เขต', 'กรุงเทพมหานคร', '10110', ?, ?)`,
      )
      .run(id, isDefault, at);
  raw
    .prepare(
      `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status,
         subtotal_satang, grand_total_satang, imported_at, storefront_customer_id, shipping_address_id)
       VALUES ('o1','airplus','AP-1','complete','paid',100,100,1,'c1','used')`,
    )
    .run();
  raw
    .prepare(
      `INSERT INTO order_claims (id, sales_order_id, kind, created_at, updated_at, replacement_address_id)
       VALUES ('k1','o1','defect',1,1,'claimed')`,
    )
    .run();
  return { raw, db: { prepare } as unknown as D1Database };
}

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

/**
 * Bug hunt 15 Nov 2026 + owner's pick A (16 Nov 2026, "fix both fully"): removing an address an
 * order was sent to used to answer "system error". Now it leaves the customer's list the Shopee way,
 * and the order keeps its delivery address.
 */
describe("deleteOwnAddress", () => {
  it("given an address an order was sent to > then it leaves the customer's list and the order keeps it", async () => {
    const { raw, db } = shop();
    const out = await deleteOwnAddress(db, "c1", "used");
    expect(out).toEqual({ status: 200, body: { ok: true } });
    expect(ids(await listOwnAddresses(db, "c1"))).toEqual(["spare", "claimed"]);
    const row = raw.prepare(`SELECT hidden_at, is_default FROM addresses WHERE id = 'used'`).get();
    expect(row).toMatchObject({ is_default: 0 });
    expect((row as { hidden_at: number | null }).hidden_at).not.toBeNull();
  });

  it("given an address a claim's replacement went to > then it is hidden too, not a system error", async () => {
    const { raw, db } = shop();
    expect((await deleteOwnAddress(db, "c1", "claimed")).status).toBe(200);
    expect(raw.prepare(`SELECT COUNT(*) AS n FROM addresses WHERE id = 'claimed'`).get()).toEqual({
      n: 1,
    });
    expect(ids(await listOwnAddresses(db, "c1"))).toEqual(["used", "spare"]);
  });

  it("given an address nothing used > then it is deleted", async () => {
    const { raw, db } = shop();
    expect((await deleteOwnAddress(db, "c1", "spare")).status).toBe(200);
    expect(raw.prepare(`SELECT COUNT(*) AS n FROM addresses WHERE id = 'spare'`).get()).toEqual({
      n: 0,
    });
  });

  it("given someone else's address, or one already removed > then not found", async () => {
    const { db } = shop();
    expect((await deleteOwnAddress(db, "someone-else", "spare")).status).toBe(404);
    await deleteOwnAddress(db, "c1", "used");
    expect((await deleteOwnAddress(db, "c1", "used")).status).toBe(404);
  });
});

describe("the address book after a removal", () => {
  it("listOwnAddresses > the default comes first, then the newest", async () => {
    const { db } = shop();
    const list = await listOwnAddresses(db, "c1");
    expect(ids(list)).toEqual(["used", "spare", "claimed"]);
    expect(list[0]).toMatchObject({ isDefault: true, postalCode: "10110" });
  });

  it("findOwnAddress > a removed address can't be picked at checkout or made the default", async () => {
    const { db } = shop();
    expect(await findOwnAddress(db, "c1", "used")).toEqual({ id: "used", postalCode: "10110" });
    await deleteOwnAddress(db, "c1", "used");
    expect(await findOwnAddress(db, "c1", "used")).toBeNull();
    expect(await findOwnAddress(db, "someone-else", "spare")).toBeNull();
  });

  it("hasOwnAddress > with only removed addresses left > then a new address becomes the default", async () => {
    const { raw, db } = shop();
    expect(await hasOwnAddress(db, "c1")).toBe(true);
    raw.prepare(`DELETE FROM addresses WHERE id = 'spare'`).run();
    await deleteOwnAddress(db, "c1", "used");
    await deleteOwnAddress(db, "c1", "claimed");
    expect(await hasOwnAddress(db, "c1")).toBe(false);
  });
});
