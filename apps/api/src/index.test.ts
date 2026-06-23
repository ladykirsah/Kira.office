import { describe, it, expect, vi } from "vitest";
import worker, {
  applySyncToDb,
  createProduct,
  importProducts,
  importShopeeOrders,
  lineGrossProfitSatang,
  storeProductImage,
  type Env,
} from "./index";

// `cloudflare:workers` is a Workers-runtime virtual module that doesn't exist under Node/vitest.
// Stub its DurableObject base so importing the Worker (which extends it) works in tests.
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

const ctx = {} as ExecutionContext;

/** Minimal D1 mock: prepare()/bind()/all() keyed by SQL substring, batch() records statements. */
function makeDb(canned: {
  products?: unknown[];
  existing?: string[];
  available?: { variantId: string; available: number }[];
  existingOrders?: string[];
  existingProduct?: { id: string } | null;
  sales?: unknown[];
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
        if (sql.includes("FROM sales_orders"))
          return { results: (canned.existingOrders ?? []).map((id) => ({ id })) as T[] };
        if (sql.includes("FROM onsite_sales")) return { results: (canned.sales ?? []) as T[] };
        return { results: [] as T[] };
      },
      async first<T = unknown>(): Promise<T | null> {
        if (sql.includes("FROM products WHERE product_code"))
          return (canned.existingProduct ?? null) as T | null;
        return null;
      },
      async run() {
        return { success: true };
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
  } as unknown as D1Database;
  return { db, env: { DB: db } as unknown as Env, batched };
}

describe("api worker routes", () => {
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

  it("GET /sales > reads recent sales from D1", async () => {
    const sale = {
      id: "s1",
      paymentMethod: "cash",
      grandTotalSatang: 10000,
      taxTotalSatang: 700,
      saleStatus: "completed",
      createdAt: 1,
      grossProfitSatang: 4000,
    };
    const { env } = makeDb({ sales: [sale] });
    const res = await worker.fetch!(new Request("https://x/sales"), env, ctx);
    expect(await res.json()).toEqual({ sales: [sale] });
  });

  it("GET /img/:key > serves an object from R2", async () => {
    const env = {
      IMAGES: {
        get: async (k: string) =>
          k === "products/p1/a.png"
            ? { body: "BYTES", httpMetadata: { contentType: "image/png" } }
            : null,
      },
    } as unknown as Env;
    const res = await worker.fetch!(new Request("https://x/img/products/p1/a.png"), env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it("GET /img/:key > 404 when the object is missing", async () => {
    const env = { IMAGES: { get: async () => null } } as unknown as Env;
    const res = await worker.fetch!(new Request("https://x/img/nope.png"), env, ctx);
    expect(res.status).toBe(404);
  });

  it("POST /sync > routes through the StockLedger Durable Object", async () => {
    const env = {
      STOCK_LEDGER: {
        idFromName: (_name: string) => ({}),
        get: (_id: unknown) => ({
          applySync: async (sales: unknown[]) => ({
            applied: sales.length,
            duplicates: 0,
            conflicts: [],
          }),
        }),
      },
    } as unknown as Env;
    const res = await worker.fetch!(
      new Request("https://x/sync", {
        method: "POST",
        body: JSON.stringify({ sales: [{ clientUuid: "u1", lines: [] }] }),
      }),
      env,
      ctx,
    );
    expect(await res.json()).toEqual({ applied: 1, duplicates: 0, conflicts: [] });
  });
});

describe("applySyncToDb (single-writer sync logic)", () => {
  it("applies a fresh sale (header + line + ledger)", async () => {
    const { db, batched } = makeDb({
      existing: [],
      available: [{ variantId: "v1", available: 10 }],
    });
    const out = await applySyncToDb(db, [
      {
        clientUuid: "u1",
        lines: [{ productVariantId: "v1", quantity: 2, unitPriceSatang: 10700 }],
      },
    ]);
    expect(out).toEqual({ applied: 1, duplicates: 0, conflicts: [] });
    expect(batched.length).toBe(3); // onsite_sales + line + ledger
  });

  it("skips an already-applied sale (idempotent)", async () => {
    const { db, batched } = makeDb({ existing: ["u1"] });
    const out = await applySyncToDb(db, [
      { clientUuid: "u1", lines: [{ productVariantId: "v1", quantity: 1, unitPriceSatang: 100 }] },
    ]);
    expect(out).toEqual({ applied: 0, duplicates: 1, conflicts: [] });
    expect(batched.length).toBe(0);
  });

  it("surfaces an oversell conflict, still records the sale", async () => {
    const { db } = makeDb({ existing: [], available: [{ variantId: "v1", available: 1 }] });
    const out = await applySyncToDb(db, [
      { clientUuid: "u2", lines: [{ productVariantId: "v1", quantity: 5, unitPriceSatang: 5000 }] },
    ]);
    expect(out.applied).toBe(1);
    expect(out.conflicts).toEqual([{ productVariantId: "v1", requested: 5, available: 1 }]);
  });
});

describe("importProducts (CSV catalog import)", () => {
  it("imports valid rows and reports rows missing a required field", async () => {
    const { db, batched } = makeDb({});
    const out = await importProducts(
      db,
      "product_code,name,description\nC1,Cream,Nice\nC2,,Oops\n",
      {
        product_code: "product_code",
        name: "name",
        description: "description",
      },
    );
    expect(out).toEqual({
      received: 2,
      valid: 1,
      invalid: 1,
      errors: [{ rowIndex: 2, reason: "missing required field: name" }],
    });
    expect(batched.length).toBe(1); // one INSERT for the valid row
  });
});

describe("lineGrossProfitSatang", () => {
  it("computes revenue-ex-tax minus cost (107 incl VAT7, cost 60 -> 4000 satang)", () => {
    expect(
      lineGrossProfitSatang({
        productVariantId: "v1",
        quantity: 1,
        unitPriceSatang: 10700,
        taxSatang: 700,
        unitCostSatang: 6000,
      }),
    ).toBe(4000);
  });
});

describe("createProduct", () => {
  it("creates a product + default variant", async () => {
    const { db, batched } = makeDb({ existingProduct: null });
    const out = await createProduct(db, { productCode: "P1", name: "Cream" });
    expect(out.created).toBe(true);
    expect(out.variantId).not.toBeNull();
    expect(batched.length).toBe(2); // product + variant
  });

  it("also inserts a barcode row when a barcode is given", async () => {
    const { db, batched } = makeDb({ existingProduct: null });
    const out = await createProduct(db, { productCode: "P2", name: "Serum", barcode: "8850001" });
    expect(out.created).toBe(true);
    expect(batched.length).toBe(3); // product + variant + barcode
  });

  it("is idempotent: returns the existing product without inserting", async () => {
    const { db, batched } = makeDb({ existingProduct: { id: "existing-1" } });
    const out = await createProduct(db, { productCode: "P1", name: "Cream" });
    expect(out).toEqual({ productId: "existing-1", variantId: null, created: false });
    expect(batched.length).toBe(0);
  });

  it("rejects a missing required field", async () => {
    const { db } = makeDb({});
    await expect(createProduct(db, { productCode: "", name: "X" })).rejects.toThrow(/required/);
  });
});

describe("storeProductImage", () => {
  function fakeBucket() {
    const puts: { key: string }[] = [];
    const bucket = { put: async (key: string) => void puts.push({ key }) } as unknown as R2Bucket;
    return { bucket, puts };
  }

  it("stores a png in R2 and records the key on the product", async () => {
    const { db } = makeDb({});
    const { bucket, puts } = fakeBucket();
    const out = await storeProductImage(
      db,
      bucket,
      "p1",
      new Uint8Array([1, 2, 3]).buffer,
      "image/png",
    );
    expect(out.key).toMatch(/^products\/p1\/.*\.png$/);
    expect(out.url).toBe(`/img/${out.key}`);
    expect(puts.length).toBe(1);
  });

  it("rejects an unsupported content type", async () => {
    const { db } = makeDb({});
    const { bucket } = fakeBucket();
    await expect(
      storeProductImage(db, bucket, "p1", new Uint8Array([1]).buffer, "image/gif"),
    ).rejects.toThrow(/unsupported/);
  });

  it("rejects an oversized image", async () => {
    const { db } = makeDb({});
    const { bucket } = fakeBucket();
    await expect(
      storeProductImage(db, bucket, "p1", new ArrayBuffer(5 * 1024 * 1024 + 1), "image/png"),
    ).rejects.toThrow(/too large/);
  });
});

describe("importShopeeOrders (CSV order bridge)", () => {
  it("imports fresh orders, skips already-imported and in-batch duplicates", async () => {
    const { db, batched } = makeDb({ existingOrders: ["A"] });
    const out = await importShopeeOrders(
      db,
      "external_order_id,order_status\nA,paid\nB,paid\nB,paid\n",
      { external_order_id: "external_order_id", order_status: "order_status" },
    );
    expect(out).toEqual({ received: 3, imported: 1, duplicates: 2, invalid: 0, errors: [] });
    expect(batched.length).toBe(1);
  });
});
