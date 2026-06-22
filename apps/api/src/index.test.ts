import { describe, it, expect } from "vitest";
import worker, { type Env } from "./index";

const ctx = {} as ExecutionContext;

/** Minimal D1 mock: prepare()/bind()/all() keyed by SQL substring, batch() records statements. */
function makeDb(canned: {
  products?: unknown[];
  existing?: string[];
  available?: { variantId: string; available: number }[];
}) {
  const batched: { sql: string }[] = [];
  const make = (sql: string) => {
    const stmt = {
      sql,
      bind(..._args: unknown[]) {
        return stmt;
      },
      async all<T = unknown>(): Promise<{ results: T[] }> {
        if (sql.includes("FROM products")) return { results: (canned.products ?? []) as T[] };
        if (sql.includes("client_uuid IN"))
          return { results: (canned.existing ?? []).map((u) => ({ clientUuid: u })) as T[] };
        if (sql.includes("SUM(quantity_delta)"))
          return { results: (canned.available ?? []) as T[] };
        return { results: [] as T[] };
      },
    };
    return stmt;
  };
  const db = {
    prepare: (sql: string) => make(sql),
    batch: async (stmts: { sql: string }[]) => {
      batched.push(...stmts);
      return stmts.map(() => ({}));
    },
  };
  return { env: { DB: db } as unknown as Env, batched };
}

describe("api worker", () => {
  it("GET /health > 200 ok", async () => {
    const res = await worker.fetch!(new Request("https://x/health"), {} as Env, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: "kiraoffice-api" });
  });

  it("POST /pricing/preview > computes profit via core", async () => {
    const res = await worker.fetch!(
      new Request("https://x/pricing/preview", {
        method: "POST",
        body: JSON.stringify({
          unitPrice: 107,
          quantity: 1,
          vatRate: 0.07,
          priceIncludesVat: true,
          landedUnitCost: 60,
          channel: "onsite",
        }),
      }),
      {} as Env,
      ctx,
    );
    const body = (await res.json()) as { grossProfit: number; salesExTax: number };
    expect(body.grossProfit).toBe(40);
    expect(body.salesExTax).toBe(100);
  });

  it("unknown route > 404", async () => {
    const res = await worker.fetch!(new Request("https://x/nope"), {} as Env, ctx);
    expect(res.status).toBe(404);
  });

  it("GET /products > reads from D1", async () => {
    const { env } = makeDb({
      products: [{ id: "p1", productCode: "C1", name: "Cream", status: "active" }],
    });
    const res = await worker.fetch!(new Request("https://x/products"), env, ctx);
    expect(await res.json()).toEqual({
      products: [{ id: "p1", productCode: "C1", name: "Cream", status: "active" }],
    });
  });

  it("POST /sync > applies a fresh sale (header + line + ledger)", async () => {
    const { env, batched } = makeDb({
      existing: [],
      available: [{ variantId: "v1", available: 10 }],
    });
    const res = await worker.fetch!(
      new Request("https://x/sync", {
        method: "POST",
        body: JSON.stringify({
          sales: [
            {
              clientUuid: "u1",
              lines: [{ productVariantId: "v1", quantity: 2, unitPriceSatang: 10700 }],
            },
          ],
        }),
      }),
      env,
      ctx,
    );
    expect(await res.json()).toEqual({ applied: 1, duplicates: 0, conflicts: [] });
    expect(batched.length).toBe(3); // onsite_sales + line + ledger
  });

  it("POST /sync > skips an already-applied sale (idempotent)", async () => {
    const { env, batched } = makeDb({ existing: ["u1"] });
    const res = await worker.fetch!(
      new Request("https://x/sync", {
        method: "POST",
        body: JSON.stringify({
          sales: [
            {
              clientUuid: "u1",
              lines: [{ productVariantId: "v1", quantity: 1, unitPriceSatang: 100 }],
            },
          ],
        }),
      }),
      env,
      ctx,
    );
    expect(await res.json()).toEqual({ applied: 0, duplicates: 1, conflicts: [] });
    expect(batched.length).toBe(0);
  });

  it("POST /sync > surfaces an oversell conflict, still records the sale", async () => {
    const { env } = makeDb({ existing: [], available: [{ variantId: "v1", available: 1 }] });
    const res = await worker.fetch!(
      new Request("https://x/sync", {
        method: "POST",
        body: JSON.stringify({
          sales: [
            {
              clientUuid: "u2",
              lines: [{ productVariantId: "v1", quantity: 5, unitPriceSatang: 5000 }],
            },
          ],
        }),
      }),
      env,
      ctx,
    );
    const out = (await res.json()) as {
      applied: number;
      conflicts: { productVariantId: string; requested: number; available: number }[];
    };
    expect(out.applied).toBe(1);
    expect(out.conflicts).toEqual([{ productVariantId: "v1", requested: 5, available: 1 }]);
  });
});
