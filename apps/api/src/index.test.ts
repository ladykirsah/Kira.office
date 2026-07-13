import { describe, it, expect, vi, afterEach } from "vitest";
import worker, {
  addBarcodeToProduct,
  applyAdjustmentToDb,
  applySyncToDb,
  applyOnlineSaleToDb,
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
  confirmPaymentWithSlip,
  importCustomers,
  importCustomerHistory,
  importCustomerVisits,
  importProducts,
  importShopeeOrders,
  listPayments,
  parseMoneyToSatang,
  parseOrderDateMs,
  parseFeePct,
  lineGrossProfitSatang,
  lookupBarcode,
  refundSaleToDb,
  requireAccess,
  runDailyBackup,
  backupR2Bucket,
  resolveActor,
  requireRole,
  salesToCsv,
  draftHeaderTotals,
  searchCustomers,
  normalizePlate,
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
  existingCustomers?: string[];
  historyEntries?: unknown[];
  batchChanges?: number[];
  paymentById?: unknown | null;
  slipRefOwner?: { id: string } | null;
  onlineSaleLedgerRow?: { id: string } | null;
  orderById?: unknown | null;
}) {
  const batched: { sql: string }[] = [];
  const runs: { sql: string; binds: unknown[] }[] = [];
  const alls: { sql: string; binds: unknown[] }[] = [];
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
        alls.push({ sql, binds: lastBinds });
        if (sql.includes("FROM customer_history_entries"))
          return { results: (canned.historyEntries ?? []) as T[] };
        if (sql.includes("FROM customers WHERE license_plate IN"))
          return {
            results: (canned.existingCustomers ?? []).map((p) => ({ licensePlate: p })) as T[],
          };
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
        if (sql.includes("FROM stock_ledger_entries WHERE source_type"))
          return (canned.onlineSaleLedgerRow ?? null) as T | null;
        if (sql.includes("FROM payments WHERE slip_ref"))
          return (canned.slipRefOwner ?? null) as T | null;
        if (sql.includes("FROM payments WHERE id")) return (canned.paymentById ?? null) as T | null;
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
        if (sql.includes("FROM sales_orders WHERE id = ? AND channel = 'airplus'"))
          return (canned.orderById ?? null) as T | null;
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
      const base = batched.length;
      batched.push(...stmts);
      return stmts.map((_, i) => ({ meta: { changes: canned.batchChanges?.[base + i] ?? 1 } }));
    },
  } as unknown as D1Database;
  return { db, env: { DB: db } as unknown as Env, batched, runs, alls };
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

describe("searchCustomers", () => {
  it("given a query > also matches the car model / vehicle, not only plate/phone/name", async () => {
    const { db } = makeDb({});
    const prepare = vi.spyOn(db, "prepare");
    await searchCustomers(db, "vigo");
    const sql = prepare.mock.calls[0]?.[0] as string;
    // A shopper searching a car model ("vigo") must match the vehicle it belongs to.
    expect(sql).toContain("b.vehicle LIKE ?");
    expect(sql).toContain("c.car_model LIKE ?");
    // Still matches the original fields too.
    expect(sql).toContain("x.license_plate LIKE ?");
    expect(sql).toContain("c.phone LIKE ?");
    expect(sql).toContain("c.customer_name LIKE ?");
  });

  it("lists directory-only customers (imported, no bills yet) alongside billed plates", async () => {
    const { db } = makeDb({});
    const prepare = vi.spyOn(db, "prepare");
    await searchCustomers(db, "");
    const sql = prepare.mock.calls[0]?.[0] as string;
    // The list must union the customers directory with billed plates — an imported customer
    // with no bills yet still appears; deriving from bills alone hides them.
    expect(sql).toMatch(/FROM\s*\(\s*SELECT license_plate FROM customers\s+UNION/);
  });

  it("counts transcribed legacy visits in the Visits total and last-visit date", async () => {
    const { db } = makeDb({});
    const prepare = vi.spyOn(db, "prepare");
    await searchCustomers(db, "");
    const sql = prepare.mock.calls[0]?.[0] as string;
    // A car with only imported history must show its visit count + last date, not 0/—.
    expect(sql).toContain("FROM customer_history_entries");
    expect(sql).toContain("COALESCE(b.billCount, 0) + COALESCE(h.legacyCount, 0)");
    expect(sql).toContain("h.lastLegacyAt");
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

  it("swallows a D1 failure (mutation must still complete) but logs it", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failingDb = {
      prepare: () => ({
        bind: () => ({
          run: () => Promise.reject(new Error("D1 down")),
        }),
      }),
    } as unknown as D1Database;
    // Deliberate: an audit-write failure must never fail the underlying mutation…
    await expect(
      writeAuditLog(failingDb, { actorEmail: "o@x.com", method: "POST", path: "/sync" }),
    ).resolves.toBeUndefined();
    // …but it must be visible in the Workers log, not silently dropped.
    expect(errSpy).toHaveBeenCalledWith("audit_log write failed:", expect.any(Error));
    errSpy.mockRestore();
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
  // Shopee export timestamps are Bangkok wall-clock with no offset. They must parse to the same
  // instant regardless of the runtime's timezone (Workers run UTC; naive Date.parse would be 7h off).
  it("anchors a naive Shopee datetime to Asia/Bangkok (+07:00)", () => {
    expect(parseOrderDateMs("2026-06-23 13:49")).toBe(Date.parse("2026-06-23T13:49:00+07:00"));
  });
  it("anchors a date-only string to Bangkok midnight", () => {
    expect(parseOrderDateMs("2026-06-14")).toBe(Date.parse("2026-06-14T00:00:00+07:00"));
  });
  it("respects an explicit offset/Z when the string carries one", () => {
    expect(parseOrderDateMs("2026-06-23T13:49:00Z")).toBe(Date.parse("2026-06-23T13:49:00Z"));
    expect(parseOrderDateMs("2026-06-23T13:49:00+02:00")).toBe(
      Date.parse("2026-06-23T13:49:00+02:00"),
    );
  });
  it("returns null for blank or unparseable input", () => {
    expect(parseOrderDateMs(undefined)).toBeNull();
    expect(parseOrderDateMs("")).toBeNull();
    expect(parseOrderDateMs("not a date")).toBeNull();
  });
});

describe("parseFeePct", () => {
  it("parses a percent string to basis points", () => {
    expect(parseFeePct("3.21%")).toBe(321);
    expect(parseFeePct("7.24")).toBe(724);
    expect(parseFeePct("10%")).toBe(1000);
  });
  it("returns 0 for blank or unparseable input", () => {
    expect(parseFeePct(undefined)).toBe(0);
    expect(parseFeePct("")).toBe(0);
    expect(parseFeePct("n/a")).toBe(0);
  });
});

describe("importShopeeOrders (enriched)", () => {
  it("captures username, sales, fee %, ship date; sets Total = Sales − fees", async () => {
    const { db, batched } = makeDb({ existingOrders: [] });
    const csv =
      "oid,user,sales,fee,feepct,shipdate,orderdate\n" +
      "2406ABC,shopper99,1450.00,105.00,7.24,2026-06-20,2026-06-14\n";
    const out = await importShopeeOrders(db, csv, {
      external_order_id: "oid",
      buyer_username: "user",
      sales_total: "sales",
      order_fee: "fee",
      fee_pct: "feepct",
      ship_date: "shipdate",
      order_date: "orderdate",
    });
    expect(out.imported).toBe(1);
    const insert = (batched as { sql: string; boundArgs?: unknown[] }[]).find((s) =>
      s.sql.includes("INSERT OR IGNORE INTO sales_orders"),
    );
    // Total (grand_total) = net payout = Sales − fees = 145000 − 10500
    expect(insert?.boundArgs?.[5]).toBe(134500);
    expect(insert?.boundArgs?.[6]).toBe(10500);
    expect(insert?.boundArgs?.[7]).toBe(Date.parse("2026-06-14T00:00:00+07:00"));
    // appended enriched binds: buyer_username, sales_satang, fee_bp, ship_time_ms
    expect(insert?.boundArgs?.[10]).toBe("shopper99");
    expect(insert?.boundArgs?.[11]).toBe(145000);
    expect(insert?.boundArgs?.[12]).toBe(724);
    expect(insert?.boundArgs?.[13]).toBe(Date.parse("2026-06-20T00:00:00+07:00"));
  });

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
    expect(insert?.boundArgs?.[7]).toBe(Date.parse("2026-06-14T00:00:00+07:00"));
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
    // sales_satang / fee_bp are NOT NULL DEFAULT 0 (migration 0029) — binding NULL fails on real D1
    // and rolls back the whole batch, so a mapping without those columns must bind 0, not null.
    expect(insert?.boundArgs?.[11]).toBe(0); // sales_satang
    expect(insert?.boundArgs?.[12]).toBe(0); // fee_bp
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

describe("PATCH /orders/:id (AirPlus fulfillment editor)", () => {
  const baseOrder = {
    id: "o1",
    channel: "airplus",
    externalOrderId: "AP-1",
    orderStatus: "ใหม่",
    paymentStatus: "รอชำระเงิน",
    grandTotalSatang: 119000,
    feeTotalSatang: 0,
    orderCreatedAt: 1720000000000,
    importedAt: 1720000000000,
    buyerUsername: "L",
    salesSatang: 119000,
    feeBp: 0,
    shipTimeMs: null,
    carrier: null,
    trackingNo: null,
    profitSatang: 0,
  };

  it("updates an order's fulfilment status and returns the updated row", async () => {
    const { env, runs } = makeDb({ orderById: baseOrder });
    const res = await worker.fetch!(
      new Request("https://x/orders/o1", {
        method: "PATCH",
        body: JSON.stringify({ orderStatus: "เตรียมจัดส่ง" }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { order: { orderStatus: string } };
    expect(data.order.orderStatus).toBe("เตรียมจัดส่ง");
    expect(runs.some((r) => r.sql.includes("UPDATE sales_orders SET order_status"))).toBe(true);
  });

  it("stamps ship_time_ms the first time a tracking number is set", async () => {
    const { env } = makeDb({ orderById: baseOrder });
    const res = await worker.fetch!(
      new Request("https://x/orders/o1", {
        method: "PATCH",
        body: JSON.stringify({
          orderStatus: "กำลังจัดส่ง",
          carrier: "Flash Express",
          trackingNo: "TH123",
        }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { order: { trackingNo: string; shipTimeMs: number | null } };
    expect(data.order.trackingNo).toBe("TH123");
    expect(typeof data.order.shipTimeMs).toBe("number");
  });

  it("404s for a non-existent or non-AirPlus order", async () => {
    const { env } = makeDb({ orderById: null });
    const res = await worker.fetch!(
      new Request("https://x/orders/nope", {
        method: "PATCH",
        body: JSON.stringify({ orderStatus: "สำเร็จ" }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(404);
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

  it("unexpected errors become a 500 with CORS + JSON, not an unhandled rejection", async () => {
    // {} as Env has no DB; a DB-backed route throws inside — the boundary must catch it.
    const res = await worker.fetch!(new Request("https://x/customers?q=x"), {} as Env, ctx);
    expect(res.status).toBe(500);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(((await res.json()) as { error?: string }).error).toBeTruthy();
  });

  it("malformed JSON bodies on money/stock routes return 400, not 500", async () => {
    for (const [method, path] of [
      ["POST", "/stock/adjust"],
      ["POST", "/sync"],
      ["POST", "/pricing/preview"],
      ["PUT", "/terms/template"],
      ["PUT", "/products/p1/pricing"],
      ["POST", "/import/shopee-orders"],
      ["POST", "/import/products"],
      ["POST", "/products"],
    ] as const) {
      const res = await worker.fetch!(
        new Request(`https://x${path}`, { method, body: "not json{" }),
        {} as Env,
        ctx,
      );
      expect(res.status, `${method} ${path}`).toBe(400);
    }
  });

  it("pricing preview rejects a body without numeric price/quantity (no NaN result)", async () => {
    const res = await worker.fetch!(
      new Request("https://x/pricing/preview", { method: "POST", body: JSON.stringify({}) }),
      {} as Env,
      ctx,
    );
    expect(res.status).toBe(400);
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

  it("GET /sales > lists only finalized bills (drafts & quotations are fenced out)", async () => {
    const { db, env } = makeDb({ sales: [] });
    const prepare = vi.spyOn(db, "prepare");
    await worker.fetch!(new Request("https://x/sales"), env, ctx);
    const salesSql = prepare.mock.calls
      .map((c) => c[0] as string)
      .find((s) => s.includes("FROM onsite_sales s"));
    expect(salesSql).toContain("stage = 'bill'");
  });

  it("GET /finance/summary > revenue and profit count only finalized bills", async () => {
    const { db, env } = makeDb({
      financeSales: { salesCount: 0, revenueSatang: 0, vatSatang: 0 },
      financeProfit: { grossProfitSatang: 0 },
      financeRefunds: { refundCount: 0, refundedSatang: 0 },
    });
    const prepare = vi.spyOn(db, "prepare");
    await worker.fetch!(new Request("https://x/finance/summary"), env, ctx);
    const sqls = prepare.mock.calls.map((c) => c[0] as string);
    expect(sqls.find((s) => s.includes("FROM onsite_sales WHERE sale_status"))).toContain(
      "stage = 'bill'",
    );
    expect(sqls.find((s) => s.includes("FROM onsite_sale_lines l JOIN"))).toContain(
      "stage = 'bill'",
    );
  });

  it("POST /onsite/drafts > saves a draft with its lines and never touches stock", async () => {
    const { db, env } = makeDb({});
    const prepare = vi.spyOn(db, "prepare");
    const res = await worker.fetch!(
      new Request("https://x/onsite/drafts", {
        method: "POST",
        body: JSON.stringify({
          draftId: "d1",
          stage: "draft",
          saleType: "repair",
          licensePlate: "1กก1234",
          lines: [{ quantity: 1, unitPriceSatang: 15000, description: "compressor" }],
        }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const sqls = prepare.mock.calls.map((c) => c[0] as string);
    expect(sqls.some((s) => s.includes("INTO onsite_sales"))).toBe(true);
    expect(sqls.some((s) => s.includes("INTO onsite_sale_lines"))).toBe(true);
    // a draft is a no-money document — nothing may hit the stock ledger
    expect(sqls.some((s) => s.includes("stock_ledger_entries"))).toBe(false);
  });

  it("GET /onsite/drafts > lists only open drafts and quotations", async () => {
    const { db, env } = makeDb({ sales: [] });
    const prepare = vi.spyOn(db, "prepare");
    await worker.fetch!(new Request("https://x/onsite/drafts"), env, ctx);
    const sql = prepare.mock.calls
      .map((c) => c[0] as string)
      .find((s) => s.includes("FROM onsite_sales") && s.includes("stage IN"));
    expect(sql).toContain("stage IN ('draft', 'quotation')");
  });

  it("DELETE /onsite/drafts/:id > removes a draft but is fenced from bills", async () => {
    const { db, env } = makeDb({});
    const prepare = vi.spyOn(db, "prepare");
    const res = await worker.fetch!(
      new Request("https://x/onsite/drafts/d1", { method: "DELETE" }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const sqls = prepare.mock.calls.map((c) => c[0] as string);
    expect(sqls.some((s) => s.includes("DELETE FROM onsite_sale_lines"))).toBe(true);
    expect(sqls.find((s) => s.includes("DELETE FROM onsite_sales"))).toContain(
      "stage IN ('draft', 'quotation')",
    );
  });

  it("GET /onsite/sales/:id > returns the bill header with its lines (for reprint)", async () => {
    const { env } = makeDb({
      saleHeader: { id: "s1", saleNumber: "DAS202607-04001", grandTotalSatang: 80000 },
      saleLines: [
        { lineType: "service", description: "Regas", quantity: 1, unitPriceSatang: 80000 },
      ],
    });
    const res = await worker.fetch!(new Request("https://x/onsite/sales/s1"), env, ctx);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sale: { saleNumber: string; lines: unknown[] } };
    expect(body.sale.saleNumber).toBe("DAS202607-04001");
    expect(body.sale.lines).toHaveLength(1);
  });

  it("GET /onsite/sales/:id > 404 when the bill is missing", async () => {
    const { env } = makeDb({ saleHeader: null });
    const res = await worker.fetch!(new Request("https://x/onsite/sales/nope"), env, ctx);
    expect(res.status).toBe(404);
  });

  it("PUT /customers/by-plate > upserts by plate and never blanks an existing name/phone", async () => {
    const { db, env } = makeDb({});
    const prepare = vi.spyOn(db, "prepare");
    const res = await worker.fetch!(
      new Request("https://x/customers/by-plate", {
        method: "PUT",
        body: JSON.stringify({ licensePlate: "1กก1234", phone: "0810000000" }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const sql = prepare.mock.calls
      .map((c) => c[0] as string)
      .find((s) => s.includes("INSERT INTO customers"));
    expect(sql).toContain("ON CONFLICT(license_plate)");
    expect(sql).toContain("COALESCE(excluded.customer_name, customers.customer_name)");
    expect(sql).toContain("COALESCE(excluded.phone, customers.phone)");
  });

  it("PUT /customers/by-plate > 400 without a plate", async () => {
    const { env } = makeDb({});
    const res = await worker.fetch!(
      new Request("https://x/customers/by-plate", { method: "PUT", body: JSON.stringify({}) }),
      env,
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it("GET /customers > lists cars from the directory ∪ bills, with bill stats joined", async () => {
    const { db, env } = makeDb({ sales: [] });
    const prepare = vi.spyOn(db, "prepare");
    const res = await worker.fetch!(new Request("https://x/customers?q=nav"), env, ctx);
    expect(res.status).toBe(200);
    const sql = prepare.mock.calls
      .map((c) => c[0] as string)
      .find((s) => s.includes("LEFT JOIN customers"));
    expect(sql).toContain("GROUP BY license_plate"); // bill stats grouped in the subquery
    expect(sql).toContain("stage = 'bill'"); // drafts/quotes never count as visits
  });

  it("GET /customers/:plate > returns info + bill history + open quotations", async () => {
    const { env } = makeDb({
      sales: [
        {
          id: "s1",
          saleNumber: "DAS202607-04001",
          stage: "bill",
          createdAt: 2,
          grandTotalSatang: 80000,
          vehicle: "Nissan Navara",
        },
        {
          id: "s2",
          saleNumber: "QT202607-04001",
          stage: "quotation",
          createdAt: 3,
          grandTotalSatang: 50000,
          vehicle: "Nissan Navara",
        },
      ],
      saleLines: [
        {
          onsiteSaleId: "s1",
          description: "Regas",
          lineType: "service",
          quantity: 1,
          unitPriceSatang: 80000,
        },
      ],
    });
    const res = await worker.fetch!(
      new Request("https://x/customers/5%E0%B8%88%E0%B8%887890"),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { history: unknown[]; quotations: unknown[] };
    expect(body.history).toHaveLength(1);
    expect(body.quotations).toHaveLength(1);
  });

  it("GET /customers/:plate > history lines carry the exact part ID (productRef)", async () => {
    const { db, env } = makeDb({
      sales: [{ id: "s1", stage: "bill", createdAt: 2, vehicle: null }],
      saleLines: [],
    });
    const prepare = vi.spyOn(db, "prepare");
    const res = await worker.fetch!(
      new Request("https://x/customers/5%E0%B8%88%E0%B8%887890"),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const sql = prepare.mock.calls
      .map((c) => c[0] as string)
      .find((s) => s.includes("FROM onsite_sale_lines"));
    // Same-brand parts interchange across car models (a Denso evaporator for model A fits model
    // B too) — only the part ID says WHICH one was installed, so history lines must carry it.
    expect(sql).toContain("LEFT JOIN product_variants");
    expect(sql).toContain("product_ref AS productRef");
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

  it("shop-info round-trips paymentMethods (the Payment page dropdown needs it)", async () => {
    const store = new Map<string, string>();
    const env = {
      KV: {
        get: async (k: string) => store.get(k) ?? null,
        put: async (k: string, v: string) => void store.set(k, v),
      },
    } as unknown as Env;
    const methods = JSON.stringify([
      { id: "a", label: "ร้าน", promptpayId: "0812345678", isDefault: true },
      { id: "b", label: "แม่", promptpayId: "1234567890123" },
    ]);
    await worker.fetch!(
      new Request("https://x/shop-info", {
        method: "PUT",
        body: JSON.stringify({ name: "ร้าน", paymentMethods: methods }),
      }),
      env,
      ctx,
    );
    expect(store.get("shop:paymentMethods")).toBe(methods);
    const res = await worker.fetch!(new Request("https://x/shop-info"), env, ctx);
    const body = (await res.json()) as Record<string, string | null>;
    expect(body.paymentMethods).toBe(methods);
  });

  it("POST /payments > records an approved payment (label, account, amount, timestamps)", async () => {
    const { db, runs } = makeDb({});
    const res = await worker.fetch!(
      new Request("https://x/payments", {
        method: "POST",
        body: JSON.stringify({
          methodLabel: "แม่",
          promptpayId: "0812345678",
          amountSatang: 145000,
        }),
      }),
      { DB: db } as unknown as Env,
      ctx,
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { payment: { id: string; status: string } };
    expect(body.payment.status).toBe("approved");
    const insert = runs.find((r) => r.sql.includes("INSERT INTO payments"));
    expect(insert?.binds).toContain("แม่");
    expect(insert?.binds).toContain("0812345678");
    expect(insert?.binds).toContain(145000);
    expect(insert?.binds).toContain("approved");
  });

  it("POST /payments > 400 on a missing method, bad amount, or malformed body", async () => {
    const bad = async (body: string) =>
      (
        await worker.fetch!(
          new Request("https://x/payments", { method: "POST", body }),
          {} as Env,
          ctx,
        )
      ).status;
    expect(await bad("not json{")).toBe(400);
    expect(
      await bad(JSON.stringify({ methodLabel: "แม่", promptpayId: "08", amountSatang: 0 })),
    ).toBe(400);
    expect(
      await bad(JSON.stringify({ methodLabel: "", promptpayId: "08", amountSatang: 100 })),
    ).toBe(400);
    expect(
      await bad(JSON.stringify({ methodLabel: "แม่", promptpayId: "", amountSatang: 100 })),
    ).toBe(400);
    expect(
      await bad(JSON.stringify({ methodLabel: "แม่", promptpayId: "08", amountSatang: 10.5 })),
    ).toBe(400);
  });

  it("listPayments > selects the latest UNCLEARED payments with camelCase aliases", async () => {
    const { db } = makeDb({});
    const prepare = vi.spyOn(db, "prepare");
    await listPayments(db);
    const sql = prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain("method_label AS methodLabel");
    expect(sql).toContain("amount_satang AS amountSatang");
    expect(sql).toContain("cleared_at IS NULL"); // Recent = not-yet-reconciled only
    expect(sql).toContain("ORDER BY created_at DESC");
  });

  it("POST /payments/clear > marks all uncleared payments reconciled (never deletes)", async () => {
    const { db, runs } = makeDb({});
    const res = await worker.fetch!(
      new Request("https://x/payments/clear", { method: "POST" }),
      { DB: db } as unknown as Env,
      ctx,
    );
    expect(res.status).toBe(200);
    const update = runs.find((r) => r.sql.includes("UPDATE payments SET cleared_at"));
    expect(update).toBeDefined();
    expect(update?.sql).toContain("WHERE cleared_at IS NULL");
    // no DELETE — the audit trail must survive a clear
    expect(runs.some((r) => /DELETE\s+FROM\s+payments/i.test(r.sql))).toBe(false);
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
    const dump = JSON.parse(puts[0]!.body) as { tables: Record<string, unknown[]> };
    expect(dump).toHaveProperty("tables");
    // Irreplaceable data must be in the daily dump: the customer directory, the anti-cheat
    // payment trail, the audit log, and hand-transcribed legacy history.
    for (const table of ["customers", "payments", "audit_logs", "customer_history_entries"]) {
      expect(Object.keys(dump.tables)).toContain(table);
    }
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
      { sql: string; boundArgs: unknown[] } | undefined;
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

  it("rejects a discount greater than the line subtotal (would make the total negative)", () => {
    expect(
      validateSyncLine({
        productVariantId: "v1",
        quantity: 1,
        unitPriceSatang: 10000,
        discountSatang: 15000,
      }),
    ).toMatch(/discount/i);
  });

  it("rejects a negative discount", () => {
    expect(
      validateSyncLine({
        productVariantId: "v1",
        quantity: 1,
        unitPriceSatang: 10000,
        discountSatang: -1,
      }),
    ).toMatch(/discount/i);
  });

  it("rejects a negative unit price", () => {
    expect(validateSyncLine({ productVariantId: "v1", quantity: 1, unitPriceSatang: -1 })).toMatch(
      /price/i,
    );
  });

  it("accepts a discount within the line subtotal", () => {
    expect(
      validateSyncLine({
        productVariantId: "v1",
        quantity: 2,
        unitPriceSatang: 10000,
        discountSatang: 5000,
      }),
    ).toBeNull();
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

describe("draftHeaderTotals", () => {
  it("sums lines: grand = subtotal − discount, tax tracked separately", () => {
    expect(
      draftHeaderTotals([
        { quantity: 2, unitPriceSatang: 15000, discountSatang: 1000, taxSatang: 900 },
        { quantity: 1, unitPriceSatang: 30000, taxSatang: 1962 },
      ]),
    ).toEqual({
      subtotalSatang: 60000,
      discountTotalSatang: 1000,
      taxTotalSatang: 2862,
      grandTotalSatang: 59000,
    });
  });

  it("given no lines > all zero", () => {
    expect(draftHeaderTotals([])).toEqual({
      subtotalSatang: 0,
      discountTotalSatang: 0,
      taxTotalSatang: 0,
      grandTotalSatang: 0,
    });
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

describe("normalizePlate", () => {
  it("trims and collapses internal whitespace to a single space", () => {
    expect(normalizePlate("  1กก  1234 ")).toBe("1กก 1234");
    expect(normalizePlate("1กก1234")).toBe("1กก1234");
    expect(normalizePlate("")).toBe("");
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

describe("importCustomers (legacy customer Excel bulk upsert)", () => {
  const mapping = { license_plate: "ทะเบียน", customer_name: "ชื่อ", phone: "เบอร์" };

  it("upserts new plates normalized, binds null for empty cells, counts created", async () => {
    const { db, batched } = makeDb({});
    const out = await importCustomers(
      db,
      "ทะเบียน,ชื่อ,เบอร์\nกข  1234,สมชาย,0811112222\nขค 555,,\n",
      mapping,
    );
    expect(out).toMatchObject({ received: 2, created: 2, updated: 0, duplicates: 0, invalid: 0 });
    const ups = (batched as { sql: string; boundArgs?: unknown[] }[]).filter((s) =>
      s.sql.includes("ON CONFLICT(license_plate) DO UPDATE"),
    );
    expect(ups).toHaveLength(2);
    // binds: (id, license_plate, plate_province, customer_name, phone, car_model, notes, created_at, updated_at)
    expect(ups[0]?.boundArgs?.[1]).toBe("กข 1234"); // normalized: double space collapsed
    expect(ups[0]?.boundArgs?.[2]).toBeNull(); // unmapped province → null, never blanks
    expect(ups[0]?.boundArgs?.[3]).toBe("สมชาย");
    expect(ups[0]?.boundArgs?.[4]).toBe("0811112222");
    expect(ups[1]?.boundArgs?.[3]).toBeNull(); // empty cell → null, never blanks
  });

  it("counts a plate already in the directory as updated, and still upserts it", async () => {
    const { db, batched } = makeDb({ existingCustomers: ["กข 1234"] });
    const out = await importCustomers(db, "ทะเบียน,ชื่อ,เบอร์\nกข 1234,สมชาย,\n", mapping);
    expect(out).toMatchObject({ received: 1, created: 0, updated: 1 });
    expect(batched.filter((s) => s.sql.includes("DO UPDATE"))).toHaveLength(1);
  });

  it("skips an in-file repeat of the same normalized plate (first row wins)", async () => {
    const { db, batched } = makeDb({});
    const out = await importCustomers(db, "ทะเบียน,ชื่อ\nกข 1234,สมชาย\nกข  1234,สมหญิง\n", {
      license_plate: "ทะเบียน",
      customer_name: "ชื่อ",
    });
    expect(out).toMatchObject({ received: 2, created: 1, updated: 0, duplicates: 1 });
    const ups = (batched as { sql: string; boundArgs?: unknown[] }[]).filter((s) =>
      s.sql.includes("DO UPDATE"),
    );
    expect(ups).toHaveLength(1);
    expect(ups[0]?.boundArgs?.[3]).toBe("สมชาย");
  });

  it("reports rows missing a plate with their row number and imports the rest", async () => {
    const { db } = makeDb({});
    const out = await importCustomers(db, "ทะเบียน,ชื่อ\nกข 1,A\n,B\nขค 2,C\n", {
      license_plate: "ทะเบียน",
      customer_name: "ชื่อ",
    });
    expect(out).toMatchObject({ received: 3, created: 2, invalid: 1 });
    expect(out.errors).toEqual([{ rowIndex: 2, reason: expect.stringContaining("license_plate") }]);
  });

  it("chunks the existing-plate lookup under D1's 100-bound-params limit", async () => {
    const { db, alls } = makeDb({});
    const rows = Array.from({ length: 95 }, (_, i) => `ปข ${i + 1},ชื่อ${i}`).join("\n");
    await importCustomers(db, "ทะเบียน,ชื่อ\n" + rows + "\n", {
      license_plate: "ทะเบียน",
      customer_name: "ชื่อ",
    });
    const lookups = alls.filter((s) => s.sql.includes("FROM customers WHERE license_plate IN"));
    expect(lookups).toHaveLength(2);
    expect(lookups.every((s) => s.binds.length <= 90)).toBe(true);
  });

  it("POST /import/customers > 400 when the plate column is not mapped", async () => {
    const { env } = makeDb({});
    const res = await worker.fetch!(
      new Request("https://x/import/customers", {
        method: "POST",
        body: JSON.stringify({ csv: "a,b\n1,2\n", mapping: { customer_name: "b" } }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(400);
  });
});

describe("importCustomerHistory (transcribed legacy service history)", () => {
  const mapping = { license_plate: "ทะเบียน", happened_at: "วันที่", description: "รายการ" };

  it("inserts entries with parsed Thai dates and auto-creates directory rows — memory, not money", async () => {
    const { db, batched } = makeDb({});
    const out = await importCustomerHistory(
      db,
      "ทะเบียน,วันที่,รายการ\nกข  1234,31 มีค 68,เปลี่ยนคอม ล้างตู้\nขค 555,9 พค 65,เติมน้ำยา\n",
      mapping,
    );
    expect(out).toMatchObject({ received: 2, imported: 2, duplicates: 0, invalid: 0 });
    const ins = (batched as { sql: string; boundArgs?: unknown[] }[]).filter((s) =>
      s.sql.includes("INSERT OR IGNORE INTO customer_history_entries"),
    );
    expect(ins).toHaveLength(2);
    expect(ins[0]?.boundArgs?.[1]).toBe("กข 1234"); // normalized plate
    expect(ins[0]?.boundArgs?.[2]).toBe(Date.parse("2025-03-31T00:00:00+07:00"));
    expect(ins[0]?.boundArgs?.[3]).toBe("เปลี่ยนคอม ล้างตู้");
    // the car must appear on the Customers list → a bare directory row per plate
    expect(
      batched.filter((s) => s.sql.includes("ON CONFLICT(license_plate) DO UPDATE")),
    ).toHaveLength(2);
    // never touches stock or sales
    expect(
      batched.some((s) => s.sql.includes("stock_ledger") || s.sql.includes("onsite_sales")),
    ).toBe(false);
  });

  it("reports an unreadable date with its row number and imports the rest", async () => {
    const { db, batched } = makeDb({});
    const out = await importCustomerHistory(
      db,
      "ทะเบียน,วันที่,รายการ\nกข 1,31 มีค 68,งาน A\nขค 2,ไม่รู้,งาน B\n",
      mapping,
    );
    expect(out).toMatchObject({ received: 2, imported: 1, invalid: 1 });
    expect(out.errors[0]).toMatchObject({ rowIndex: 2 });
    expect(batched.filter((s) => s.sql.includes("customer_history_entries"))).toHaveLength(1);
  });

  it("skips an exact in-file repeat (same normalized plate + date + text) as duplicate", async () => {
    const { db, batched } = makeDb({});
    const out = await importCustomerHistory(
      db,
      "ทะเบียน,วันที่,รายการ\nกข 1,31 มีค 68,งาน A\nกข  1,31 มีค 68,งาน A\n",
      mapping,
    );
    expect(out).toMatchObject({ received: 2, imported: 1, duplicates: 1 });
    expect(batched.filter((s) => s.sql.includes("customer_history_entries"))).toHaveLength(1);
  });

  it("re-import counts DB-suppressed rows as duplicates, not imported (INSERT OR IGNORE truth)", async () => {
    // Real D1 reports meta.changes = 0 when the UNIQUE key suppresses an insert; the counters
    // must reflect that — the UI promises "records already imported are skipped".
    const { db } = makeDb({ batchChanges: [1, 0, 1] }); // entry A written, entry B suppressed, upsert
    const out = await importCustomerHistory(
      db,
      "ทะเบียน,วันที่,รายการ\nกข 1,31 มีค 68,งาน A\nกข 1,9 พค 65,งาน B\n",
      mapping,
    );
    expect(out).toMatchObject({ received: 2, imported: 1, duplicates: 1, invalid: 0 });
  });

  it("POST /import/customer-history > 400 when a required column is not mapped", async () => {
    const { env } = makeDb({});
    const res = await worker.fetch!(
      new Request("https://x/import/customer-history", {
        method: "POST",
        body: JSON.stringify({ csv: "a\n1\n", mapping: { license_plate: "a" } }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(400);
  });

  it("GET /customers/:plate > returns structured legacy entries (lines + bill note) alongside bills", async () => {
    const { env } = makeDb({
      sales: [],
      historyEntries: [
        {
          id: "h1",
          happenedAt: 111,
          description: "ตู้แอร์ · DENSO\nโอริง",
          note: "3-month warranty",
          linesJson: JSON.stringify([
            { description: "ตู้แอร์ · DENSO", productRef: "TG-1" },
            { description: "โอริง", productRef: null },
          ]),
        },
      ],
    });
    const res = await worker.fetch!(
      new Request("https://x/customers/%E0%B8%81%E0%B8%82%201234"),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      legacy: {
        note: string | null;
        lines: { description: string; productRef: string | null }[];
      }[];
    };
    expect(body.legacy).toHaveLength(1);
    expect(body.legacy[0]?.note).toBe("3-month warranty");
    expect(body.legacy[0]?.lines).toEqual([
      { description: "ตู้แอร์ · DENSO", productRef: "TG-1" },
      { description: "โอริง", productRef: null },
    ]);
  });

  it("GET /customers/:plate > OLD text-only legacy entry falls back to newline-split lines", async () => {
    const { env } = makeDb({
      sales: [],
      historyEntries: [
        { id: "h2", happenedAt: 99, description: "งาน A\nงาน B", note: null, linesJson: null },
      ],
    });
    const res = await worker.fetch!(
      new Request("https://x/customers/%E0%B8%81%E0%B8%82%201234"),
      env,
      ctx,
    );
    const body = (await res.json()) as {
      legacy: { lines: { description: string; productRef: string | null }[] }[];
    };
    expect(body.legacy[0]?.lines).toEqual([
      { description: "งาน A", productRef: null },
      { description: "งาน B", productRef: null },
    ]);
  });
});

describe("importCustomerVisits (structured bill-style legacy import)", () => {
  it("stores lines_json + bill note + canonical description; parses the Thai date; auto-creates the car", async () => {
    const { db, batched } = makeDb({});
    const out = await importCustomerVisits(db, [
      {
        licensePlate: "กข  1234",
        happenedAt: "31 มีค 68",
        note: "3-month",
        lines: [
          { description: "ตู้แอร์ · DENSO", productRef: "TG-1" },
          { description: "โอริง", productRef: null },
        ],
      },
    ]);
    expect(out).toMatchObject({ received: 1, imported: 1, duplicates: 0, invalid: 0 });
    const ins = (batched as { sql: string; boundArgs?: unknown[] }[]).find((s) =>
      s.sql.includes("INSERT OR IGNORE INTO customer_history_entries"),
    );
    // binds: (id, plate, happened_at, description, note, lines_json, created_at)
    expect(ins?.boundArgs?.[1]).toBe("กข 1234"); // normalized plate
    expect(ins?.boundArgs?.[2]).toBe(Date.parse("2025-03-31T00:00:00+07:00"));
    expect(ins?.boundArgs?.[3]).toBe("ตู้แอร์ · DENSO\nโอริง"); // canonical text for dedup/search
    expect(ins?.boundArgs?.[4]).toBe("3-month");
    expect(JSON.parse(String(ins?.boundArgs?.[5]))).toEqual([
      { description: "ตู้แอร์ · DENSO", productRef: "TG-1" },
      { description: "โอริง", productRef: null },
    ]);
    expect(
      batched.filter((s) => s.sql.includes("ON CONFLICT(license_plate) DO UPDATE")),
    ).toHaveLength(1);
    expect(
      batched.some((s) => s.sql.includes("stock_ledger") || s.sql.includes("onsite_sales")),
    ).toBe(false); // memory, not money
  });

  it("reports a visit with an unreadable date by its 1-based visit index", async () => {
    const { db } = makeDb({});
    const out = await importCustomerVisits(db, [
      {
        licensePlate: "กข 1",
        happenedAt: "31 มีค 68",
        lines: [{ description: "A", productRef: null }],
      },
      {
        licensePlate: "กข 1",
        happenedAt: "ไม่รู้",
        lines: [{ description: "B", productRef: null }],
      },
    ]);
    expect(out).toMatchObject({ received: 2, imported: 1, invalid: 1 });
    expect(out.errors[0]).toMatchObject({ rowIndex: 2 });
  });

  it("POST /import/customer-history with {visits} routes to the structured importer", async () => {
    const { env } = makeDb({});
    const res = await worker.fetch!(
      new Request("https://x/import/customer-history", {
        method: "POST",
        body: JSON.stringify({
          visits: [
            {
              licensePlate: "กข 1",
              happenedAt: "31 มีค 68",
              lines: [{ description: "A", productRef: null }],
            },
          ],
        }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ imported: 1 });
  });
});

describe("confirmPaymentWithSlip (Payment auto-confirm via slip verification)", () => {
  const APPROVED = {
    id: "pay1",
    amountSatang: 145000,
    status: "approved",
    slipRef: null,
  };
  const CONFIG = { SLIPOK_API_KEY: "k", SLIPOK_BRANCH_ID: "b" };
  const QR = "00460006000001010302TH9104ABCD1234EFGH5678IJKL";

  function stubSlipOk(response: unknown, status = 200) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(response), { status })),
    );
  }
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 501-style result when SlipOK credentials are not configured", async () => {
    const { db } = makeDb({ paymentById: APPROVED });
    const out = await confirmPaymentWithSlip(db, {}, "pay1", QR);
    expect(out).toMatchObject({ ok: false, code: 501 });
  });

  it("404s an unknown payment", async () => {
    const { db } = makeDb({ paymentById: null });
    const out = await confirmPaymentWithSlip(db, CONFIG, "nope", QR);
    expect(out).toMatchObject({ ok: false, code: 404 });
  });

  it("rejects a QR payload that cannot be a slip", async () => {
    const { db } = makeDb({ paymentById: APPROVED });
    const out = await confirmPaymentWithSlip(db, CONFIG, "pay1", "hi");
    expect(out).toMatchObject({ ok: false, code: 400 });
  });

  it("refuses a payment that is already confirmed", async () => {
    const { db } = makeDb({ paymentById: { ...APPROVED, status: "confirmed" } });
    const out = await confirmPaymentWithSlip(db, CONFIG, "pay1", QR);
    expect(out).toMatchObject({ ok: false, code: 409 });
  });

  it("ANTI-CHEAT: refuses a slip already used to confirm another payment", async () => {
    const { db } = makeDb({ paymentById: APPROVED, slipRefOwner: { id: "other-payment" } });
    stubSlipOk({ success: true, data: { transRef: "TR123", amount: 1450 } });
    const out = await confirmPaymentWithSlip(db, CONFIG, "pay1", QR);
    expect(out).toMatchObject({ ok: false, code: 409 });
    expect(String((out as { error: string }).error)).toMatch(/already/i);
  });

  it("fails when the provider rejects the slip", async () => {
    const { db } = makeDb({ paymentById: APPROVED });
    stubSlipOk({ success: false, message: "Invalid slip" }, 400);
    const out = await confirmPaymentWithSlip(db, CONFIG, "pay1", QR);
    expect(out).toMatchObject({ ok: false, code: 422 });
  });

  it("fails when the slip amount does not match the payment", async () => {
    const { db } = makeDb({ paymentById: APPROVED });
    stubSlipOk({ success: true, data: { transRef: "TR123", amount: 999 } }); // ฿999 ≠ ฿1,450
    const out = await confirmPaymentWithSlip(db, CONFIG, "pay1", QR);
    expect(out).toMatchObject({ ok: false, code: 422 });
    expect(String((out as { error: string }).error)).toMatch(/amount/i);
  });

  it("confirms on a valid matching slip: status → confirmed with the bank reference stored", async () => {
    const { db, runs } = makeDb({ paymentById: APPROVED });
    stubSlipOk({ success: true, data: { transRef: "TR123", amount: 1450 } });
    const out = await confirmPaymentWithSlip(db, CONFIG, "pay1", QR);
    expect(out).toMatchObject({ ok: true, ref: "TR123" });
    const upd = runs.find((r) => r.sql.includes("UPDATE payments SET status = 'confirmed'"));
    expect(upd).toBeDefined();
    expect(upd?.binds[0]).toBe("TR123");
    expect(upd?.binds[3]).toBe("pay1");
  });
});

describe("applyOnlineSaleToDb (AirPlus order stock deduction)", () => {
  const LINES = [
    { productVariantId: "var-1", quantity: 2 },
    { productVariantId: "var-2", quantity: 1 },
  ];

  it("given no lines > applies nothing", async () => {
    const { db, batched } = makeDb({});
    const out = await applyOnlineSaleToDb(db, "order-1", []);
    expect(out).toEqual({ applied: false, duplicate: false, conflicts: [] });
    expect(batched.length).toBe(0);
  });

  it("IDEMPOTENT: given the order already has ledger rows > no-op duplicate, nothing written", async () => {
    const { db, batched } = makeDb({ onlineSaleLedgerRow: { id: "led-x" } });
    const out = await applyOnlineSaleToDb(db, "order-1", LINES);
    expect(out).toEqual({ applied: false, duplicate: true, conflicts: [] });
    expect(batched.length).toBe(0);
  });

  it("FAIL-CLOSED: given any line short on stock > whole order conflicts, nothing written", async () => {
    const { db, batched } = makeDb({
      available: [
        { variantId: "var-1", available: 5 },
        { variantId: "var-2", available: 0 }, // second line short
      ],
    });
    const out = await applyOnlineSaleToDb(db, "order-1", LINES);
    expect(out.applied).toBe(false);
    expect(out.conflicts).toEqual([{ productVariantId: "var-2", requested: 1, available: 0 }]);
    expect(batched.length).toBe(0);
  });

  it("given enough stock > writes one online_sale ledger delta per line with running quantity_after", async () => {
    const { db, batched } = makeDb({
      available: [
        { variantId: "var-1", available: 5 },
        { variantId: "var-2", available: 3 },
      ],
    });
    const out = await applyOnlineSaleToDb(db, "order-1", LINES);
    expect(out).toEqual({ applied: true, duplicate: false, conflicts: [] });
    expect(batched.length).toBe(2);
    const inserts = batched as unknown as { sql: string; boundArgs: unknown[] }[];
    expect(inserts[0]!.sql).toContain("INSERT INTO stock_ledger_entries");
    expect(inserts[0]!.sql).toContain("'online_sale'");
    expect(inserts[0]!.sql).toContain("'sales_order'");
    // (id, variant, delta, after, orderId, createdAt)
    expect(inserts[0]!.boundArgs[1]).toBe("var-1");
    expect(inserts[0]!.boundArgs[2]).toBe(-2);
    expect(inserts[0]!.boundArgs[3]).toBe(3); // 5 - 2
    expect(inserts[0]!.boundArgs[4]).toBe("order-1");
    expect(inserts[1]!.boundArgs[1]).toBe("var-2");
    expect(inserts[1]!.boundArgs[2]).toBe(-1);
    expect(inserts[1]!.boundArgs[3]).toBe(2); // 3 - 1
  });

  it("given a variant missing from the ledger entirely > treats available as 0 and conflicts", async () => {
    const { db } = makeDb({ available: [{ variantId: "var-1", available: 5 }] });
    const out = await applyOnlineSaleToDb(db, "order-1", LINES);
    expect(out.conflicts).toEqual([{ productVariantId: "var-2", requested: 1, available: 0 }]);
  });
});
