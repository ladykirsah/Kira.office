import { describe, it, expect, vi } from "vitest";
import worker, {
  addBarcodeToProduct,
  applyAdjustmentToDb,
  applySyncToDb,
  archiveProduct,
  buildCorsHeaders,
  createProduct,
  deleteGalleryImage,
  ean13CheckDigit,
  entityFromPath,
  getProductDetail,
  setVariantPricing,
  setVariantBarcode,
  storeGalleryImage,
  listAttributes,
  addAttribute,
  resolveAttribute,
  addService,
  listServices,
  updateService,
  setProductFitments,
  listCarFitment,
  addCarModel,
  updateCarModel,
  updateProduct,
  importProducts,
  importShopeeOrders,
  parseMoneyToSatang,
  parseOrderDateMs,
  lineGrossProfitSatang,
  lookupBarcode,
  refundSaleToDb,
  requireAccess,
  runDailyBackup,
  backupR2Bucket,
  resolveActor,
  requireRole,
  salesToCsv,
  validateSyncLine,
  writeAuditLog,
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
  barcode?: unknown | null;
  productDetail?: unknown | null;
  variantRow?: unknown | null;
  productRef?: { productRef: string | null } | null;
  pricingRow?: unknown | null;
  images?: unknown[];
  brands?: unknown[];
  types?: unknown[];
  usages?: unknown[];
  carBrands?: unknown[];
  carModels?: unknown[];
  services?: unknown[];
  serviceByName?: { id: string } | null;
  fitments?: unknown[];
  attrOption?: unknown | null;
  stock?: unknown[];
  movements?: unknown[];
  stockOnHand?: number;
  saleHeader?: unknown | null;
  saleLines?: unknown[];
  barcodes?: unknown[];
  orders?: unknown[];
  financeSales?: unknown;
  financeProfit?: unknown;
  financeRefunds?: unknown;
  identifierMatch?: unknown;
  taxProfiles?: {
    variantId: string;
    vatRateBp: number;
    priceIncludesVat: number;
    isTaxable: number;
  }[];
  userRow?: { id: string; role: "owner" | "manager" | "stock_operator" | "finance_viewer" } | null;
}) {
  const batched: { sql: string }[] = [];
  const runs: { sql: string; binds: unknown[] }[] = [];
  const make = (sql: string) => {
    let lastBinds: unknown[] = [];
    const stmt = {
      sql,
      boundArgs: [] as unknown[],
      bind(...args: unknown[]) {
        lastBinds = args;
        stmt.boundArgs = args;
        return stmt;
      },
      async all<T = unknown>(): Promise<{ results: T[] }> {
        // listProducts joins product_fitments in a subquery; match its unique alias first so the
        // products-list query routes to canned.products, not the bare product_fitments branch below.
        if (sql.includes("AS offlinePriceSatang"))
          return { results: (canned.products ?? []) as T[] };
        if (sql.includes("FROM product_images")) return { results: (canned.images ?? []) as T[] };
        if (sql.includes("FROM product_fitments"))
          return { results: (canned.fitments ?? []) as T[] };
        if (sql.includes("FROM brands")) return { results: (canned.brands ?? []) as T[] };
        if (sql.includes("FROM product_types")) return { results: (canned.types ?? []) as T[] };
        if (sql.includes("FROM usage_categories")) return { results: (canned.usages ?? []) as T[] };
        if (sql.includes("FROM car_brands")) return { results: (canned.carBrands ?? []) as T[] };
        if (sql.includes("FROM car_models")) return { results: (canned.carModels ?? []) as T[] };
        if (sql.includes("FROM services")) return { results: (canned.services ?? []) as T[] };
        if (sql.includes("LEFT JOIN stock_ledger_entries"))
          return { results: (canned.stock ?? []) as T[] };
        if (sql.includes("movement_type AS movementType"))
          return { results: (canned.movements ?? []) as T[] };
        if (sql.includes("FROM product_variants v JOIN products"))
          return { results: (canned.barcodes ?? []) as T[] };
        if (sql.includes("FROM products")) return { results: (canned.products ?? []) as T[] };
        if (sql.includes("client_uuid IN"))
          return { results: (canned.existing ?? []).map((u) => ({ clientUuid: u })) as T[] };
        if (sql.includes("LEFT JOIN tax_profiles"))
          return { results: (canned.taxProfiles ?? []) as T[] };
        if (sql.includes("SUM(quantity_delta)"))
          return { results: (canned.available ?? []) as T[] };
        if (sql.includes("external_order_id AS externalOrderId"))
          return { results: (canned.orders ?? []) as T[] };
        if (sql.includes("FROM sales_orders"))
          return { results: (canned.existingOrders ?? []).map((id) => ({ id })) as T[] };
        // Order matters: the /sales query references onsite_sale_lines in a subquery, so match the
        // sales-list query first; the bare onsite_sale_lines select (refund) falls through to below.
        if (sql.includes("FROM onsite_sales")) return { results: (canned.sales ?? []) as T[] };
        if (sql.includes("FROM onsite_sale_lines"))
          return { results: (canned.saleLines ?? []) as T[] };
        return { results: [] as T[] };
      },
      async first<T = unknown>(): Promise<T | null> {
        if (sql.includes("SELECT product_ref AS productRef"))
          return (canned.productRef ?? null) as T | null;
        if (sql.includes("SELECT id FROM products WHERE product_ref"))
          return (canned.existingProduct ?? null) as T | null;
        if (sql.includes("product_ref =") || sql.includes("shopee_item_id ="))
          return (canned.identifierMatch ?? null) as T | null;
        if (sql.includes("SUM(quantity_delta)")) return { onHand: canned.stockOnHand ?? 0 } as T;
        if (sql.includes("FROM onsite_sale_lines l JOIN"))
          return (canned.financeProfit ?? null) as T | null;
        if (sql.includes("FROM financial_records WHERE record_type"))
          return (canned.financeRefunds ?? null) as T | null;
        if (sql.includes("FROM onsite_sales WHERE sale_status"))
          return (canned.financeSales ?? null) as T | null;
        if (sql.includes("FROM onsite_sales WHERE id"))
          return (canned.saleHeader ?? null) as T | null;
        if (sql.includes("FROM products p")) return (canned.productDetail ?? null) as T | null;
        if (sql.includes("FROM services WHERE name"))
          return (canned.serviceByName ?? null) as T | null;
        if (sql.includes("COLLATE NOCASE")) return (canned.attrOption ?? null) as T | null;
        if (sql.includes("FROM product_variants WHERE product_id"))
          return (canned.variantRow ?? null) as T | null;
        if (sql.includes("FROM pricing_profiles")) return (canned.pricingRow ?? null) as T | null;
        if (sql.includes("image_key AS imageKey FROM product_images"))
          return { imageKey: "products/p1/gallery.png" } as T;
        if (sql.includes("FROM barcodes")) return (canned.barcode ?? null) as T | null;
        if (sql.includes("FROM users WHERE email")) return (canned.userRow ?? null) as T | null;
        return null;
      },
      async run() {
        runs.push({ sql, binds: lastBinds });
        return { success: true };
      },
    };
    return stmt;
  };
  const db = {
    prepare: (sql: string) => make(sql),
    batch: async (stmts: { sql: string; boundArgs?: unknown[] }[]) => {
      // Mirror SQLite's arity check so a column/placeholder mismatch fails the test (the bare mock
      // would otherwise accept malformed INSERTs that throw against a real D1).
      for (const s of stmts) {
        const placeholders = (s.sql.match(/\?/g) ?? []).length;
        const bound = s.boundArgs?.length ?? 0;
        if (placeholders !== bound) {
          throw new Error(
            `SQL arity mismatch: ${placeholders} placeholders vs ${bound} bound values in: ${s.sql.trim().slice(0, 80)}`,
          );
        }
      }
      batched.push(...stmts);
      return stmts.map(() => ({}));
    },
  } as unknown as D1Database;
  return { db, env: { DB: db } as unknown as Env, batched, runs };
}

describe("services (bilingual name_en)", () => {
  it("listServices > selects name_en AS nameEn and returns the rows", async () => {
    const { db } = makeDb({
      services: [
        { id: "sv1", name: "ตรวจเช็คระบบแอร์", nameEn: "A/C system check", basePriceSatang: 30000 },
      ],
    });
    const prepare = vi.spyOn(db, "prepare");
    const rows = await listServices(db);
    // The SQL mock doesn't execute aliasing, so assert the SELECT itself maps name_en → nameEn.
    expect(prepare.mock.calls[0]?.[0]).toContain("name_en AS nameEn");
    expect(rows).toEqual([
      { id: "sv1", name: "ตรวจเช็คระบบแอร์", nameEn: "A/C system check", basePriceSatang: 30000 },
    ]);
  });

  it("addService > inserts the English name and returns it (both trimmed)", async () => {
    const { db, runs } = makeDb({}); // no existing service → insert path
    const result = await addService(db, "  Brake check  ", "  Brake inspection  ", 35000);
    expect(result).toMatchObject({
      name: "Brake check",
      nameEn: "Brake inspection",
      basePriceSatang: 35000,
    });
    const insert = runs.find((r) => r.sql.includes("INSERT INTO services"));
    expect(insert?.sql).toContain("name_en");
    expect(insert?.binds).toContain("Brake inspection");
  });

  it("addService > existing name updates name_en instead of inserting", async () => {
    const { db, runs } = makeDb({ serviceByName: { id: "sv-existing" } });
    const result = await addService(db, "Brake check", "Brake inspection", 35000);
    expect(result.id).toBe("sv-existing");
    expect(result.nameEn).toBe("Brake inspection");
    const update = runs.find((r) => r.sql.includes("UPDATE services SET name_en"));
    expect(update?.binds).toEqual(["Brake inspection", 35000, "sv-existing"]);
    expect(runs.some((r) => r.sql.includes("INSERT INTO services"))).toBe(false);
  });

  it("updateService > persists the English name (trimmed)", async () => {
    const { db, runs } = makeDb({});
    await updateService(db, "sv1", {
      name: "  Wash  ",
      nameEn: "  Coil cleaning  ",
      basePriceSatang: 120000,
    });
    const update = runs.find((r) => r.sql.includes("UPDATE services SET name ="));
    expect(update?.sql).toContain("name_en");
    expect(update?.binds).toEqual(["Wash", "Coil cleaning", 120000, "sv1"]);
  });

  it("POST /services > round-trips nameEn from the request body", async () => {
    const { env } = makeDb({});
    const res = await worker.fetch!(
      new Request("https://x/services", {
        method: "POST",
        body: JSON.stringify({
          name: "Brake check",
          nameEn: "Brake inspection",
          basePriceSatang: 35000,
        }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      name: "Brake check",
      nameEn: "Brake inspection",
      basePriceSatang: 35000,
    });
  });

  it("POST /services > rejects a missing name with 400", async () => {
    const { env } = makeDb({});
    const res = await worker.fetch!(
      new Request("https://x/services", {
        method: "POST",
        body: JSON.stringify({ nameEn: "orphan", basePriceSatang: 100 }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it("PATCH /services/:id > persists the updated English name", async () => {
    const { env, runs } = makeDb({});
    const res = await worker.fetch!(
      new Request("https://x/services/sv1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Wash", nameEn: "Coil cleaning", basePriceSatang: 120000 }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const update = runs.find((r) => r.sql.includes("UPDATE services SET name ="));
    expect(update?.binds).toEqual(["Wash", "Coil cleaning", 120000, "sv1"]);
  });

  it("POST /services > rejects a zero or absent price with 400", async () => {
    const { env } = makeDb({});
    for (const body of [{ name: "Free check", basePriceSatang: 0 }, { name: "No price" }]) {
      const res = await worker.fetch!(
        new Request("https://x/services", { method: "POST", body: JSON.stringify(body) }),
        env,
        ctx,
      );
      expect(res.status).toBe(400);
    }
  });

  it("PATCH /services/:id > rejects a zero price with 400", async () => {
    const { env } = makeDb({});
    const res = await worker.fetch!(
      new Request("https://x/services/sv1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Wash", basePriceSatang: 0 }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(400);
  });
});

describe("writeAuditLog", () => {
  it("inserts an append-only row for a mutation", async () => {
    const { db, runs } = makeDb({});
    await writeAuditLog(db, {
      actorEmail: "owner@example.com",
      method: "POST",
      path: "/sync",
    });
    const row = runs.find((r) => r.sql.includes("INSERT INTO audit_logs"));
    expect(row).toBeDefined();
    expect(row?.binds[1]).toBe("owner@example.com");
    expect(row?.binds[2]).toBe("POST /sync");
  });
});

describe("parseMoneyToSatang", () => {
  it("parses plain and grouped amounts to satang", () => {
    expect(parseMoneyToSatang("890")).toBe(89000);
    expect(parseMoneyToSatang("1,234.50")).toBe(123450);
    expect(parseMoneyToSatang("฿ 89.00")).toBe(8900);
  });
  it("returns 0 for blank or unparseable input", () => {
    expect(parseMoneyToSatang(undefined)).toBe(0);
    expect(parseMoneyToSatang("")).toBe(0);
    expect(parseMoneyToSatang("n/a")).toBe(0);
  });
});

describe("parseOrderDateMs", () => {
  it("parses an ISO date to epoch ms", () => {
    expect(parseOrderDateMs("2026-06-14")).toBe(Date.parse("2026-06-14"));
  });
  it("returns null for blank or unparseable input", () => {
    expect(parseOrderDateMs(undefined)).toBeNull();
    expect(parseOrderDateMs("")).toBeNull();
    expect(parseOrderDateMs("not a date")).toBeNull();
  });
});

describe("importShopeeOrders (enriched)", () => {
  it("captures total, fee, and order date from mapped columns", async () => {
    const { db, batched } = makeDb({ existingOrders: [] });
    const csv = "oid,total,fee,date\n2406ABC,890.00,62.00,2026-06-14\n";
    const out = await importShopeeOrders(db, csv, {
      external_order_id: "oid",
      order_total: "total",
      order_fee: "fee",
      order_date: "date",
    });
    expect(out.imported).toBe(1);
    const insert = (batched as { sql: string; boundArgs?: unknown[] }[]).find((s) =>
      s.sql.includes("INSERT OR IGNORE INTO sales_orders"),
    );
    // binds: (id, channel, external_order_id, order_status, payment_status, grand_total, fee_total, order_created_at, …)
    expect(insert?.boundArgs?.[5]).toBe(89000);
    expect(insert?.boundArgs?.[6]).toBe(6200);
    expect(insert?.boundArgs?.[7]).toBe(Date.parse("2026-06-14"));
  });

  it("still imports a minimal export (ids only) when the money columns are absent", async () => {
    const { db, batched } = makeDb({ existingOrders: [] });
    const csv = "external_order_id\n2406XYZ\n";
    const out = await importShopeeOrders(db, csv, {
      external_order_id: "external_order_id",
      order_total: "total", // column absent → dropped, no throw
    });
    expect(out.imported).toBe(1);
    const insert = (batched as { sql: string; boundArgs?: unknown[] }[]).find((s) =>
      s.sql.includes("INSERT OR IGNORE INTO sales_orders"),
    );
    expect(insert?.boundArgs?.[5]).toBe(0);
    expect(insert?.boundArgs?.[7]).toBeNull();
  });
});

describe("entityFromPath", () => {
  it("extracts product ids from /products/:id paths", () => {
    expect(entityFromPath("/products/p1/pricing")).toEqual({
      entityType: "product",
      entityId: "p1",
    });
  });
});

describe("buildCorsHeaders", () => {
  it("allows credentials for an allowlisted admin origin", () => {
    const req = new Request("https://api.example.com/products", {
      headers: { Origin: "http://localhost:3000" },
    });
    const h = buildCorsHeaders(req);
    expect(h["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(h["access-control-allow-credentials"]).toBe("true");
  });

  it("uses wildcard without credentials for unknown origins", () => {
    const req = new Request("https://api.example.com/products", {
      headers: { Origin: "https://evil.example" },
    });
    const h = buildCorsHeaders(req);
    expect(h["access-control-allow-origin"]).toBe("*");
    expect(h["access-control-allow-credentials"]).toBeUndefined();
  });
});

describe("api worker routes", () => {
  it("GET /health > 200 ok", async () => {
    const res = await worker.fetch!(new Request("https://x/health"), {} as Env, ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toEqual({ ok: true, service: "kiraoffice-api" });
  });

  it("OPTIONS > 204 CORS preflight (no auth)", async () => {
    const res = await worker.fetch!(
      new Request("https://x/products", { method: "OPTIONS" }),
      {} as Env,
      ctx,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
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

  it("GET /products > reads from D1 (incl. part-detail names)", async () => {
    const row = {
      id: "p1",
      variantId: "v1",
      productRef: "C1",
      name: "Cream",
      status: "active",
      brandName: "DENSO",
      typeName: "Blower motor",
      usageName: "A/C",
      itemCostSatang: 5000,
      onlineCommissionBp: 1000,
      taxOnCost: 0,
      carBrandsCsv: "Toyota,Honda",
    };
    const { env } = makeDb({ products: [row] });
    const res = await worker.fetch!(new Request("https://x/products"), env, ctx);
    expect(await res.json()).toEqual({ products: [row] });
  });

  it("GET /products/identifier-check > finds a product (any status) using the id", async () => {
    const match = { id: "p9", name: "Old part", productRef: "OLD-1", status: "archived" };
    const { env } = makeDb({ identifierMatch: match });
    const res = await worker.fetch!(
      new Request("https://x/products/identifier-check?kind=ref&value=DI-1"),
      env,
      ctx,
    );
    expect(await res.json()).toEqual({ match });
  });

  it("GET /products/identifier-check > returns null when nothing matches", async () => {
    const { env } = makeDb({});
    const res = await worker.fetch!(
      new Request("https://x/products/identifier-check?kind=shopee&value=ZZ"),
      env,
      ctx,
    );
    expect(await res.json()).toEqual({ match: null });
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

  it("GET /stock > reads on-hand per variant from D1", async () => {
    const stock = [
      { variantId: "v1", sku: "S1", productName: "Cream", productRef: "C1", onHand: 20 },
    ];
    const { env } = makeDb({ stock });
    const res = await worker.fetch!(new Request("https://x/stock"), env, ctx);
    expect(await res.json()).toEqual({ stock });
  });

  it("GET /stock/movements > returns recent ledger movements from D1", async () => {
    const movements = [
      {
        id: "m1",
        variantId: "v1",
        sku: "S1",
        productName: "Cream",
        movementType: "onsite_sale",
        quantityDelta: -2,
        quantityAfter: 18,
        createdAt: 1720000000000,
      },
    ];
    const { env } = makeDb({ movements });
    const res = await worker.fetch!(new Request("https://x/stock/movements"), env, ctx);
    expect(await res.json()).toEqual({ movements });
  });

  it("GET /finance/summary > aggregates sales, profit and refunds", async () => {
    const { env } = makeDb({
      financeSales: { salesCount: 2, revenueSatang: 21400, vatSatang: 1400 },
      financeProfit: { grossProfitSatang: 8000 },
      financeRefunds: { refundCount: 1, refundedSatang: 10700 },
    });
    const res = await worker.fetch!(new Request("https://x/finance/summary"), env, ctx);
    expect(await res.json()).toEqual({
      salesCount: 2,
      revenueSatang: 21400,
      vatSatang: 1400,
      grossProfitSatang: 8000,
      refundCount: 1,
      refundedSatang: 10700,
    });
  });

  it("GET /orders > lists imported orders", async () => {
    const orders = [
      {
        id: "o1",
        channel: "shopee",
        externalOrderId: "A1",
        orderStatus: "paid",
        paymentStatus: null,
        importedAt: 1,
      },
    ];
    const { env } = makeDb({ orders });
    const res = await worker.fetch!(new Request("https://x/orders"), env, ctx);
    expect(await res.json()).toEqual({ orders });
  });

  it("GET /barcodes > lists variants with barcodes", async () => {
    const barcodes = [
      { variantId: "v1", productId: "p1", productRef: "C1", productName: "Cream", barcode: "885" },
    ];
    const { env } = makeDb({ barcodes });
    const res = await worker.fetch!(new Request("https://x/barcodes"), env, ctx);
    expect(await res.json()).toEqual({ barcodes });
  });

  it("POST /stock/adjust > routes through the StockLedger Durable Object", async () => {
    const env = {
      STOCK_LEDGER: {
        idFromName: (_n: string) => ({}),
        get: (_id: unknown) => ({
          applyAdjustment: async (a: { productVariantId: string }) => ({
            variantId: a.productVariantId,
            quantityAfter: 25,
            applied: true,
          }),
        }),
      },
    } as unknown as Env;
    const res = await worker.fetch!(
      new Request("https://x/stock/adjust", {
        method: "POST",
        body: JSON.stringify({ productVariantId: "v1", quantityDelta: 5 }),
      }),
      env,
      ctx,
    );
    expect(await res.json()).toEqual({ variantId: "v1", quantityAfter: 25, applied: true });
  });

  it("GET /terms/template > returns the stored template from KV", async () => {
    const env = { KV: { get: async () => "hello {{name}}" } } as unknown as Env;
    const res = await worker.fetch!(new Request("https://x/terms/template"), env, ctx);
    expect(await res.json()).toEqual({ template: "hello {{name}}" });
  });

  it("PUT /terms/template > saves the template to KV", async () => {
    let saved = "";
    const env = {
      KV: {
        put: async (_k: string, v: string) => {
          saved = v;
        },
      },
    } as unknown as Env;
    const res = await worker.fetch!(
      new Request("https://x/terms/template", {
        method: "PUT",
        body: JSON.stringify({ template: "T {{x}}" }),
      }),
      env,
      ctx,
    );
    expect(await res.json()).toEqual({ ok: true });
    expect(saved).toBe("T {{x}}");
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
    const res = await worker.fetch!(new Request("https://x/img/products/p1/missing.png"), env, ctx);
    expect(res.status).toBe(404);
  });

  it("GET /img/:key > refuses non-image keys — never serves the backups/ dump from the same bucket", async () => {
    let readKey: string | null = null;
    const env = {
      IMAGES: {
        get: async (k: string) => {
          readKey = k;
          return { body: "SECRET DB DUMP", httpMetadata: { contentType: "application/json" } };
        },
      },
    } as unknown as Env;
    const res = await worker.fetch!(new Request("https://x/img/backups/2026-06-27.json"), env, ctx);
    expect(res.status).toBe(404); // refused by the namespace allowlist…
    expect(readKey).toBeNull(); // …without ever reading the object
  });

  it("GET /products/by-barcode/:code > 404 for an unknown barcode", async () => {
    const { env } = makeDb({ barcode: null });
    const res = await worker.fetch!(new Request("https://x/products/by-barcode/nope"), env, ctx);
    expect(res.status).toBe(404);
  });

  it("GET /products/by-barcode/:code > returns the variant for a known barcode", async () => {
    const hit = {
      barcode: "885",
      variantId: "v1",
      productId: "p1",
      productRef: "C1",
      name: "Cream",
    };
    const { env } = makeDb({ barcode: hit });
    const res = await worker.fetch!(new Request("https://x/products/by-barcode/885"), env, ctx);
    expect(await res.json()).toEqual(hit);
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
            validationErrors: [],
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
    expect(await res.json()).toEqual({
      applied: 1,
      duplicates: 0,
      conflicts: [],
      validationErrors: [],
    });
  });
});

describe("runDailyBackup", () => {
  it("exports tables to R2 under a dated key", async () => {
    const { env } = makeDb({});
    const puts: { key: string; body: string }[] = [];
    (env as unknown as { IMAGES: unknown }).IMAGES = {
      put: async (k: string, v: string) => {
        puts.push({ key: k, body: v });
      },
    };
    const key = await runDailyBackup(env, 0);
    expect(key).toBe("backups/1970-01-01.json");
    expect(puts.length).toBe(1);
    expect(JSON.parse(puts[0]!.body)).toHaveProperty("tables");
  });

  it("uses BACKUPS bucket when bound", async () => {
    const { env } = makeDb({});
    const puts: { key: string; body: string }[] = [];
    (env as unknown as { BACKUPS: unknown }).BACKUPS = {
      put: async (k: string, v: string) => {
        puts.push({ key: k, body: v });
      },
    };
    (env as unknown as { IMAGES: unknown }).IMAGES = {
      put: async () => {
        throw new Error("IMAGES should not be used when BACKUPS is set");
      },
    };
    expect(backupR2Bucket(env)).toBe((env as unknown as { BACKUPS: unknown }).BACKUPS);
    await runDailyBackup(env, 0);
    expect(puts.length).toBe(1);
  });
});

describe("resolveActor + requireRole (RBAC prep)", () => {
  it("resolveActor > Access off > rbac not enforced", async () => {
    const { env } = makeDb({});
    const actor = await resolveActor(env.DB, null, false);
    expect(actor.rbacEnforced).toBe(false);
    expect(requireRole(actor, "product.delete")).toBeNull();
  });

  it("resolveActor > Access on + known user > returns role", async () => {
    const { env } = makeDb({ userRow: { id: "u1", role: "manager" } });
    const actor = await resolveActor(env.DB, "boss@shop.test", true);
    expect(actor).toMatchObject({ userId: "u1", role: "manager", rbacEnforced: true });
    expect(requireRole(actor, "product.delete")).toEqual({
      error: "forbidden",
      reason: "insufficient_role",
    });
  });

  it("resolveActor > Access on + unknown email > forbidden", async () => {
    const { env } = makeDb({ userRow: null });
    const actor = await resolveActor(env.DB, "stranger@test", true);
    expect(requireRole(actor, "product.write")).toEqual({
      error: "forbidden",
      reason: "unknown_user",
    });
  });
});

describe("requireAccess (Cloudflare Access gate)", () => {
  it("is open (no enforcement) when ACCESS env is not configured", async () => {
    const gate = await requireAccess(new Request("https://x/products"), {} as Env);
    expect(gate).toEqual({ email: null });
  });

  it("returns 401 when configured but no Access token is present", async () => {
    const env = {
      ACCESS_TEAM_DOMAIN: "t.cloudflareaccess.com",
      ACCESS_AUD: "aud",
    } as unknown as Env;
    const gate = await requireAccess(new Request("https://x/products"), env);
    expect(gate instanceof Response).toBe(true);
    expect((gate as Response).status).toBe(401);
  });

  it("keeps /health public and rejects protected routes when configured without a token", async () => {
    const env = { ACCESS_TEAM_DOMAIN: "t", ACCESS_AUD: "a" } as unknown as Env;
    expect((await worker.fetch!(new Request("https://x/health"), env, ctx)).status).toBe(200);
    expect((await worker.fetch!(new Request("https://x/products"), env, ctx)).status).toBe(401);
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
    expect(out).toEqual({ applied: 1, duplicates: 0, conflicts: [], validationErrors: [] });
    expect(batched.length).toBe(3); // onsite_sales + line + ledger
  });

  it("persists the device-minted sale_number on the onsite_sales insert", async () => {
    const { db, batched } = makeDb({
      existing: [],
      available: [{ variantId: "v1", available: 10 }],
    });
    await applySyncToDb(db, [
      {
        clientUuid: "u-sn",
        saleNumber: "DAS202607-01001",
        lines: [{ productVariantId: "v1", quantity: 1, unitPriceSatang: 10000 }],
      },
    ]);
    const insert = (batched as { sql: string; boundArgs?: unknown[] }[]).find((s) =>
      s.sql.includes("INSERT OR IGNORE INTO onsite_sales"),
    );
    expect(insert?.boundArgs?.[2]).toBe("DAS202607-01001"); // (id, client_uuid, sale_number, …)
  });

  it("binds null sale_number when the device did not mint one", async () => {
    const { db, batched } = makeDb({
      existing: [],
      available: [{ variantId: "v1", available: 10 }],
    });
    await applySyncToDb(db, [
      {
        clientUuid: "u-nosn",
        lines: [{ productVariantId: "v1", quantity: 1, unitPriceSatang: 10000 }],
      },
    ]);
    const insert = (batched as { sql: string; boundArgs?: unknown[] }[]).find((s) =>
      s.sql.includes("INSERT OR IGNORE INTO onsite_sales"),
    );
    expect(insert?.boundArgs?.[2]).toBeNull();
  });

  it("records a repair service line with no variant and no stock movement", async () => {
    const { db, batched } = makeDb({ existing: [], available: [] });
    const out = await applySyncToDb(db, [
      {
        clientUuid: "svc1",
        saleType: "repair",
        licensePlate: "1กก 1234",
        notes: "นัดรับพรุ่งนี้",
        lines: [
          {
            lineType: "service",
            description: "ตรวจเช็คระบบแอร์",
            quantity: 1,
            unitPriceSatang: 30000,
          },
        ],
      },
    ]);
    expect(out.applied).toBe(1);
    expect(out.conflicts).toEqual([]); // a service is not stock — never an oversell
    expect(batched.length).toBe(2); // onsite_sales + the service line, NO ledger entry
  });

  it("records a mixed repair sale (part with stock + service) totalling both", async () => {
    const { db, batched } = makeDb({
      existing: [],
      available: [{ variantId: "v1", available: 5 }],
    });
    const out = await applySyncToDb(db, [
      {
        clientUuid: "mix1",
        saleType: "repair",
        lines: [
          {
            productVariantId: "v1",
            quantity: 1,
            unitPriceSatang: 259000,
            description: "Compressor",
          },
          { lineType: "service", description: "ค่าแรง", quantity: 1, unitPriceSatang: 50000 },
        ],
      },
    ]);
    expect(out.applied).toBe(1);
    expect(out.conflicts).toEqual([]);
    expect(batched.length).toBe(4); // header + part line + ledger + service line
  });

  it("skips an already-applied sale (idempotent)", async () => {
    const { db, batched } = makeDb({ existing: ["u1"] });
    const out = await applySyncToDb(db, [
      { clientUuid: "u1", lines: [{ productVariantId: "v1", quantity: 1, unitPriceSatang: 100 }] },
    ]);
    expect(out).toEqual({ applied: 0, duplicates: 1, conflicts: [], validationErrors: [] });
    expect(batched.length).toBe(0);
  });

  it("all-oversold sale: surfaces the conflict and writes NO phantom header", async () => {
    const { db, batched } = makeDb({
      existing: [],
      available: [{ variantId: "v1", available: 1 }],
    });
    const out = await applySyncToDb(db, [
      { clientUuid: "u2", lines: [{ productVariantId: "v1", quantity: 5, unitPriceSatang: 5000 }] },
    ]);
    expect(out.applied).toBe(0); // every line dropped → no sale recorded
    expect(out.conflicts).toEqual([{ productVariantId: "v1", requested: 5, available: 1 }]);
    expect(batched.some((s) => /INSERT OR IGNORE INTO onsite_sales/.test(s.sql))).toBe(false);
  });

  it("partial oversell: fail-closed — rejects the entire sale when any line oversells", async () => {
    const { db, batched } = makeDb({
      existing: [],
      available: [
        { variantId: "v1", available: 10 },
        { variantId: "v2", available: 1 },
      ],
    });
    const out = await applySyncToDb(db, [
      {
        clientUuid: "u3",
        lines: [
          { productVariantId: "v1", quantity: 2, unitPriceSatang: 5000 },
          { productVariantId: "v2", quantity: 5, unitPriceSatang: 3000 },
        ],
      },
    ]);
    expect(out.applied).toBe(0);
    expect(out.conflicts).toEqual([{ productVariantId: "v2", requested: 5, available: 1 }]);
    expect(batched.some((s) => /INSERT OR IGNORE INTO onsite_sales/.test(s.sql))).toBe(false);
  });

  it("rejects a service line that carries a product variant (stock bypass)", async () => {
    const { db, batched } = makeDb({
      existing: [],
      available: [{ variantId: "v1", available: 10 }],
    });
    const out = await applySyncToDb(db, [
      {
        clientUuid: "bad1",
        lines: [
          {
            lineType: "service",
            productVariantId: "v1",
            quantity: 1,
            unitPriceSatang: 1000,
          },
        ],
      },
    ]);
    expect(out.applied).toBe(0);
    expect(out.validationErrors).toEqual([
      { clientUuid: "bad1", reason: "service lines must not have a product variant" },
    ]);
    expect(batched.length).toBe(0);
  });

  it("rejects negative quantity", async () => {
    const { db, batched } = makeDb({
      existing: [],
      available: [{ variantId: "v1", available: 10 }],
    });
    const out = await applySyncToDb(db, [
      {
        clientUuid: "bad2",
        lines: [{ productVariantId: "v1", quantity: -1, unitPriceSatang: 1000 }],
      },
    ]);
    expect(out.applied).toBe(0);
    expect(out.validationErrors[0]?.reason).toMatch(/positive integer/);
    expect(batched.length).toBe(0);
  });

  it("fills in taxSatang when omitted for a VAT-inclusive part line", async () => {
    const { db, batched } = makeDb({
      existing: [],
      available: [{ variantId: "v1", available: 10 }],
    });
    const out = await applySyncToDb(db, [
      {
        clientUuid: "tax1",
        lines: [
          {
            productVariantId: "v1",
            quantity: 1,
            unitPriceSatang: 10700,
            unitCostSatang: 6000,
          },
        ],
      },
    ]);
    expect(out.applied).toBe(1);
    const line = batched.find((s) => /INSERT INTO onsite_sale_lines/.test(s.sql)) as
      | { sql: string; boundArgs: unknown[] }
      | undefined;
    // bind order: …, tax_satang(8), gross_profit(10)
    expect(line?.boundArgs[8]).toBe(700);
    expect(line?.boundArgs[10]).toBe(4000);
  });
});

describe("refundSaleToDb", () => {
  it("restocks lines, marks refunded, writes a reversing finance record", async () => {
    const { db, batched } = makeDb({
      saleHeader: { id: "s1", grandTotalSatang: 10700, saleStatus: "completed" },
      saleLines: [{ productVariantId: "v1", quantity: 2 }],
      stockOnHand: 18,
    });
    const out = await refundSaleToDb(db, "s1");
    expect(out).toEqual({ saleId: "s1", applied: true, restockedLines: 1 });
    expect(batched.length).toBe(3); // 1 restock ledger + update sale + finance record
  });

  it("writes the restock as a refund_return movement (schema enum, not 'refund')", async () => {
    const { db, batched } = makeDb({
      saleHeader: { id: "s1", grandTotalSatang: 10700, saleStatus: "completed" },
      saleLines: [{ productVariantId: "v1", quantity: 2 }],
      stockOnHand: 18,
    });
    await refundSaleToDb(db, "s1");
    const ledger = (batched as { sql: string; boundArgs?: unknown[] }[]).find((s) =>
      s.sql.includes("INSERT INTO stock_ledger_entries"),
    );
    // boundArgs order: (id, variant_id, movement_type, delta, after, source_type, source_id, at)
    expect(ledger?.boundArgs?.[2]).toBe("refund_return");
  });

  it("rejects an unknown sale", async () => {
    const { db } = makeDb({ saleHeader: null });
    expect((await refundSaleToDb(db, "nope")).applied).toBe(false);
  });

  it("rejects a double refund", async () => {
    const { db } = makeDb({
      saleHeader: { id: "s1", grandTotalSatang: 100, saleStatus: "refunded" },
    });
    const out = await refundSaleToDb(db, "s1");
    expect(out.applied).toBe(false);
    expect(out.reason).toMatch(/already/);
  });
});

describe("applyAdjustmentToDb (manual stock movements)", () => {
  it("receives stock (adds to on-hand)", async () => {
    const { db } = makeDb({ stockOnHand: 0 });
    expect(
      await applyAdjustmentToDb(db, {
        productVariantId: "v1",
        quantityDelta: 5,
        movementType: "receive",
      }),
    ).toEqual({ variantId: "v1", quantityAfter: 5, applied: true });
  });

  it("rejects an adjustment that would drive stock negative", async () => {
    const { db } = makeDb({ stockOnHand: 3 });
    const out = await applyAdjustmentToDb(db, {
      productVariantId: "v1",
      quantityDelta: -5,
      movementType: "write_off",
    });
    expect(out.applied).toBe(false);
    expect(out.quantityAfter).toBe(3);
  });

  it("rejects a zero delta", async () => {
    const { db } = makeDb({});
    const out = await applyAdjustmentToDb(db, {
      productVariantId: "v1",
      quantityDelta: 0,
      movementType: "correction",
    });
    expect(out.applied).toBe(false);
  });
});

describe("importProducts (CSV catalog import)", () => {
  it("imports valid rows and reports rows missing a required field", async () => {
    const { db, batched } = makeDb({});
    const out = await importProducts(
      db,
      "product_ref,name,description\nC1,Cream,Nice\nC2,,Oops\n",
      {
        product_ref: "product_ref",
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

describe("validateSyncLine", () => {
  it("rejects service lines with a variant", () => {
    expect(
      validateSyncLine({
        lineType: "service",
        productVariantId: "v1",
        quantity: 1,
        unitPriceSatang: 100,
      }),
    ).toMatch(/service lines must not have a product variant/);
  });

  it("rejects non-positive quantity", () => {
    expect(validateSyncLine({ productVariantId: "v1", quantity: 0, unitPriceSatang: 100 })).toMatch(
      /positive integer/,
    );
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
    const out = await createProduct(db, { productRef: "P1", name: "Cream" });
    expect(out.created).toBe(true);
    expect(out.variantId).not.toBeNull();
    expect(batched.length).toBe(2); // product + variant
  });

  it("also inserts a barcode row when a barcode is given", async () => {
    const { db, batched } = makeDb({ existingProduct: null });
    const out = await createProduct(db, { productRef: "P2", name: "Serum", barcode: "8850001" });
    expect(out.created).toBe(true);
    expect(batched.length).toBe(3); // product + variant + barcode
  });

  it("is idempotent: returns the existing product without inserting", async () => {
    const { db, batched } = makeDb({ existingProduct: { id: "existing-1" } });
    const out = await createProduct(db, { productRef: "P1", name: "Cream" });
    expect(out).toEqual({ productId: "existing-1", variantId: null, created: false });
    expect(batched.length).toBe(0);
  });

  it("rejects a missing required field", async () => {
    const { db } = makeDb({});
    await expect(createProduct(db, { productRef: "", name: "X" })).rejects.toThrow(/required/);
  });
});

describe("salesToCsv", () => {
  it("builds a CSV with header + THB-formatted rows", () => {
    const csv = salesToCsv([
      {
        paymentMethod: "cash",
        grandTotalSatang: 10700,
        taxTotalSatang: 700,
        grossProfitSatang: 4000,
        saleStatus: "completed",
        createdAt: 0,
        // Present on the row but intentionally NOT in the accounting CSV (asserted below).
        saleType: "repair",
        licensePlate: "1กก 1234",
        vehicle: "Toyota Vios 2014",
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("date,payment_method,total_thb,vat_thb,gross_profit_thb,status");
    expect(lines[1]).toBe("1970-01-01T00:00:00.000Z,cash,107.00,7.00,40.00,completed");
  });

  it("quotes cells that contain a comma", () => {
    const csv = salesToCsv([
      {
        paymentMethod: "cash,transfer",
        grandTotalSatang: 0,
        taxTotalSatang: 0,
        grossProfitSatang: 0,
        saleStatus: "completed",
        createdAt: 0,
        saleType: null,
        licensePlate: null,
        vehicle: null,
      },
    ]);
    expect(csv.split("\n")[1]).toContain('"cash,transfer"');
  });
});

describe("getProductDetail / updateProduct / setVariantPricing", () => {
  it("returns product + default variant + pricing", async () => {
    const product = {
      id: "p1",
      productRef: "C1",
      name: "Cream",
      description: "d",
      status: "active",
      imageKey: null,
    };
    const { db } = makeDb({
      productDetail: product,
      variantRow: { id: "v1", barcode: "885000111" },
      pricingRow: { itemCostSatang: 6000, targetPriceSatang: 10700 },
      images: [{ id: "img1", imageKey: "k1", sortOrder: 0, isCover: 1 }],
    });
    expect(await getProductDetail(db, "p1")).toEqual({
      product,
      variantId: "v1",
      barcode: "885000111",
      onHand: 0,
      fitments: [],
      pricing: { itemCostSatang: 6000, targetPriceSatang: 10700 },
      images: [{ id: "img1", imageKey: "k1", sortOrder: 0, isCover: 1 }],
    });
  });

  it("returns null when the product is missing", async () => {
    const { db } = makeDb({ productDetail: null });
    expect(await getProductDetail(db, "nope")).toBeNull();
  });

  it("updateProduct resolves", async () => {
    const { db } = makeDb({});
    await expect(
      updateProduct(db, "p1", { name: "New", status: "active" }),
    ).resolves.toBeUndefined();
  });

  it("updateProduct stamps updated_at", async () => {
    const { db, runs } = makeDb({});
    await updateProduct(db, "p1", { name: "New", status: "active" });
    const upd = runs.find((r) => r.sql.startsWith("UPDATE products SET name"));
    expect(upd?.sql).toContain("updated_at = ?");
    // updated_at is the second-to-last bind (before the id)
    expect(typeof upd?.binds.at(-2)).toBe("number");
  });

  it("setVariantPricing replaces the profile (delete + insert)", async () => {
    const { db, batched } = makeDb({});
    await setVariantPricing(db, "v1", {
      itemCostSatang: 6000,
      targetPriceSatang: 10700,
      onlinePriceSatang: 12000,
      b2bPriceSatang: 9600,
      onlineCommissionBp: 1000,
      taxOnCost: true,
    });
    expect(batched.length).toBe(2);
  });

  it("setVariantBarcode updates the variant + upserts a scannable barcode", async () => {
    const { db, batched } = makeDb({});
    await setVariantBarcode(db, "v1", " 885000111 ");
    expect(batched.length).toBe(2);
  });

  it("setVariantBarcode is a no-op for an empty value", async () => {
    const { db, batched } = makeDb({});
    await setVariantBarcode(db, "v1", "   ");
    expect(batched.length).toBe(0);
  });

  it("archiveProduct resolves (soft-delete)", async () => {
    const { db } = makeDb({});
    await expect(archiveProduct(db, "p1")).resolves.toBeUndefined();
  });

  it("DELETE /products/:id archives the product", async () => {
    const { env } = makeDb({});
    const res = await worker.fetch!(
      new Request("https://x/products/p1", { method: "DELETE" }),
      env,
      ctx,
    );
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("part attributes (brand / car system / part name)", () => {
  it("listAttributes returns the three lists", async () => {
    const { db } = makeDb({
      brands: [{ id: "b1", name: "DENSO" }],
      types: [{ id: "t1", name: "Evaporator" }],
      usages: [{ id: "u1", name: "A/C" }],
    });
    expect(await listAttributes(db)).toEqual({
      brands: [{ id: "b1", name: "DENSO" }],
      types: [{ id: "t1", name: "Evaporator" }],
      usages: [{ id: "u1", name: "A/C" }],
      carBrands: [],
      carModels: [],
    });
  });

  it("setProductFitments replaces rows (delete + one insert per non-empty row)", async () => {
    const { db, batched } = makeDb({ attrOption: { id: "cb1", name: "Toyota" } });
    await setProductFitments(db, "p1", [
      { carBrand: "Toyota", carModel: "Vios", yearFrom: 2007, yearTo: 2012 },
      { carBrand: "", carModel: "", yearFrom: null, yearTo: null }, // blank → skipped
    ]);
    expect(batched.length).toBe(2); // 1 delete + 1 insert
  });

  it("listCarFitment nests models (with their service notes + parsed o-ring usage) under their brand", async () => {
    const oringJson = JSON.stringify([
      { size: '3/8"', qty: 3 },
      { size: '1/2"', qty: 2 },
    ]);
    const { db } = makeDb({
      carBrands: [{ id: "cb1", name: "Toyota" }],
      carModels: [
        {
          id: "cm1",
          name: "Vios",
          carBrandId: "cb1",
          generationCode: "NCP150",
          yearFrom: 2013,
          yearTo: 2019,
          refrigerant: "R134a",
          oringUsage: oringJson,
          coolantLiters: "0.45",
          notes: "belt 4PK",
        },
        { id: "cm2", name: "City", carBrandId: "cb2" }, // orphan brand → dropped
      ],
    });
    expect(await listCarFitment(db)).toEqual({
      brands: [
        {
          id: "cb1",
          name: "Toyota",
          models: [
            {
              id: "cm1",
              name: "Vios",
              generationCode: "NCP150",
              yearFrom: 2013,
              yearTo: 2019,
              refrigerant: "R134a",
              oringUsage: [
                { size: '3/8"', qty: 3 },
                { size: '1/2"', qty: 2 },
              ],
              coolantLiters: "0.45",
              notes: "belt 4PK",
            },
          ],
        },
      ],
    });
  });

  it("listCarFitment defaults o-ring usage to [] when the column is null/garbage", async () => {
    const { db } = makeDb({
      carBrands: [{ id: "cb1", name: "Toyota" }],
      carModels: [{ id: "cm1", name: "Vios", carBrandId: "cb1", oringUsage: null }],
    });
    const out = await listCarFitment(db);
    expect(out.brands[0]!.models[0]!.oringUsage).toEqual([]);
  });

  it("updateCarModel writes the service-note fields (o-ring usage as JSON) in order", async () => {
    const { db, runs } = makeDb({});
    const oring = [
      { size: '3/8"', qty: 3 },
      { size: '1/2"', qty: 2 },
    ];
    await updateCarModel(db, "cm1", {
      generationCode: "NCP150",
      yearFrom: 2013,
      yearTo: 2019,
      refrigerant: "R134a",
      oringUsage: oring,
      coolantLiters: "0.45",
      notes: "belt 4PK",
    });
    const upd = runs.find((r) => r.sql.includes("UPDATE car_models SET"));
    expect(upd).toBeTruthy();
    expect(upd!.binds).toEqual([
      "NCP150",
      2013,
      2019,
      "R134a",
      JSON.stringify(oring),
      "0.45",
      "belt 4PK",
      "cm1",
    ]);
  });

  it("updateCarModel drops blank/invalid o-ring rows and stores null when none remain", async () => {
    const { db, runs } = makeDb({});
    await updateCarModel(db, "cm1", {
      generationCode: null,
      yearFrom: null,
      yearTo: null,
      refrigerant: null,
      oringUsage: [
        { size: "  ", qty: 3 }, // blank size → dropped
        { size: '1/2"', qty: Number.NaN }, // bad qty → dropped
      ],
      coolantLiters: null,
      notes: null,
    });
    const upd = runs.find((r) => r.sql.includes("UPDATE car_models SET"));
    expect(upd!.binds[4]).toBeNull(); // o-ring column → null
  });

  it("addCarModel creates a model under a brand when none matches", async () => {
    const { db } = makeDb({ attrOption: null });
    const out = await addCarModel(db, "cb1", "Yaris");
    expect(out.name).toBe("Yaris");
    expect(out.id).toBeTruthy();
  });

  it("addCarModel stores the era (year range) on a new model", async () => {
    const { db, runs } = makeDb({ attrOption: null });
    const out = await addCarModel(db, "cb1", "Vios", 2007, 2013);
    expect(out.name).toBe("Vios");
    const ins = runs.find((r) => r.sql.includes("INSERT INTO car_models"));
    expect(ins).toBeTruthy();
    expect(ins!.binds).toContain(2007);
    expect(ins!.binds).toContain(2013);
  });

  it("addAttribute reuses an existing option (case-insensitive), no insert", async () => {
    const { db, batched } = makeDb({ attrOption: { id: "b1", name: "DENSO" } });
    const out = await addAttribute(db, "brands", "denso");
    expect(out).toEqual({ id: "b1", name: "DENSO" });
    expect(batched.length).toBe(0);
  });

  it("addAttribute creates a new option when none matches", async () => {
    const { db } = makeDb({ attrOption: null });
    const out = await addAttribute(db, "brands", "  Bosch  ");
    expect(out.name).toBe("Bosch");
    expect(out.id).toBeTruthy();
  });

  it("resolveAttribute returns null for an empty value", async () => {
    const { db } = makeDb({});
    expect(await resolveAttribute(db, "brands", "   ")).toBeNull();
  });

  it("GET /attributes returns the lists", async () => {
    const { env } = makeDb({ brands: [{ id: "b1", name: "DENSO" }] });
    const res = await worker.fetch!(new Request("https://x/attributes"), env, ctx);
    const body = (await res.json()) as { brands: unknown[] };
    expect(body.brands).toEqual([{ id: "b1", name: "DENSO" }]);
  });

  it("POST /attributes/:kind rejects an unknown kind", async () => {
    const { env } = makeDb({});
    const res = await worker.fetch!(
      new Request("https://x/attributes/nope", {
        method: "POST",
        body: JSON.stringify({ name: "x" }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(404);
  });

  it("POST /attributes/brand creates an option", async () => {
    const { env } = makeDb({ attrOption: null });
    const res = await worker.fetch!(
      new Request("https://x/attributes/brand", {
        method: "POST",
        body: JSON.stringify({ name: "Bosch" }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(201);
    expect(((await res.json()) as { name: string }).name).toBe("Bosch");
  });
});

describe("barcodes", () => {
  it("ean13CheckDigit matches a known EAN-13", () => {
    expect(ean13CheckDigit("978014300723")).toBe("4");
  });

  it("addBarcodeToProduct derives the barcode from the product's Product ID when none is given", async () => {
    const { db, batched } = makeDb({
      variantRow: { id: "v1", barcodePrimary: null },
      productRef: { productRef: "AC-CMP-VIOS14" },
    });
    const out = await addBarcodeToProduct(db, "p1");
    expect(out.generated).toBe(true);
    expect(out.barcodeValue).toBe("AC-CMP-VIOS14");
    expect(out.variantId).toBe("v1");
    expect(batched.length).toBe(2); // insert barcode + set primary
  });

  it("addBarcodeToProduct makes no barcode when the product has no Product ID and none is given", async () => {
    const { db, batched } = makeDb({
      variantRow: { id: "v1", barcodePrimary: null },
      productRef: { productRef: null },
    });
    const out = await addBarcodeToProduct(db, "p1");
    expect(out.generated).toBe(false);
    expect(out.barcodeValue).toBe("");
    expect(batched.length).toBe(0);
  });

  it("addBarcodeToProduct keeps a provided/scanned code without overwriting the primary", async () => {
    const { db, batched } = makeDb({ variantRow: { id: "v1", barcodePrimary: "111" } });
    const out = await addBarcodeToProduct(db, "p1", "8850000000000");
    expect(out.generated).toBe(false);
    expect(out.barcodeValue).toBe("8850000000000");
    expect(batched.length).toBe(1);
  });
});

describe("lookupBarcode", () => {
  it("returns the variant + product for a known barcode", async () => {
    const hit = {
      barcode: "885",
      variantId: "v1",
      productId: "p1",
      productRef: "C1",
      name: "Cream",
    };
    const { db } = makeDb({ barcode: hit });
    expect(await lookupBarcode(db, "885")).toEqual(hit);
  });

  it("returns null for an unknown barcode", async () => {
    const { db } = makeDb({ barcode: null });
    expect(await lookupBarcode(db, "nope")).toBeNull();
  });
});

describe("storeGalleryImage", () => {
  function fakeBucket() {
    const puts: { key: string }[] = [];
    const bucket = { put: async (key: string) => void puts.push({ key }) } as unknown as R2Bucket;
    return { bucket, puts };
  }

  it("stores the first gallery image as the cover", async () => {
    const { db } = makeDb({}); // COUNT(*) → null → 0 existing
    const { bucket, puts } = fakeBucket();
    const out = await storeGalleryImage(
      db,
      bucket,
      "p1",
      new Uint8Array([1, 2]).buffer,
      "image/png",
    );
    expect(out.imageKey).toMatch(/^products\/p1\/.*\.png$/);
    expect(out.url).toBe(`/img/${out.imageKey}`);
    expect(out.isCover).toBe(true);
    expect(puts.length).toBe(1);
  });

  it("rejects an unsupported content type", async () => {
    const { db } = makeDb({});
    const { bucket } = fakeBucket();
    await expect(
      storeGalleryImage(db, bucket, "p1", new Uint8Array([1]).buffer, "image/gif"),
    ).rejects.toThrow(/unsupported/);
  });
});

describe("deleteGalleryImage", () => {
  it("deletes the DB row and the R2 object", async () => {
    const deleted: string[] = [];
    const bucket = {
      delete: async (key: string) => {
        deleted.push(key);
      },
    } as unknown as R2Bucket;
    const { db } = makeDb({});
    await deleteGalleryImage(db, bucket, "p1", "img1");
    expect(deleted).toEqual(["products/p1/gallery.png"]);
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
