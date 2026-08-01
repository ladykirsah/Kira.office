import { describe, it, expect, vi, afterEach } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import worker, {
  addBarcodeToProduct,
  applyAdjustmentToDb,
  applySyncToDb,
  applyOnlineSaleToDb,
  archiveProduct,
  BACKUP_TABLES,
  buildCorsHeaders,
  createClaim,
  createProduct,
  deleteGalleryImage,
  ean13CheckDigit,
  entityFromPath,
  expireUnpaidOrders,
  reviewOrderPayment,
  recordRefund,
  recordClaimRefund,
  recordClaimReturnShipment,
  getOrderDetail,
  getProductDetail,
  applyHoldToDb,
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
  transitionClaim,
  updateOrder,
  updateProduct,
  normalizeWarrantyDays,
  confirmPaymentWithSlip,
  importCustomers,
  importCustomerHistory,
  importCustomerVisits,
  importProducts,
  importShopeeOrders,
  listOrders,
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
  anonymizeStorefrontCustomerInDb,
  searchStorefrontCustomers,
  getStorefrontCustomerDetail,
  setStorefrontMarketingConsent,
  normalizePlate,
  validateSyncLine,
  writeAuditLog,
  countFitmentsUsingAttribute,
  type Env,
} from "./index";
import {
  CLAIM_STATES,
  CUSTOMER_CODE_PREFIX,
  generateCustomerCode,
  isCustomerCode,
  isOrderHistoryEvent,
  operationalStatus,
} from "@l-shopee/core";

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
  attrInUseCount?: number;
  /** deleteAttribute guard (fitment-referenced kinds): how many product_fitments still name the row. */
  fitmentInUseCount?: number;
  /** deleteAttribute guard (car_models): the model row looked up (name + parent brand) before counting. */
  carModelRow?: { name: string; brandName: string | null } | null;
  /** deleteAttribute guard (car_brands): the brand row looked up (name) before counting. */
  carBrandRow?: { name: string } | null;
  stock?: unknown[];
  movements?: unknown[];
  stockOnHand?: number;
  heldNet?: number;
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
  banners?: unknown[];
  bannerById?: { id: string; imageKey: string | null } | null;
  coupons?: unknown[];
  couponByCode?: { id: string } | null;
  couponRedemptions?: number;
  campaigns?: unknown[];
  campaignPrices?: unknown[];
  campaignPriceDup?: { id: string } | null;
  variantMatches?: unknown[];
  variantById?: { id: string } | null;
  affiliateItems?: unknown[];
  affiliateItemById?: { id: string; imageKey: string | null } | null;
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
        if (sql.includes("AS offlinePriceSatang")) {
          // Model D1's WHERE: the catalog list hides soft-deleted rows, so drop archived products
          // when the query carries the exclusion predicate (a bare SELECT would still return them).
          const rows = (canned.products ?? []) as { status?: string }[];
          const hidesArchived = /status\s*(<>|!=)\s*'archived'/.test(sql);
          return {
            results: (hidesArchived ? rows.filter((r) => r.status !== "archived") : rows) as T[],
          };
        }
        // searchVariants (the campaign product picker) also selects FROM products — match its
        // unique LIKE predicate before the products branch below, or it answers with canned.products.
        if (sql.includes("p.name LIKE ?")) return { results: (canned.variantMatches ?? []) as T[] };
        if (sql.includes("FROM banners")) return { results: (canned.banners ?? []) as T[] };
        if (sql.includes("FROM coupons c")) return { results: (canned.coupons ?? []) as T[] };
        if (sql.includes("FROM campaign_prices cp"))
          return { results: (canned.campaignPrices ?? []) as T[] };
        if (sql.includes("FROM campaigns")) return { results: (canned.campaigns ?? []) as T[] };
        if (sql.includes("FROM affiliate_items a"))
          return { results: (canned.affiliateItems ?? []) as T[] };
        if (sql.includes("FROM product_images")) return { results: (canned.images ?? []) as T[] };
        if (sql.includes("FROM product_fitments"))
          return { results: (canned.fitments ?? []) as T[] };
        if (sql.includes("FROM brands")) return { results: (canned.brands ?? []) as T[] };
        if (sql.includes("FROM product_types")) return { results: (canned.types ?? []) as T[] };
        if (sql.includes("FROM usage_categories")) return { results: (canned.usages ?? []) as T[] };
        if (sql.includes("FROM car_brands")) return { results: (canned.carBrands ?? []) as T[] };
        if (sql.includes("FROM car_models")) return { results: (canned.carModels ?? []) as T[] };
        if (sql.includes("FROM services")) return { results: (canned.services ?? []) as T[] };
        if (sql.includes("LEFT JOIN stock_ledger_entries")) {
          // listStock hides soft-deleted rows — model the WHERE like the products branch above.
          const rows = (canned.stock ?? []) as { status?: string }[];
          const hides = /status\s*(<>|!=)\s*'archived'/.test(sql);
          return { results: (hides ? rows.filter((r) => r.status !== "archived") : rows) as T[] };
        }
        if (sql.includes("movement_type AS movementType")) {
          const rows = (canned.movements ?? []) as { status?: string }[];
          const hides = /status\s*(<>|!=)\s*'archived'/.test(sql);
          return { results: (hides ? rows.filter((r) => r.status !== "archived") : rows) as T[] };
        }
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
        if (sql.includes("COUNT(*) AS n FROM products WHERE"))
          return { n: canned.attrInUseCount ?? 0 } as T;
        // deleteAttribute guard for fitment-referenced kinds (car_models / car_brands): the name
        // lookup, then the fitment count. Match before the broader product_fitments / car_* branches.
        if (sql.includes("COUNT(*) AS n FROM product_fitments WHERE"))
          return { n: canned.fitmentInUseCount ?? 0 } as T;
        if (sql.includes("FROM car_models m")) return (canned.carModelRow ?? null) as T | null;
        if (sql.includes("SELECT name FROM car_brands WHERE"))
          return (canned.carBrandRow ?? null) as T | null;
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
        // The held read is a SUM(quantity_delta) too, so match its movement_type filter FIRST.
        // Held deltas are stored negative, so the raw ledger sum is the negated held count.
        if (sql.includes("movement_type IN ('hold'")) return { net: -(canned.heldNet ?? 0) } as T;
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
        if (sql.includes("FROM barcodes")) {
          // lookupBarcode hides soft-deleted products — model its WHERE p.status <> 'archived'.
          const b = canned.barcode as { status?: string } | null | undefined;
          if (b && /status\s*(<>|!=)\s*'archived'/.test(sql) && b.status === "archived")
            return null as T | null;
          return (canned.barcode ?? null) as T | null;
        }
        if (sql.includes("FROM users WHERE email")) return (canned.userRow ?? null) as T | null;
        if (sql.includes("FROM sales_orders WHERE id = ? AND channel = 'airplus'"))
          return (canned.orderById ?? null) as T | null;
        if (sql.includes("FROM coupons WHERE code"))
          return (canned.couponByCode ?? null) as T | null;
        if (sql.includes("FROM coupon_redemptions WHERE coupon_id"))
          return { n: canned.couponRedemptions ?? 0 } as T;
        if (sql.includes("FROM campaign_prices WHERE campaign_id"))
          return (canned.campaignPriceDup ?? null) as T | null;
        if (sql.includes("FROM product_variants WHERE id"))
          return (canned.variantById ?? null) as T | null;
        if (sql.includes("FROM banners WHERE id")) return (canned.bannerById ?? null) as T | null;
        if (sql.includes("FROM affiliate_items WHERE id"))
          return (canned.affiliateItemById ?? null) as T | null;
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

describe("AirPlus customer directory (storefront_customers)", () => {
  it("given a search > reads the AirPlus account table, not the plate-keyed one", async () => {
    const { db } = makeDb({});
    const prepare = vi.spyOn(db, "prepare");

    await searchStorefrontCustomers(db, "somchai");

    const sql = prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain("FROM storefront_customers");
    // The two businesses stay separate — this list must never reach into Den Air's table.
    expect(sql).not.toMatch(/\bFROM customers\b/);
  });

  it("counts only AirPlus orders, so Shopee rows never inflate the total", async () => {
    const { db } = makeDb({});
    const prepare = vi.spyOn(db, "prepare");

    await searchStorefrontCustomers(db, "");

    const sql = prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain("channel = 'airplus'");
  });

  it("surfaces the signup date and both consent timestamps", async () => {
    const { db } = makeDb({});
    const prepare = vi.spyOn(db, "prepare");

    await searchStorefrontCustomers(db, "");

    const sql = prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain("created_at AS createdAt");
    expect(sql).toContain("pdpa_consent_at AS pdpaConsentAt");
    expect(sql).toContain("marketing_consent_at AS marketingConsentAt");
  });

  it("surfaces the customer code and lets staff search by it", async () => {
    const { db } = makeDb({});
    const prepare = vi.spyOn(db, "prepare");

    await searchStorefrontCustomers(db, "AP-3F7A2C91");

    const sql = prepare.mock.calls[0]?.[0] as string;
    expect(sql).toContain("customer_code AS customerCode");
    // A customer quoting their User ID over LINE must be findable by it.
    expect(sql).toContain("c.customer_code LIKE ?");
  });

  it("detail returns the customer code too, so both apps show the same ID", async () => {
    const { db } = makeDb({});
    const prepare = vi.spyOn(db, "prepare");

    await getStorefrontCustomerDetail(db, "cus_1");

    const sql = prepare.mock.calls.map((c) => c[0] as string).join("\n");
    expect(sql).toContain("customer_code AS customerCode");
  });

  it("detail scopes the purchase history to that customer's AirPlus orders", async () => {
    const { db } = makeDb({});
    const prepare = vi.spyOn(db, "prepare");

    await getStorefrontCustomerDetail(db, "cus_1");

    const sql = prepare.mock.calls.map((c) => c[0] as string).join("\n");
    expect(sql).toContain("storefront_customer_id = ?");
    expect(sql).toContain("channel = 'airplus'");
  });
});

describe("setStorefrontMarketingConsent", () => {
  it("given an opt-in > stamps the consent time", async () => {
    const { db, runs } = makeDb({});

    await setStorefrontMarketingConsent(db, "cus_1", true, 1_700_000_000_000);

    expect(runs[0]?.sql).toContain("marketing_consent_at");
    expect(runs[0]?.binds).toContain(1_700_000_000_000);
  });

  it("given a withdrawal > clears the timestamp rather than recording a false", async () => {
    const { db, runs } = makeDb({});

    await setStorefrontMarketingConsent(db, "cus_1", false, 1_700_000_000_000);

    // NULL is what "no consent on record" means everywhere else in this table.
    expect(runs[0]?.binds[0]).toBeNull();
  });

  it("never re-consents an erased account", async () => {
    const { db, runs } = makeDb({});

    await setStorefrontMarketingConsent(db, "cus_1", true, 1_700_000_000_000);

    expect(runs[0]?.sql).toContain("anonymized_at IS NULL");
  });
});

describe("anonymizeStorefrontCustomerInDb (PDPA erasure)", () => {
  it("given an erasure request > blanks the account but never touches the order rows", async () => {
    const { db, runs, batched } = makeDb({});

    await anonymizeStorefrontCustomerInDb(db, "cus_1", 1_700_000_000_000);

    const sql = [...runs, ...batched].map((s) => s.sql).join("\n");
    expect(sql).toContain("UPDATE storefront_customers");
    // Orders are tax records we must retain (Privacy Notice §5) — erasure must never reach them.
    expect(sql).not.toContain("sales_orders");
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
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

describe("normalizeWarrantyDays (per-category warranty window)", () => {
  it("keeps a positive whole number of days", () => {
    expect(normalizeWarrantyDays(365)).toBe(365);
    expect(normalizeWarrantyDays("180")).toBe(180);
    expect(normalizeWarrantyDays(7.6)).toBe(8); // rounds
  });
  it("collapses 0, negatives, blank, and junk to null (never a '0 วัน' warranty)", () => {
    expect(normalizeWarrantyDays(0)).toBeNull();
    expect(normalizeWarrantyDays(-5)).toBeNull();
    expect(normalizeWarrantyDays("")).toBeNull();
    expect(normalizeWarrantyDays(null)).toBeNull();
    expect(normalizeWarrantyDays(undefined)).toBeNull();
    expect(normalizeWarrantyDays("abc")).toBeNull();
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

describe("AirPlus merchandising admin routes (banners / coupons / campaigns / affiliate)", () => {
  /** R2 double for the image upload/delete routes. */
  function fakeBucket() {
    const puts: { key: string }[] = [];
    const deletes: string[] = [];
    const bucket = {
      put: async (key: string) => void puts.push({ key }),
      delete: async (key: string) => void deletes.push(key),
    } as unknown as R2Bucket;
    return { bucket, puts, deletes };
  }
  const png = () => new Uint8Array([137, 80, 78, 71]).buffer;

  describe("banners", () => {
    it("GET /banners > lists every banner in the admin's shape", async () => {
      const banner = {
        id: "b1",
        slot: "hero",
        imageKey: "banners/b1-x.png",
        linkUrl: null,
        sortOrder: 0,
        startsAt: null,
        endsAt: null,
        status: "active",
        createdAt: 1,
      };
      const { env } = makeDb({ banners: [banner] });
      const res = await worker.fetch!(new Request("https://x/banners"), env, ctx);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ banners: [banner] });
    });

    it("POST /banners > creates a banner and returns its id", async () => {
      const { env, runs } = makeDb({});
      const res = await worker.fetch!(
        new Request("https://x/banners", {
          method: "POST",
          body: JSON.stringify({ slot: "promo", linkUrl: "/collections/all", sortOrder: 2 }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(201);
      expect((await res.json()) as { id: string }).toHaveProperty("id");
      const insert = runs.find((r) => r.sql.includes("INSERT INTO banners"));
      expect(insert?.binds).toContain("promo");
      expect(insert?.binds).toContain("/collections/all");
    });

    it("POST /banners > 400 for a slot outside hero|promo (the CHECK would reject it)", async () => {
      const { env } = makeDb({});
      const res = await worker.fetch!(
        new Request("https://x/banners", { method: "POST", body: JSON.stringify({ slot: "top" }) }),
        env,
        ctx,
      );
      expect(res.status).toBe(400);
    });

    it("PATCH /banners/:id > updates only the supplied fields", async () => {
      const { env, runs } = makeDb({});
      const res = await worker.fetch!(
        new Request("https://x/banners/b1", {
          method: "PATCH",
          body: JSON.stringify({ status: "disabled" }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(200);
      const update = runs.find((r) => r.sql.includes("UPDATE banners SET"));
      expect(update?.sql).toContain("status = ?");
      expect(update?.sql).not.toContain("slot = ?");
    });

    it("POST /banners/:id/image > stores the image under banners/ and returns key + url", async () => {
      const { db } = makeDb({ bannerById: { id: "b1", imageKey: null } });
      const { bucket, puts } = fakeBucket();
      const res = await worker.fetch!(
        new Request("https://x/banners/b1/image", {
          method: "POST",
          headers: { "content-type": "image/png" },
          body: png(),
        }),
        { DB: db, IMAGES: bucket } as unknown as Env,
        ctx,
      );
      expect(res.status).toBe(201);
      const out = (await res.json()) as { key: string; url: string };
      expect(out.key).toMatch(/^banners\/b1-.*\.png$/);
      expect(out.url).toBe(`/img/${out.key}`);
      expect(puts.length).toBe(1);
    });

    it("POST /banners/:id/image > 404 for an unknown banner, 400 for a bad image", async () => {
      const { bucket } = fakeBucket();
      const missing = await worker.fetch!(
        new Request("https://x/banners/nope/image", {
          method: "POST",
          headers: { "content-type": "image/png" },
          body: png(),
        }),
        { DB: makeDb({ bannerById: null }).db, IMAGES: bucket } as unknown as Env,
        ctx,
      );
      expect(missing.status).toBe(404);
      const badType = await worker.fetch!(
        new Request("https://x/banners/b1/image", {
          method: "POST",
          headers: { "content-type": "image/gif" },
          body: png(),
        }),
        {
          DB: makeDb({ bannerById: { id: "b1", imageKey: null } }).db,
          IMAGES: bucket,
        } as unknown as Env,
        ctx,
      );
      expect(badType.status).toBe(400);
    });

    it("DELETE /banners/:id > removes the row and its R2 image", async () => {
      const { db, runs } = makeDb({ bannerById: { id: "b1", imageKey: "banners/b1-x.png" } });
      const { bucket, deletes } = fakeBucket();
      const res = await worker.fetch!(
        new Request("https://x/banners/b1", { method: "DELETE" }),
        { DB: db, IMAGES: bucket } as unknown as Env,
        ctx,
      );
      expect(res.status).toBe(200);
      expect(runs.some((r) => r.sql.includes("DELETE FROM banners"))).toBe(true);
      expect(deletes).toEqual(["banners/b1-x.png"]);
    });
  });

  describe("coupons", () => {
    it("GET /coupons > lists coupons with their redemption counts", async () => {
      const coupon = {
        id: "c1",
        code: "SAVE10",
        name: "Save 10",
        type: "percent",
        value: 1000,
        redemptions: 3,
      };
      const { env } = makeDb({ coupons: [coupon] });
      const res = await worker.fetch!(new Request("https://x/coupons"), env, ctx);
      expect(res.status).toBe(200);
      // The admin list must carry the coupon `name` (migration 0065) back to the table.
      const body = (await res.json()) as { coupons: { name?: string }[] };
      expect(body).toEqual({ coupons: [coupon] });
      expect(body.coupons[0]!.name).toBe("Save 10");
    });

    it("POST /coupons > trims + uppercases the code before storing it", async () => {
      const { env, runs } = makeDb({ couponByCode: null });
      const res = await worker.fetch!(
        new Request("https://x/coupons", {
          method: "POST",
          body: JSON.stringify({
            code: "  save10 ",
            name: "Save 10",
            type: "percent",
            value: 1000,
          }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(201);
      const insert = runs.find((r) => r.sql.includes("INSERT INTO coupons"));
      expect(insert?.binds).toContain("SAVE10");
      expect(insert?.binds).not.toContain("  save10 ");
    });

    it("POST /coupons > 409 when the (normalized) code already exists", async () => {
      const { env } = makeDb({ couponByCode: { id: "existing" } });
      const res = await worker.fetch!(
        new Request("https://x/coupons", {
          method: "POST",
          body: JSON.stringify({ code: "save10", name: "Save 10", type: "percent", value: 1000 }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(409);
      expect((await res.json()) as { error: string }).toHaveProperty("error");
    });

    it("POST /coupons > 400 for a missing code, bad type, or non-positive value", async () => {
      const bad = async (body: unknown) =>
        (
          await worker.fetch!(
            new Request("https://x/coupons", { method: "POST", body: JSON.stringify(body) }),
            makeDb({}).env,
            ctx,
          )
        ).status;
      expect(await bad({ name: "N", type: "percent", value: 1000 })).toBe(400); // no code
      // name present so these reach the type/value guards (not short-circuited by the name check).
      expect(await bad({ code: "X", name: "N", type: "bogus", value: 1000 })).toBe(400);
      expect(await bad({ code: "X", name: "N", type: "fixed", value: 0 })).toBe(400);
    });

    it("POST /coupons > stores the admin name", async () => {
      const { env, runs } = makeDb({ couponByCode: null });
      const res = await worker.fetch!(
        new Request("https://x/coupons", {
          method: "POST",
          body: JSON.stringify({
            code: "SAVE10",
            name: "Songkran promo",
            type: "percent",
            value: 1000,
          }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(201);
      const insert = runs.find((r) => r.sql.includes("INSERT INTO coupons"));
      expect(insert?.binds).toContain("Songkran promo");
    });

    it("POST /coupons > 400 when the name is missing or blank", async () => {
      const bad = async (body: unknown) =>
        (
          await worker.fetch!(
            new Request("https://x/coupons", { method: "POST", body: JSON.stringify(body) }),
            makeDb({ couponByCode: null }).env,
            ctx,
          )
        ).status;
      expect(await bad({ code: "X", type: "fixed", value: 100 })).toBe(400); // no name
      expect(await bad({ code: "X", name: "   ", type: "fixed", value: 100 })).toBe(400); // blank
    });

    it("PATCH /coupons/:id > updates the admin name (trimmed)", async () => {
      const { env, runs } = makeDb({ couponByCode: null });
      const res = await worker.fetch!(
        new Request("https://x/coupons/c1", {
          method: "PATCH",
          body: JSON.stringify({ name: "  Renamed Promo  " }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(200);
      const update = runs.find((r) => r.sql.includes("UPDATE coupons SET"));
      expect(update?.sql).toContain("name = ?");
      expect(update?.binds).toContain("Renamed Promo");
    });

    it("PATCH /coupons/:id > 400 for a blank name", async () => {
      const { env } = makeDb({ couponByCode: null });
      const res = await worker.fetch!(
        new Request("https://x/coupons/c1", {
          method: "PATCH",
          body: JSON.stringify({ name: "   " }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(400);
    });

    it("PATCH /coupons/:id > uppercases a new code", async () => {
      const { env, runs } = makeDb({ couponByCode: null });
      const res = await worker.fetch!(
        new Request("https://x/coupons/c1", {
          method: "PATCH",
          body: JSON.stringify({ code: " summer " }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(200);
      const update = runs.find((r) => r.sql.includes("UPDATE coupons SET"));
      expect(update?.binds).toContain("SUMMER");
    });

    it("PATCH /coupons/:id > 409 when the new code belongs to another coupon", async () => {
      const { env, runs } = makeDb({ couponByCode: { id: "other" } });
      const res = await worker.fetch!(
        new Request("https://x/coupons/c1", {
          method: "PATCH",
          body: JSON.stringify({ code: "SUMMER" }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(409);
      expect(runs.some((r) => r.sql.includes("UPDATE coupons SET"))).toBe(false);
    });

    it("DELETE /coupons/:id > deletes a coupon that was never redeemed", async () => {
      const { env, runs } = makeDb({ couponRedemptions: 0 });
      const res = await worker.fetch!(
        new Request("https://x/coupons/c1", { method: "DELETE" }),
        env,
        ctx,
      );
      expect(res.status).toBe(200);
      expect(runs.some((r) => r.sql.includes("DELETE FROM coupons"))).toBe(true);
    });

    it("DELETE /coupons/:id > 409 once redeemed — financial history is never deleted", async () => {
      const { env, runs } = makeDb({ couponRedemptions: 2 });
      const res = await worker.fetch!(
        new Request("https://x/coupons/c1", { method: "DELETE" }),
        env,
        ctx,
      );
      expect(res.status).toBe(409); // the admin client special-cases 409 → "disable it instead"
      expect((await res.json()) as { error: string }).toHaveProperty("error");
      expect(runs.some((r) => r.sql.includes("DELETE FROM coupons"))).toBe(false);
    });
  });

  describe("campaigns", () => {
    it("GET /campaigns > lists campaigns with their prices nested", async () => {
      const { env } = makeDb({
        campaigns: [{ id: "k1", name: "7.7", startsAt: 1, endsAt: 2, status: "active" }],
        campaignPrices: [{ id: "p1", campaignId: "k1", productVariantId: "v1", soldCount: 0 }],
      });
      const res = await worker.fetch!(new Request("https://x/campaigns"), env, ctx);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { campaigns: { id: string; prices: unknown[] }[] };
      expect(body.campaigns[0]!.id).toBe("k1");
      expect(body.campaigns[0]!.prices).toHaveLength(1);
    });

    it("POST /campaigns > creates a campaign shell and returns its id", async () => {
      const { env, runs } = makeDb({});
      const res = await worker.fetch!(
        new Request("https://x/campaigns", {
          method: "POST",
          body: JSON.stringify({ name: " 7.7 Flash ", startsAt: 1000, endsAt: 2000 }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(201);
      expect((await res.json()) as { id: string }).toHaveProperty("id");
      const insert = runs.find((r) => r.sql.includes("INSERT INTO campaigns"));
      expect(insert?.binds).toContain("7.7 Flash");
    });

    it("POST /campaigns > 400 without a name or a valid window", async () => {
      const bad = async (body: unknown) =>
        (
          await worker.fetch!(
            new Request("https://x/campaigns", { method: "POST", body: JSON.stringify(body) }),
            makeDb({}).env,
            ctx,
          )
        ).status;
      expect(await bad({ startsAt: 1, endsAt: 2 })).toBe(400);
      expect(await bad({ name: "x", startsAt: 1 })).toBe(400);
      expect(await bad({ name: "x", startsAt: 2, endsAt: 1 })).toBe(400);
    });

    it("PATCH /campaigns/:id > updates only the supplied fields", async () => {
      const { env, runs } = makeDb({});
      const res = await worker.fetch!(
        new Request("https://x/campaigns/k1", {
          method: "PATCH",
          body: JSON.stringify({ status: "disabled" }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(200);
      expect(runs.find((r) => r.sql.includes("UPDATE campaigns SET"))?.sql).toContain("status = ?");
    });

    it("DELETE /campaigns/:id > removes the campaign and its prices", async () => {
      const { env, batched } = makeDb({});
      const res = await worker.fetch!(
        new Request("https://x/campaigns/k1", { method: "DELETE" }),
        env,
        ctx,
      );
      expect(res.status).toBe(200);
      expect(batched.some((s) => s.sql.includes("DELETE FROM campaign_prices"))).toBe(true);
      expect(batched.some((s) => s.sql.includes("DELETE FROM campaigns"))).toBe(true);
    });

    it("POST /campaigns/:id/prices > attaches a variant at a flash price", async () => {
      const { env, runs } = makeDb({ variantById: { id: "v1" }, campaignPriceDup: null });
      const res = await worker.fetch!(
        new Request("https://x/campaigns/k1/prices", {
          method: "POST",
          body: JSON.stringify({ productVariantId: "v1", campaignPriceSatang: 9900, stockCap: 10 }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(201);
      expect((await res.json()) as { id: string }).toHaveProperty("id");
      const insert = runs.find((r) => r.sql.includes("INSERT INTO campaign_prices"));
      expect(insert?.binds).toContain(9900);
    });

    it("POST /campaigns/:id/prices > 404 unknown variant, 409 duplicate, 400 bad price", async () => {
      const post = async (canned: Parameters<typeof makeDb>[0], body: unknown): Promise<number> =>
        (
          await worker.fetch!(
            new Request("https://x/campaigns/k1/prices", {
              method: "POST",
              body: JSON.stringify(body),
            }),
            makeDb(canned).env,
            ctx,
          )
        ).status;
      expect(
        await post({ variantById: null }, { productVariantId: "v9", campaignPriceSatang: 1 }),
      ).toBe(404);
      expect(
        await post(
          { variantById: { id: "v1" }, campaignPriceDup: { id: "cp1" } },
          { productVariantId: "v1", campaignPriceSatang: 1 },
        ),
      ).toBe(409);
      expect(
        await post(
          { variantById: { id: "v1" } },
          { productVariantId: "v1", campaignPriceSatang: 0 },
        ),
      ).toBe(400);
    });

    it("DELETE /campaigns/:campaignId/prices/:priceId > detaches one product, not the campaign", async () => {
      const { env, runs } = makeDb({});
      const res = await worker.fetch!(
        new Request("https://x/campaigns/k1/prices/p1", { method: "DELETE" }),
        env,
        ctx,
      );
      expect(res.status).toBe(200);
      // Must not be swallowed by DELETE /campaigns/:id — the campaign itself has to survive.
      const deletes = runs.filter((r) => r.sql.includes("DELETE FROM"));
      expect(deletes.some((r) => r.sql.includes("DELETE FROM campaign_prices"))).toBe(true);
      expect(deletes.some((r) => /DELETE FROM campaigns\b/.test(r.sql))).toBe(false);
    });

    it("GET /variant-search > returns picker rows, not the products list", async () => {
      const hit = {
        variantId: "v1",
        productId: "p1",
        name: "คอมแอร์",
        productRef: "AC-1",
        onlinePriceSatang: 250000,
      };
      const { env } = makeDb({ variantMatches: [hit], products: [{ id: "WRONG" }] });
      const res = await worker.fetch!(new Request("https://x/variant-search?q=แอร์"), env, ctx);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ variants: [hit] });
    });
  });

  describe("affiliate items", () => {
    it("GET /affiliate-items > lists cards with their click counts", async () => {
      const item = { id: "a1", title: "ปั๊มสูญญากาศ", source: "shopee", clicks: 7 };
      const { env } = makeDb({ affiliateItems: [item] });
      const res = await worker.fetch!(new Request("https://x/affiliate-items"), env, ctx);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ items: [item] });
    });

    it("POST /affiliate-items > creates a card and returns its id", async () => {
      const { env, runs } = makeDb({});
      const res = await worker.fetch!(
        new Request("https://x/affiliate-items", {
          method: "POST",
          body: JSON.stringify({
            title: " ปั๊ม ",
            targetUrl: "https://shopee.co.th/x",
            source: "shopee",
            priceText: "฿1,290",
          }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(201);
      expect((await res.json()) as { id: string }).toHaveProperty("id");
      const insert = runs.find((r) => r.sql.includes("INSERT INTO affiliate_items"));
      expect(insert?.binds).toContain("ปั๊ม");
      expect(insert?.binds).toContain("shopee");
    });

    it("POST /affiliate-items > 400 for a missing title, non-https target, or unknown source", async () => {
      const bad = async (body: unknown) =>
        (
          await worker.fetch!(
            new Request("https://x/affiliate-items", {
              method: "POST",
              body: JSON.stringify(body),
            }),
            makeDb({}).env,
            ctx,
          )
        ).status;
      expect(await bad({ targetUrl: "https://shopee.co.th/x" })).toBe(400);
      expect(await bad({ title: "x", targetUrl: "http://shopee.co.th/x" })).toBe(400);
      expect(await bad({ title: "x", targetUrl: "javascript:alert(1)" })).toBe(400);
      expect(await bad({ title: "x", targetUrl: "https://a.co/x", source: "amazon" })).toBe(400);
    });

    it("PATCH /affiliate-items/:id > updates only the supplied fields", async () => {
      const { env, runs } = makeDb({});
      const res = await worker.fetch!(
        new Request("https://x/affiliate-items/a1", {
          method: "PATCH",
          body: JSON.stringify({ sortOrder: 3 }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(200);
      expect(runs.find((r) => r.sql.includes("UPDATE affiliate_items SET"))?.sql).toContain(
        "sort_order = ?",
      );
    });

    it("PATCH /affiliate-items/:id > 400 for a non-https target", async () => {
      const { env } = makeDb({});
      const res = await worker.fetch!(
        new Request("https://x/affiliate-items/a1", {
          method: "PATCH",
          body: JSON.stringify({ targetUrl: "http://shopee.co.th/x" }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(400);
    });

    it("POST /affiliate-items/:id/image > stores the image under affiliate/", async () => {
      const { db } = makeDb({ affiliateItemById: { id: "a1", imageKey: null } });
      const { bucket, puts } = fakeBucket();
      const res = await worker.fetch!(
        new Request("https://x/affiliate-items/a1/image", {
          method: "POST",
          headers: { "content-type": "image/png" },
          body: png(),
        }),
        { DB: db, IMAGES: bucket } as unknown as Env,
        ctx,
      );
      expect(res.status).toBe(201);
      const out = (await res.json()) as { key: string; url: string };
      expect(out.key).toMatch(/^affiliate\/a1-.*\.png$/);
      expect(puts.length).toBe(1);
    });

    it("PATCH > 400 for any value a column's CHECK would refuse (never a D1 500)", async () => {
      const patch = async (path: string, body: unknown) =>
        (
          await worker.fetch!(
            new Request(`https://x${path}`, { method: "PATCH", body: JSON.stringify(body) }),
            makeDb({}).env,
            ctx,
          )
        ).status;
      expect(await patch("/banners/b1", { slot: "top" })).toBe(400);
      expect(await patch("/banners/b1", { status: "paused" })).toBe(400);
      expect(await patch("/coupons/c1", { type: "bogus" })).toBe(400);
      expect(await patch("/coupons/c1", { value: 0 })).toBe(400);
      expect(await patch("/coupons/c1", { status: "paused" })).toBe(400);
      expect(await patch("/campaigns/k1", { status: "paused" })).toBe(400);
      expect(await patch("/affiliate-items/a1", { source: "amazon" })).toBe(400);
      expect(await patch("/affiliate-items/a1", { status: "paused" })).toBe(400);
    });

    it("DELETE /affiliate-items/:id > removes clicks, the row, and its R2 image", async () => {
      const { db, batched } = makeDb({
        affiliateItemById: { id: "a1", imageKey: "affiliate/a1-x.png" },
      });
      const { bucket, deletes } = fakeBucket();
      const res = await worker.fetch!(
        new Request("https://x/affiliate-items/a1", { method: "DELETE" }),
        { DB: db, IMAGES: bucket } as unknown as Env,
        ctx,
      );
      expect(res.status).toBe(200);
      expect(batched.some((s) => s.sql.includes("DELETE FROM affiliate_clicks"))).toBe(true);
      expect(batched.some((s) => s.sql.includes("DELETE FROM affiliate_items"))).toBe(true);
      expect(deletes).toEqual(["affiliate/a1-x.png"]);
    });
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

  it("GET /products > omits archived (soft-deleted) products from the catalog list", async () => {
    // Delete is a soft-delete (status='archived'). The deleted product must not linger in the list
    // (nor the POS picker / barcodes page, which read the same GET /products).
    const live = { id: "p1", productRef: "A-1", name: "Live part", status: "active" };
    const deleted = { id: "p9", productRef: "OLD-1", name: "Deleted part", status: "archived" };
    const { env } = makeDb({ products: [live, deleted] });
    const res = await worker.fetch!(new Request("https://x/products"), env, ctx);
    const body = (await res.json()) as { products: { id: string }[] };
    expect(body.products.map((p) => p.id)).toEqual(["p1"]);
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

  it("POST /onsite/drafts > persists the bill discount on a quotation (amount + raw %/฿, recomputed grand)", async () => {
    const { env, batched } = makeDb({});
    const res = await worker.fetch!(
      new Request("https://x/onsite/drafts", {
        method: "POST",
        body: JSON.stringify({
          draftId: "q1",
          stage: "quotation",
          saleNumber: "QT202607-26001",
          lines: [{ quantity: 1, unitPriceSatang: 15000, productVariantId: "v1" }],
          discountSatang: 5000,
          discountKind: "pct",
          discountValue: "33.33",
        }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const insert = (batched as { sql: string; boundArgs?: unknown[] }[]).find((s) =>
      s.sql.includes("INTO onsite_sales"),
    );
    expect(insert?.sql).toContain("discount_kind");
    const binds = insert?.boundArgs ?? [];
    expect(binds).toContain(5000); // discount_total_satang (the bill discount)
    expect(binds).toContain(10000); // grand_total_satang = 15000 − 5000
    expect(binds).toContain("pct"); // raw kind preserved
    expect(binds).toContain("33.33"); // raw value preserved
  });

  it("POST /onsite/drafts > refuses to overwrite a finalized bill (no header/line corruption)", async () => {
    // A bill id fed back into the draft-save path must not reopen the bill as an editable draft:
    // its header (stage/totals) must not be flipped and its lines must not be stripped/replaced.
    const { env, batched } = makeDb({ saleHeader: { stage: "bill" } });
    const res = await worker.fetch!(
      new Request("https://x/onsite/drafts", {
        method: "POST",
        body: JSON.stringify({
          draftId: "bill-1",
          stage: "draft",
          lines: [{ quantity: 1, unitPriceSatang: 15000, description: "compressor" }],
        }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(400);
    // nothing destructive may run against the existing bill
    expect(batched.some((s) => s.sql.includes("INTO onsite_sales"))).toBe(false);
    expect(batched.some((s) => s.sql.includes("DELETE FROM onsite_sale_lines"))).toBe(false);
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

  it("DELETE /onsite/drafts/:id > the line delete is stage-scoped too, so a bill can't be gutted", async () => {
    const { db, env } = makeDb({});
    const prepare = vi.spyOn(db, "prepare");
    // A bill id is a normal onsite_sales.id; the route does no stage pre-check. The header delete is
    // fenced by stage, so the LINE delete must be fenced the same way — otherwise passing a finalized
    // bill's id strips its items while the guarded header survives, leaving a corrupt, itemless bill.
    const res = await worker.fetch!(
      new Request("https://x/onsite/drafts/s1", { method: "DELETE" }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    const sqls = prepare.mock.calls.map((c) => c[0] as string);
    expect(sqls.find((s) => s.includes("DELETE FROM onsite_sale_lines"))).toContain(
      "IN ('draft', 'quotation')",
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

  // The ledger CHECK (migration 0026) rejects any type outside its vocabulary. Reaching D1 with a
  // bad type costs a round-trip and surfaces as an opaque 500; the endpoint answers 400 itself.
  it("POST /stock/adjust > given a movementType outside the ledger vocabulary > 400", async () => {
    const env = {
      STOCK_LEDGER: {
        idFromName: (_n: string) => ({}),
        get: (_id: unknown) => ({
          applyAdjustment: async () => {
            throw new Error("D1: CHECK constraint failed: movement_type");
          },
        }),
      },
    } as unknown as Env;
    const res = await worker.fetch!(
      new Request("https://x/stock/adjust", {
        method: "POST",
        body: JSON.stringify({
          productVariantId: "v1",
          quantityDelta: 5,
          movementType: "hold_out",
        }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/movementType/);
  });

  it("POST /stock/adjust > accepts every manual movement type the admin sends", async () => {
    const seen: string[] = [];
    const env = {
      STOCK_LEDGER: {
        idFromName: (_n: string) => ({}),
        get: (_id: unknown) => ({
          applyAdjustment: async (a: { movementType: string }) => {
            seen.push(a.movementType);
            return { variantId: "v1", quantityAfter: 1, applied: true };
          },
        }),
      },
    } as unknown as Env;
    // opening_balance is what Add-product sends for a new product's starting stock.
    const types = ["receive", "write_off", "correction", "manual_adjustment", "opening_balance"];
    for (const movementType of types) {
      const res = await worker.fetch!(
        new Request("https://x/stock/adjust", {
          method: "POST",
          body: JSON.stringify({ productVariantId: "v1", quantityDelta: 1, movementType }),
        }),
        env,
        ctx,
      );
      expect(res.status).toBe(200);
    }
    expect(seen).toEqual(types);
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

  function kvEnv() {
    const store = new Map<string, string>();
    const env = {
      KV: {
        get: async (k: string) => store.get(k) ?? null,
        put: async (k: string, v: string) => void store.set(k, v),
      },
    } as unknown as Env;
    return { store, env };
  }

  it("shop-info round-trips paymentMethods per profile (the Payment page dropdown needs it)", async () => {
    const { store, env } = kvEnv();
    const methods = JSON.stringify([
      { id: "a", label: "ร้าน", promptpayId: "0812345678", isDefault: true },
      { id: "b", label: "แม่", promptpayId: "1234567890123" },
    ]);
    await worker.fetch!(
      new Request("https://x/shop-info/denair", {
        method: "PUT",
        body: JSON.stringify({ name: "ร้าน", paymentMethods: methods }),
      }),
      env,
      ctx,
    );
    expect(store.get("shop:denair:paymentMethods")).toBe(methods);
    const res = await worker.fetch!(new Request("https://x/shop-info/denair"), env, ctx);
    const body = (await res.json()) as Record<string, string | null>;
    expect(body.paymentMethods).toBe(methods);
    expect(body.profile).toBe("denair");
  });

  it("shop-info keeps the two businesses' bank accounts apart", async () => {
    // The reason this split exists: Den Air Service and AirPlus take money into different accounts.
    // Writing one must never be readable as the other.
    const { env } = kvEnv();
    const denair = JSON.stringify([{ id: "d", label: "หน้าร้าน", promptpayId: "0811111111" }]);
    const airplus = JSON.stringify([{ id: "a", label: "ออนไลน์", promptpayId: "0822222222" }]);
    for (const [profile, methods] of [
      ["denair", denair],
      ["airplus", airplus],
    ]) {
      await worker.fetch!(
        new Request(`https://x/shop-info/${profile}`, {
          method: "PUT",
          body: JSON.stringify({ paymentMethods: methods }),
        }),
        env,
        ctx,
      );
    }
    const d = (await (
      await worker.fetch!(new Request("https://x/shop-info/denair"), env, ctx)
    ).json()) as Record<string, string>;
    const a = (await (
      await worker.fetch!(new Request("https://x/shop-info/airplus"), env, ctx)
    ).json()) as Record<string, string>;
    expect(d.paymentMethods).toBe(denair);
    expect(a.paymentMethods).toBe(airplus);
    expect(d.paymentMethods).not.toBe(a.paymentMethods);
  });

  it("shop-info 404s an unknown profile instead of defaulting to one", async () => {
    // Defaulting would write one shop's settings into the other's namespace.
    const { env } = kvEnv();
    const res = await worker.fetch!(new Request("https://x/shop-info/shopee"), env, ctx);
    expect(res.status).toBe(404);
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

  it("GET /img/:key > serves EVERY namespace the app writes to (banners + affiliate were blocked)", async () => {
    // Regression: banner and affiliate images are written under banners/ and affiliate/, and a
    // comment in this file claimed the allowlist admitted them — it did not. Every uploaded banner
    // and affiliate tile 404'd on the storefront while sitting perfectly fine in R2.
    const env = {
      IMAGES: {
        get: async () => ({ body: "PNG", httpMetadata: { contentType: "image/png" } }),
      },
    } as unknown as Env;
    for (const key of [
      "products/p1/a.png",
      "shop/denair-logo-1.png",
      "taxonomy/type-x-1.png",
      "banners/b1-abc.png",
      "affiliate/a1-abc.png",
    ]) {
      const res = await worker.fetch!(new Request(`https://x/img/${key}`), env, ctx);
      expect(res.status, `${key} should be served`).toBe(200);
    }
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

  it("GET /products/by-barcode/:code > 404 for a soft-deleted product — a deleted part is not sellable via scan", async () => {
    const archived = {
      barcode: "885",
      variantId: "v9",
      productId: "p9",
      productRef: "OLD-1",
      name: "Deleted part",
      status: "archived",
    };
    const { env } = makeDb({ barcode: archived });
    const res = await worker.fetch!(new Request("https://x/products/by-barcode/885"), env, ctx);
    expect(res.status).toBe(404);
  });

  it("GET /stock > omits variants of archived (soft-deleted) products", async () => {
    const live = {
      variantId: "v1",
      sku: null,
      productName: "Live",
      productRef: "A-1",
      onHand: 5,
      status: "active",
    };
    const dead = {
      variantId: "v9",
      sku: null,
      productName: "Deleted",
      productRef: "OLD-1",
      onHand: 3,
      status: "archived",
    };
    const { env } = makeDb({ stock: [live, dead] });
    const res = await worker.fetch!(new Request("https://x/stock"), env, ctx);
    const body = (await res.json()) as { stock: { variantId: string }[] };
    expect(body.stock.map((s) => s.variantId)).toEqual(["v1"]);
  });

  it("GET /stock/movements > omits movements of archived (soft-deleted) products", async () => {
    const live = {
      id: "m1",
      variantId: "v1",
      sku: null,
      productName: "Live",
      movementType: "receive",
      quantityDelta: 5,
      quantityAfter: 5,
      createdAt: 1,
      status: "active",
    };
    const dead = {
      id: "m9",
      variantId: "v9",
      sku: null,
      productName: "Deleted",
      movementType: "receive",
      quantityDelta: 3,
      quantityAfter: 3,
      createdAt: 2,
      status: "archived",
    };
    const { env } = makeDb({ movements: [live, dead] });
    const res = await worker.fetch!(new Request("https://x/stock/movements"), env, ctx);
    const body = (await res.json()) as { movements: { id: string }[] };
    expect(body.movements.map((m) => m.id)).toEqual(["m1"]);
  });

  it("POST /products/full > writes product + pricing + fitments in ONE atomic batch", async () => {
    const { db, env } = makeDb({ existingProduct: null });
    const batchSpy = vi.spyOn(db, "batch");
    const res = await worker.fetch!(
      new Request("https://x/products/full", {
        method: "POST",
        body: JSON.stringify({
          productRef: "TG-1",
          name: "Evaporator",
          status: "draft",
          description: "cold coil",
          brandName: "DENSO",
          usageName: "A/C",
          typeName: "Evaporator",
          weightGrams: 1500,
          widthMm: 600,
          lengthMm: 600,
          heightMm: 200,
          barcode: "TG-1",
          fitments: [{ carBrand: "Toyota", carModel: "Vigo", yearFrom: null, yearTo: null }],
          pricing: {
            itemCostSatang: 5000,
            targetPriceSatang: 9000,
            onlinePriceSatang: 10000,
            b2bPriceSatang: 8000,
            onlineCommissionBp: 1000,
            taxOnCost: false,
          },
        }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(201);
    expect((await res.json()) as { created: boolean }).toMatchObject({ created: true });
    // Atomicity: the product row, its pricing and its fitments are all in the SAME db.batch, so a
    // failure rolls the whole thing back — no half-saved skeleton.
    const atomic = batchSpy.mock.calls
      .map((c) => c[0] as unknown as { sql: string }[])
      .find((stmts) => stmts.some((s) => s.sql.includes("INSERT INTO products")));
    expect(atomic, "product write must go through a batch").toBeTruthy();
    const sqls = atomic!.map((s) => s.sql);
    expect(sqls.some((s) => s.includes("INSERT INTO pricing_profiles"))).toBe(true);
    expect(sqls.some((s) => s.includes("INSERT INTO product_fitments"))).toBe(true);
  });

  it("POST /products/full > recovers an existing Product ID (updates in place, no duplicate)", async () => {
    const { db, env } = makeDb({
      existingProduct: { id: "p-existing" },
      variantRow: { id: "v-existing" },
    });
    const batchSpy = vi.spyOn(db, "batch");
    const res = await worker.fetch!(
      new Request("https://x/products/full", {
        method: "POST",
        body: JSON.stringify({ productRef: "TG-1", name: "Evaporator", status: "draft" }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as { productId: string; created: boolean }).toMatchObject({
      productId: "p-existing",
      created: false,
    });
    const sqls = batchSpy.mock.calls
      .flatMap((c) => c[0] as unknown as { sql: string }[])
      .map((s) => s.sql);
    expect(sqls.some((s) => s.includes("INSERT INTO products"))).toBe(false); // no duplicate row
    expect(sqls.some((s) => s.includes("UPDATE products SET"))).toBe(true); // filled in via update
  });

  it("POST /products/full with id > updates that row by id (edit; allows renaming the Product ID)", async () => {
    const { db, env } = makeDb({ variantRow: { id: "v1" } });
    const batchSpy = vi.spyOn(db, "batch");
    const res = await worker.fetch!(
      new Request("https://x/products/full", {
        method: "POST",
        body: JSON.stringify({
          id: "p1",
          productRef: "NEW-REF",
          name: "Renamed",
          status: "active",
        }),
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    expect((await res.json()) as { productId: string; created: boolean }).toMatchObject({
      productId: "p1",
      created: false,
    });
    const sqls = batchSpy.mock.calls
      .flatMap((c) => c[0] as unknown as { sql: string }[])
      .map((s) => s.sql);
    expect(sqls.some((s) => s.includes("INSERT INTO products"))).toBe(false); // edits, never inserts
    expect(sqls.some((s) => s.includes("UPDATE products SET"))).toBe(true);
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

describe("customer_code backfill vs generateCustomerCode", () => {
  // The migration backfills existing accounts in SQL while new accounts get their code from core.
  // If the two ever disagree on shape, half the customers carry a User ID that fails validation —
  // and nothing else in the suite would notice. This makes that drift a failing build.
  it("the SQL backfill produces the same shape the generator does", () => {
    const sql = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../packages/db/migrations/0059_storefront_customer_code.sql",
      ),
      "utf8",
    );
    const backfill = /SET customer_code = '([^']+)' \|\| hex\(randomblob\((\d+)\)\)/.exec(sql);

    expect(backfill, "backfill expression not found — did the migration change?").not.toBeNull();
    const [, prefix, bytes] = backfill!;
    // hex() of N bytes is 2N uppercase hex chars, so the shapes must line up with core's output.
    const generated = generateCustomerCode();
    expect(prefix).toBe(CUSTOMER_CODE_PREFIX);
    expect(prefix!.length + Number(bytes) * 2).toBe(generated.length);
    expect(isCustomerCode(`${prefix}${"A".repeat(Number(bytes) * 2)}`)).toBe(true);
  });
});

describe("BACKUP_TABLES vs the migrations", () => {
  // The MIGRATIONS are the schema's source of truth — packages/db/src/schema.ts says DRAFT in its
  // own header, omits live tables, and nothing imports it. A table added by a migration but never
  // added here drops out of the daily dump silently, which is exactly how 2026-07's storefront
  // tables went unbacked-up; this test makes that drift a failing build instead.
  const migrationsDir = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../packages/db/migrations",
  );

  /** Tables a migrated D1 actually holds: replay every CREATE / DROP / RENAME in migration order. */
  function liveTables(): Set<string> {
    const ddl =
      /CREATE TABLE(?: IF NOT EXISTS)?\s+`?(\w+)`?|DROP TABLE(?: IF EXISTS)?\s+`?(\w+)`?|ALTER TABLE\s+`?(\w+)`?\s+RENAME TO\s+`?(\w+)`?/gi;
    const live = new Set<string>();
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort(); // zero-padded prefixes → lexical order is apply order
    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      for (const [, created, dropped, renamedFrom, renamedTo] of sql.matchAll(ddl)) {
        if (created) live.add(created);
        else if (dropped) live.delete(dropped);
        else if (renamedFrom && renamedTo) {
          live.delete(renamedFrom); // the 0025/0026 table-rebuild dance: *_new becomes the real name
          live.add(renamedTo);
        }
      }
    }
    return live;
  }

  /**
   * Tables deliberately left OUT of the daily dump. Every entry needs a reason, so the next person
   * reads a decision instead of guessing at a gap. (d1_migrations needs no entry — it is
   * Cloudflare's own bookkeeping, not created by any migration here, so it never shows up above.)
   */
  const BACKUP_EXCLUSIONS: Record<string, string> = {
    auth_otp_codes: "transient: 6-digit codes with a 5-minute TTL; meaningless by the next backup",
    auth_throttle: "transient: fixed-window rate-limit counters, rebuilt continuously",
    storefront_sessions: "transient: only token hashes; a restore re-issues them at next login",
  };

  it("covers every table the migrations create", () => {
    const missing = [...liveTables()].filter(
      (t) => !BACKUP_TABLES.includes(t) && !(t in BACKUP_EXCLUSIONS),
    );
    expect(missing).toEqual([]);
  });

  it("lists no table the migrations do not create (catches typos + dropped tables)", () => {
    const live = liveTables();
    expect(BACKUP_TABLES.filter((t) => !live.has(t))).toEqual([]);
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
      saleHeader: { id: "s1", grandTotalSatang: 10700, saleStatus: "completed", stage: "bill" },
      saleLines: [{ productVariantId: "v1", quantity: 2 }],
      stockOnHand: 18,
    });
    const out = await refundSaleToDb(db, "s1");
    expect(out).toEqual({ saleId: "s1", applied: true, restockedLines: 1 });
    expect(batched.length).toBe(3); // 1 restock ledger + update sale + finance record
  });

  it("refuses to refund a draft/quotation (only a finalized bill) — no restock, no finance record", async () => {
    const { db, batched } = makeDb({
      saleHeader: { id: "d1", grandTotalSatang: 90000, saleStatus: "open", stage: "draft" },
      saleLines: [{ productVariantId: "v1", quantity: 2 }],
      stockOnHand: 5,
    });
    const out = await refundSaleToDb(db, "d1");
    expect(out.applied).toBe(false);
    expect(batched.length).toBe(0); // a draft never deducted stock / posted revenue — nothing to reverse
  });

  it("writes the restock as a refund_return movement (schema enum, not 'refund')", async () => {
    const { db, batched } = makeDb({
      saleHeader: { id: "s1", grandTotalSatang: 10700, saleStatus: "completed", stage: "bill" },
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

  it("given two lines of the same variant > threads a running on-hand across the batch", async () => {
    const { db, batched } = makeDb({
      saleHeader: { id: "s1", grandTotalSatang: 10700, saleStatus: "completed", stage: "bill" },
      saleLines: [
        { productVariantId: "v1", quantity: 2 },
        { productVariantId: "v1", quantity: 3 },
      ],
      stockOnHand: 5,
    });
    await refundSaleToDb(db, "s1");
    const ledger = (batched as { sql: string; boundArgs?: unknown[] }[]).filter((s) =>
      s.sql.includes("INSERT INTO stock_ledger_entries"),
    );
    // boundArgs order: (id, variant_id, movement_type, delta, after, source_type, source_id, at)
    expect(ledger.map((s) => s.boundArgs?.[4])).toEqual([7, 10]);
  });

  it("rejects an unknown sale", async () => {
    const { db } = makeDb({ saleHeader: null });
    expect((await refundSaleToDb(db, "nope")).applied).toBe(false);
  });

  it("rejects a double refund", async () => {
    const { db } = makeDb({
      saleHeader: { id: "s1", grandTotalSatang: 100, saleStatus: "refunded", stage: "bill" },
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

  it("given a counted on-hand > derives the delta from its own read of the ledger", async () => {
    const { db, runs } = makeDb({ stockOnHand: 8 });
    const out = await applyAdjustmentToDb(db, {
      productVariantId: "v1",
      countedOnHand: 10,
      movementType: "correction",
    });
    expect(out).toEqual({ variantId: "v1", quantityAfter: 10, applied: true });
    // bind order: (id, variant_id, movement_type, delta, after, source_type, reason, at)
    const insert = runs.find((r) => r.sql.includes("INSERT INTO stock_ledger_entries"));
    expect(insert?.binds[3]).toBe(2);
  });

  // The lost update this whole change exists to kill: a stocktake must land on the counted number
  // no matter what moved since the page was drawn.
  it("given stock moved after the page loaded > the count still lands, not a stale delta", async () => {
    // Page drew on-hand 8; a sale took it to 6 before save. Counting 10 must write +4 → 10,
    // never the client's stale 10-8=+2 → 8.
    const { db, runs } = makeDb({ stockOnHand: 6 });
    const out = await applyAdjustmentToDb(db, {
      productVariantId: "v1",
      countedOnHand: 10,
      movementType: "correction",
    });
    expect(out.quantityAfter).toBe(10);
    const insert = runs.find((r) => r.sql.includes("INSERT INTO stock_ledger_entries"));
    expect(insert?.binds[3]).toBe(4);
  });

  it("given a count that matches on-hand > writes nothing and says so", async () => {
    const { db, runs } = makeDb({ stockOnHand: 8 });
    const out = await applyAdjustmentToDb(db, {
      productVariantId: "v1",
      countedOnHand: 8,
      movementType: "correction",
    });
    expect(out.applied).toBe(false);
    expect(out.quantityAfter).toBe(8);
    expect(out.reason).toMatch(/no change/i);
    expect(runs.find((r) => r.sql.includes("INSERT INTO stock_ledger_entries"))).toBeUndefined();
  });

  it("rejects a counted on-hand below zero", async () => {
    const { db } = makeDb({ stockOnHand: 8 });
    const out = await applyAdjustmentToDb(db, {
      productVariantId: "v1",
      countedOnHand: -1,
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

describe("applyHoldToDb (Scan here › On hold)", () => {
  // The single ledger entry a hold/unhold wrote: [id, variantId, movementType, delta, quantityAfter, ...].
  const entry = (batched: { sql: string; boundArgs?: unknown[] }[], type: "hold" | "unhold") =>
    batched.find((s) => s.sql.includes("stock_ledger_entries") && s.boundArgs?.[2] === type)
      ?.boundArgs;

  it("take-away writes a NEGATIVE hold entry and reports the new buckets", async () => {
    const { db, batched } = makeDb({ stockOnHand: 5, heldNet: 0 });
    const results = await applyHoldToDb(db, [
      { productVariantId: "v1", takeAway: 2, bringBack: 0 },
    ]);
    expect(results).toEqual([{ variantId: "v1", applied: true, sellableAfter: 3, heldAfter: 2 }]);
    const e = entry(batched, "hold");
    expect(e?.[3]).toBe(-2); // quantity_delta is negative → sellable SUM drops
    expect(e?.[4]).toBe(3); // quantity_after = new sellable
    expect(entry(batched, "unhold")).toBeUndefined();
  });

  it("bring-back writes a POSITIVE unhold entry", async () => {
    const { db, batched } = makeDb({ stockOnHand: 3, heldNet: 2 });
    const results = await applyHoldToDb(db, [
      { productVariantId: "v1", takeAway: 0, bringBack: 2 },
    ]);
    expect(results).toEqual([{ variantId: "v1", applied: true, sellableAfter: 5, heldAfter: 0 }]);
    const e = entry(batched, "unhold");
    expect(e?.[3]).toBe(2);
    expect(e?.[4]).toBe(5);
  });

  it("REJECTS taking away more than is sellable and writes NOTHING (the oversell guard)", async () => {
    const { db, batched } = makeDb({ stockOnHand: 1, heldNet: 0 });
    const results = await applyHoldToDb(db, [
      { productVariantId: "v1", takeAway: 5, bringBack: 0 },
    ]);
    expect(results[0]?.applied).toBe(false);
    expect(results[0]?.reason).toMatch(/1 sellable/);
    expect(results[0]).toMatchObject({ sellableAfter: 1, heldAfter: 0 });
    expect(batched).toHaveLength(0); // no ledger movement on a rejected line
  });

  it("REJECTS bringing back more than is held", async () => {
    const { db, batched } = makeDb({ stockOnHand: 0, heldNet: 1 });
    const results = await applyHoldToDb(db, [
      { productVariantId: "v1", takeAway: 0, bringBack: 2 },
    ]);
    expect(results[0]?.applied).toBe(false);
    expect(results[0]?.reason).toMatch(/1 on hold/);
    expect(batched).toHaveLength(0);
  });

  it("a row left at 0/0 is a no-op (no entries, applied:false) — so a scanned-but-untouched row is skipped", async () => {
    const { db, batched } = makeDb({ stockOnHand: 5, heldNet: 3 });
    const results = await applyHoldToDb(db, [
      { productVariantId: "v1", takeAway: 0, bringBack: 0 },
    ]);
    expect(results[0]?.applied).toBe(false);
    expect(results[0]?.reason).toBe("no change");
    expect(batched).toHaveLength(0);
  });

  it("lines are independent — a rejected row does not sink a valid one", async () => {
    // Both variants read the same canned stock (the mock is per-db, not per-variant); v-bad over-takes.
    const { db } = makeDb({ stockOnHand: 3, heldNet: 0 });
    const results = await applyHoldToDb(db, [
      { productVariantId: "v-ok", takeAway: 2, bringBack: 0 },
      { productVariantId: "v-bad", takeAway: 9, bringBack: 0 },
    ]);
    expect(results[0]).toEqual({
      variantId: "v-ok",
      applied: true,
      sellableAfter: 1,
      heldAfter: 2,
    });
    expect(results[1]?.applied).toBe(false);
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
      held: 0,
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

  /** The value bound to a named column, read via the SET clause's own order — positional
   *  slicing silently passes against the wrong column (brand_id/type_id/usage_id are also null). */
  const boundValue = (run: { sql: string; binds: unknown[] }, column: string): unknown => {
    const set = /UPDATE products SET (.*) WHERE/.exec(run.sql)?.[1] ?? "";
    const columns = set.split(", ").map((c) => c.split(" = ")[0]);
    const i = columns.indexOf(column);
    return i === -1 ? undefined : run.binds[i];
  };

  // Parcel size for carrier rating. Shippop (and GoShip) price on VOLUMETRIC weight — w×l×h/5000 —
  // so a big light box costs more than its scale weight, and a quote is impossible without these.
  // Stored in MILLIMETRES as integers, mirroring weight_grams: the form takes cm (a box is really
  // 12.5cm), and cm-as-float in a path that decides money is how rounding bugs get in.
  it("updateProduct persists parcel dimensions in mm alongside the weight", async () => {
    const { db, runs } = makeDb({});
    await updateProduct(db, "p1", {
      name: "คอมเพรสเซอร์",
      status: "active",
      weightGrams: 4200,
      widthMm: 250,
      lengthMm: 400,
      heightMm: 155,
    });
    const upd = runs.find((r) => r.sql.startsWith("UPDATE products SET name"))!;
    expect(boundValue(upd, "weight_grams")).toBe(4200);
    expect(boundValue(upd, "width_mm")).toBe(250);
    expect(boundValue(upd, "length_mm")).toBe(400);
    expect(boundValue(upd, "height_mm")).toBe(155);
  });

  it("updateProduct given no dimensions > writes NULL, not 0", async () => {
    // 0×0×0 is a real volumetric claim (a zero-size parcel). "Unknown" must stay unknown, so a
    // missing size surfaces at quote time instead of silently pricing as a flat envelope.
    // (weight_grams keeps its existing 0 default — that is pre-existing behaviour, not ours.)
    const { db, runs } = makeDb({});
    await updateProduct(db, "p1", { name: "New", status: "active" });
    const upd = runs.find((r) => r.sql.startsWith("UPDATE products SET name"))!;
    expect(boundValue(upd, "width_mm")).toBeNull();
    expect(boundValue(upd, "length_mm")).toBeNull();
    expect(boundValue(upd, "height_mm")).toBeNull();
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
          // Display names (migration 0060). The stub rows below set neither, so both come back
          // null and the storefront falls back to `name` — one line instead of two.
          nameTh: null,
          nameEn: null,
          imageKey: null, // no storefront cover set for this brand
          models: [
            {
              id: "cm1",
              name: "Vios",
              nameTh: null,
              nameEn: null,
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

  it("addAttribute sets usage_id when creating a NEW product_types row under a car system", async () => {
    const { db, runs } = makeDb({ attrOption: null });
    const out = await addAttribute(db, "product_types", "Evaporator", { usageId: "u-ac" });
    expect(out.name).toBe("Evaporator");
    const ins = runs.find((r) => r.sql.includes("INSERT INTO product_types"));
    expect(ins).toBeTruthy();
    expect(ins!.binds).toContain("u-ac");
  });

  it("addAttribute leaves an EXISTING category's usage_id untouched (Settings owns it)", async () => {
    const { db, runs } = makeDb({ attrOption: { id: "t1", name: "Evaporator" } });
    const out = await addAttribute(db, "product_types", "evaporator", { usageId: "u-other" });
    expect(out).toEqual({ id: "t1", name: "Evaporator" });
    expect(runs.some((r) => r.sql.includes("INSERT INTO product_types"))).toBe(false);
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

  it("DELETE /attributes/brand/:id > 409 when products still use it (no silent blanking)", async () => {
    const { db, env } = makeDb({ attrInUseCount: 3 });
    const prepare = vi.spyOn(db, "prepare");
    const res = await worker.fetch!(
      new Request("https://x/attributes/brand/br1", { method: "DELETE" }),
      env,
      ctx,
    );
    expect(res.status).toBe(409);
    expect((await res.json()) as { count: number }).toMatchObject({ count: 3 });
    // The row must NOT be deleted while it is still in use.
    expect(prepare.mock.calls.some((c) => (c[0] as string).includes("DELETE FROM brands"))).toBe(
      false,
    );
  });

  it("DELETE /attributes/brand/:id > 200 and deletes when no product uses it", async () => {
    const { db, env } = makeDb({ attrInUseCount: 0 });
    const prepare = vi.spyOn(db, "prepare");
    const res = await worker.fetch!(
      new Request("https://x/attributes/brand/br1", { method: "DELETE" }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    expect(prepare.mock.calls.some((c) => (c[0] as string).includes("DELETE FROM brands"))).toBe(
      true,
    );
  });

  // Car brands/models are referenced by product_fitments BY NAME (not a product FK), so #69's
  // countProductsUsingAttribute returns 0 for them and they were left unguarded — deleting an
  // in-use car model still orphaned those fitments. Guard them the same block-style way.
  it("DELETE /car-fitment/models/:id > 409 when a product fitment still names the model", async () => {
    const { db, env } = makeDb({
      carModelRow: { name: "City", brandName: "Honda" },
      fitmentInUseCount: 2,
    });
    const prepare = vi.spyOn(db, "prepare");
    const res = await worker.fetch!(
      new Request("https://x/car-fitment/models/cm-city", { method: "DELETE" }),
      env,
      ctx,
    );
    expect(res.status).toBe(409);
    expect((await res.json()) as { count: number }).toMatchObject({ count: 2 });
    expect(
      prepare.mock.calls.some((c) => (c[0] as string).includes("DELETE FROM car_models")),
    ).toBe(false);
  });

  it("DELETE /car-fitment/models/:id > 200 and deletes when no fitment names it", async () => {
    const { db, env } = makeDb({
      carModelRow: { name: "City", brandName: "Honda" },
      fitmentInUseCount: 0,
    });
    const prepare = vi.spyOn(db, "prepare");
    const res = await worker.fetch!(
      new Request("https://x/car-fitment/models/cm-city", { method: "DELETE" }),
      env,
      ctx,
    );
    expect(res.status).toBe(200);
    expect(
      prepare.mock.calls.some((c) => (c[0] as string).includes("DELETE FROM car_models")),
    ).toBe(true);
  });

  it("DELETE /car-fitment/brands/:id > 409 when a product fitment still names the brand", async () => {
    const { db, env } = makeDb({ carBrandRow: { name: "Honda" }, fitmentInUseCount: 1 });
    const prepare = vi.spyOn(db, "prepare");
    const res = await worker.fetch!(
      new Request("https://x/car-fitment/brands/cb-honda", { method: "DELETE" }),
      env,
      ctx,
    );
    expect(res.status).toBe(409);
    expect((await res.json()) as { count: number }).toMatchObject({ count: 1 });
    expect(
      prepare.mock.calls.some((c) => (c[0] as string).includes("DELETE FROM car_brands")),
    ).toBe(false);
  });

  it("countFitmentsUsingAttribute > car_models: looks up name+brand, then counts fitments scoped by brand", async () => {
    const { db } = makeDb({
      carModelRow: { name: "City", brandName: "Honda" },
      fitmentInUseCount: 2,
    });
    const prepare = vi.spyOn(db, "prepare");
    expect(await countFitmentsUsingAttribute(db, "car_models", "cm-city")).toBe(2);
    // A same-named model under another make must not count — the fitment count is brand-scoped.
    const countSql = prepare.mock.calls
      .map((c) => c[0] as string)
      .find((s) => s.includes("product_fitments"));
    expect(countSql).toContain("car_model = ?");
    expect(countSql).toContain("car_brand = ?");
  });

  it("countFitmentsUsingAttribute > car_brands counts fitments by name; other tables return 0", async () => {
    const { db } = makeDb({ carBrandRow: { name: "Honda" }, fitmentInUseCount: 5 });
    expect(await countFitmentsUsingAttribute(db, "car_brands", "cb-honda")).toBe(5);
    // brands/product_types/usage_categories are product-referenced, not fitment-referenced → 0 here.
    expect(await countFitmentsUsingAttribute(db, "brands", "br1")).toBe(0);
  });

  it("DELETE /attributes/car_model/:id > 409 when a fitment names it (route also guards car kinds)", async () => {
    const { db, env } = makeDb({
      carModelRow: { name: "City", brandName: "Honda" },
      fitmentInUseCount: 4,
    });
    const prepare = vi.spyOn(db, "prepare");
    const res = await worker.fetch!(
      new Request("https://x/attributes/car_model/cm-city", { method: "DELETE" }),
      env,
      ctx,
    );
    expect(res.status).toBe(409);
    expect((await res.json()) as { count: number }).toMatchObject({ count: 4 });
    expect(
      prepare.mock.calls.some((c) => (c[0] as string).includes("DELETE FROM car_models")),
    ).toBe(false);
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

  it("addBarcodeToProduct barcode INSERT is ON CONFLICT DO NOTHING (a taken value no-ops, never 500s)", async () => {
    const { db, batched } = makeDb({
      variantRow: { id: "v1", barcodePrimary: null },
      productRef: { productRef: "AC-CMP-VIOS14" },
    });
    await addBarcodeToProduct(db, "p1");
    const insert = (batched as { sql: string }[]).find((s) =>
      s.sql.includes("INSERT INTO barcodes"),
    );
    expect(insert?.sql).toContain("ON CONFLICT(barcode_value) DO NOTHING");
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

// ── Real-sqlite harness ──────────────────────────────────────────────────────────────────────────
// Some things can only be tested against a real database built from the real migrations: join
// semantics, FK enforcement, and whether a migration's backfill actually populated anything. The
// `makeDb` mock above matches on `sql.includes(...)` and would happily return canned rows for an
// INNER JOIN that silently drops every imported Shopee order, so it cannot see those bugs.

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations",
);

/** A migrated in-memory D1: replays every migration in apply order. */
function migratedDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // zero-padded prefixes → lexical order is apply order
  for (const file of files) db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  return db;
}

/** The slice of the D1 API the orders path uses: prepare → bind → all/run. */
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
      // D1 returns null (not undefined) when a .first() matches nothing.
      async first<T = unknown>(): Promise<T | null> {
        return (db.prepare(sql).get(...(binds as never[])) as T | undefined) ?? null;
      },
      async run() {
        return db.prepare(sql).run(...(binds as never[]));
      },
      /** The bound statement, so batch() can replay it inside a transaction. */
      __exec() {
        return db.prepare(sql).run(...(binds as never[]));
      },
    };
    return stmt;
  };
  return {
    prepare: (sql: string) => make(sql),
    // D1's batch is atomic, and code under test relies on that — createClaim writes the claim, its
    // lines, the order status and the timeline row together so a rejected line cannot leave a
    // half-built claim behind. A harness that just looped would pass while hiding that.
    async batch(stmts: { __exec: () => unknown }[]) {
      db.exec("BEGIN");
      try {
        const out = stmts.map((s) => s.__exec());
        db.exec("COMMIT");
        return out;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
  } as unknown as D1Database;
}

/** Fixed clock — seeded orders stay well inside the 48h expiry window. */
const SQLITE_NOW = 1_760_000_000_000;

describe("listOrders > storefront_customers join", () => {
  const NOW = SQLITE_NOW;

  function seed(db: DatabaseSync) {
    db.prepare(
      `INSERT INTO storefront_customers (id, phone, name, created_at, updated_at, customer_code)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("cus-1", "0810000001", "สมชาย ใจดี", NOW, NOW, "AP-8F2C41A9");

    const insertOrder = db.prepare(
      `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status,
                                 grand_total_satang, order_created_at, imported_at,
                                 buyer_username, storefront_customer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    // The fixture is built so the JOIN KEY is load-bearing: the linked orders carry a buyer_username
    // that does NOT equal the customer's name, and the unlinked order carries one that DOES. A join
    // written against buyer_username instead of storefront_customer_id therefore gets both cases
    // exactly backwards, and cannot pass by coincidence.

    // An AirPlus order placed by a registered customer — matched only by id.
    insertOrder.run(
      "ord-linked",
      "airplus",
      "AP-1",
      "new",
      "paid",
      285_000,
      NOW,
      NOW,
      "somchai99", // a handle, not the customer's name
      "cus-1",
    );
    // A CSV-imported Shopee order with no storefront account — but whose buyer_username happens to
    // read exactly like the registered customer's name. It must NOT pick up that customer's code.
    insertOrder.run(
      "ord-unlinked",
      "shopee",
      "SP-1",
      "completed",
      "paid",
      450_000,
      NOW,
      NOW,
      "สมชาย ใจดี",
      null,
    );
    // A second AirPlus order for the SAME customer — proves one customer row cannot fan a single
    // order into duplicates, and that two orders can share a code.
    insertOrder.run(
      "ord-linked-2",
      "airplus",
      "AP-2",
      "shipped",
      "cod",
      189_500,
      NOW,
      NOW,
      "somchai99",
      "cus-1",
    );
    // NOTE: there is deliberately no "dangling storefront_customer_id" case — sales_orders carries
    // a FK to storefront_customers(id), so sqlite/D1 reject that row outright. The unlinked (NULL)
    // case above is the only way an order can lack a customer.
  }

  async function listed() {
    const db = migratedDb();
    seed(db);
    const res = await listOrders({ DB: asD1(db) } as unknown as Env);
    const body = (await res.json()) as { orders: { id: string; customerCode: string | null }[] };
    return body.orders;
  }

  it("given an order linked to a customer > returns that customer's code", async () => {
    const orders = await listed();
    expect(orders.find((o) => o.id === "ord-linked")?.customerCode).toBe("AP-8F2C41A9");
  });

  it("given an order with no linked customer > keeps the order and reports a null code", async () => {
    // The regression this guards: an INNER JOIN here would erase every imported Shopee order from
    // the admin list, and the page would look merely "empty" rather than broken.
    const orders = await listed();
    const unlinked = orders.find((o) => o.id === "ord-unlinked");
    expect(unlinked).toBeDefined();
    expect(unlinked?.customerCode).toBeNull();
  });

  it("given two orders sharing one customer > both carry the code and neither duplicates", async () => {
    const orders = await listed();
    expect(
      orders
        .filter((o) => o.customerCode === "AP-8F2C41A9")
        .map((o) => o.id)
        .sort(),
    ).toEqual(["ord-linked", "ord-linked-2"]);
  });

  it("returns every order exactly once (the join must not fan rows out)", async () => {
    const orders = await listed();
    expect(orders.map((o) => o.id).sort()).toEqual(["ord-linked", "ord-linked-2", "ord-unlinked"]);
  });
});

describe("migration 0070 > order_status_history", () => {
  /**
   * The backfill is the risky half of this migration: it writes one row per existing AirPlus order,
   * and if its WHERE or its COALESCE is wrong the damage is silent — orders simply open with an
   * empty or wrongly-dated timeline, which looks like "no history yet" rather than a bug. So this
   * runs the real migration against real sqlite and checks what actually landed.
   */
  function seedOrders(db: DatabaseSync) {
    const ins = db.prepare(
      `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status,
                                 order_created_at, imported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    // An AirPlus order with its own created-at.
    ins.run("ap-1", "airplus", "AP-1", "delivered", "paid", SQLITE_NOW, SQLITE_NOW + 5_000);
    // An AirPlus order with NO order_created_at — the backfill must fall back to imported_at.
    ins.run("ap-2", "airplus", "AP-2", "new", "pending", null, SQLITE_NOW + 9_000);
    // A Shopee order, which must be left alone: that channel lives on /sales.
    ins.run("sp-1", "shopee", "SP-1", "completed", "paid", SQLITE_NOW, SQLITE_NOW);
    // A legacy AirPlus row with null statuses — must still get a row, recorded faithfully as null.
    ins.run("ap-legacy", "airplus", "AP-3", null, null, SQLITE_NOW, SQLITE_NOW);
  }

  /** Applies every migration EXCEPT 0070, so the backfill can be run against seeded data. */
  function dbBefore0070(): DatabaseSync {
    const db = new DatabaseSync(":memory:");
    for (const f of readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql") && !f.startsWith("0070"))
      .sort()) {
      db.exec(readFileSync(join(migrationsDir, f), "utf8"));
    }
    return db;
  }

  function apply0070(db: DatabaseSync) {
    const f = readdirSync(migrationsDir).find((n) => n.startsWith("0070"));
    db.exec(readFileSync(join(migrationsDir, f!), "utf8"));
  }

  function backfilled() {
    const db = dbBefore0070();
    seedOrders(db);
    apply0070(db);
    return db
      .prepare(
        `SELECT order_id, order_status, payment_status, event, actor_email, created_at
           FROM order_status_history ORDER BY order_id`,
      )
      .all() as {
      order_id: string;
      order_status: string | null;
      payment_status: string | null;
      event: string;
      actor_email: string | null;
      created_at: number;
    }[];
  }

  it("creates the table on a database that already holds orders", () => {
    expect(() => backfilled()).not.toThrow();
  });

  it("backfills exactly one row per AirPlus order and none for Shopee", () => {
    expect(backfilled().map((r) => r.order_id)).toEqual(["ap-1", "ap-2", "ap-legacy"]);
  });

  it("snapshots the order's current statuses onto its opening row", () => {
    const ap1 = backfilled().find((r) => r.order_id === "ap-1");
    expect(ap1?.order_status).toBe("delivered");
    expect(ap1?.payment_status).toBe("paid");
  });

  it("dates the row from order_created_at when it exists", () => {
    expect(backfilled().find((r) => r.order_id === "ap-1")?.created_at).toBe(SQLITE_NOW);
  });

  it("falls back to imported_at when order_created_at is null", () => {
    expect(backfilled().find((r) => r.order_id === "ap-2")?.created_at).toBe(SQLITE_NOW + 9_000);
  });

  it("records a legacy null-status order faithfully rather than inventing a status", () => {
    const legacy = backfilled().find((r) => r.order_id === "ap-legacy");
    expect(legacy).toBeDefined();
    expect(legacy?.order_status).toBeNull();
    expect(legacy?.payment_status).toBeNull();
  });

  it("marks backfilled rows as created with no actor, since we do not know who placed them", () => {
    for (const r of backfilled()) {
      expect(r.event).toBe("created");
      expect(r.actor_email).toBeNull();
    }
  });

  it("uses the closed event vocabulary from core", () => {
    for (const r of backfilled()) expect(isOrderHistoryEvent(r.event)).toBe(true);
  });

  it("gives every row a distinct id", () => {
    const db = dbBefore0070();
    seedOrders(db);
    apply0070(db);
    const rows = db.prepare(`SELECT COUNT(DISTINCT id) AS n FROM order_status_history`).all() as {
      n: number;
    }[];
    expect(rows[0]!.n).toBe(3);
  });

  it("enforces the order_id foreign key", () => {
    const db = migratedDb();
    expect(() =>
      db
        .prepare(
          `INSERT INTO order_status_history (id, order_id, event, created_at)
           VALUES ('h1', 'does-not-exist', 'created', 1)`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY/i);
  });

  it("requires an event on every row", () => {
    const db = dbBefore0070();
    seedOrders(db);
    apply0070(db);
    expect(() =>
      db
        .prepare(
          `INSERT INTO order_status_history (id, order_id, event, created_at)
           VALUES ('h2', 'ap-1', NULL, 1)`,
        )
        .run(),
    ).toThrow(/NOT NULL/i);
  });
});

describe("updateOrder > timeline", () => {
  /**
   * A status change has to leave a trace, and an edit that changes no status must NOT — otherwise
   * every carrier or tracking correction becomes a timeline entry and the history the owner reads
   * turns into noise. Both halves are asserted here against real sqlite.
   */
  const NOW = SQLITE_NOW;

  function seeded() {
    const db = migratedDb();
    db.prepare(
      `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status,
                                 order_created_at, imported_at)
       VALUES ('o1', 'airplus', 'AP-1', 'new', 'pending', ?, ?)`,
    ).run(NOW, NOW);
    // The backfill already gave it an opening row; clear it so each test reads only its own writes.
    db.prepare(`DELETE FROM order_status_history`).run();
    return db;
  }

  function history(db: DatabaseSync) {
    return db
      .prepare(
        `SELECT order_id, order_status, payment_status, event, actor_email, created_at
           FROM order_status_history ORDER BY created_at, event`,
      )
      .all() as {
      order_id: string;
      order_status: string | null;
      payment_status: string | null;
      event: string;
      actor_email: string | null;
      created_at: number;
    }[];
  }

  it("given a payment change > appends one row naming the money event", async () => {
    const db = seeded();
    await updateOrder(asD1(db), "o1", { paymentStatus: "paid" }, "staff@airplusauto.com", NOW);
    const rows = history(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.event).toBe("paid");
  });

  it("snapshots BOTH statuses on the row, not just the one that moved", async () => {
    const db = seeded();
    await updateOrder(asD1(db), "o1", { paymentStatus: "paid" }, "staff@airplusauto.com", NOW);
    const [row] = history(db);
    expect(row!.order_status).toBe("new");
    expect(row!.payment_status).toBe("paid");
  });

  it("records the Access email of whoever made the change", async () => {
    const db = seeded();
    await updateOrder(asD1(db), "o1", { orderStatus: "confirmed" }, "owner@airplusauto.com", NOW);
    expect(history(db)[0]!.actor_email).toBe("owner@airplusauto.com");
  });

  it("given no actor (a system write) > records a null actor rather than failing", async () => {
    const db = seeded();
    await updateOrder(asD1(db), "o1", { orderStatus: "confirmed" }, null, NOW);
    expect(history(db)[0]!.actor_email).toBeNull();
  });

  it("given only a carrier edit > appends NOTHING", async () => {
    const db = seeded();
    await updateOrder(asD1(db), "o1", { carrier: "Flash Express" }, "staff@airplusauto.com", NOW);
    expect(history(db)).toEqual([]);
  });

  it("given only a tracking-number edit > appends NOTHING", async () => {
    const db = seeded();
    await updateOrder(asD1(db), "o1", { trackingNo: "TH123" }, "staff@airplusauto.com", NOW);
    expect(history(db)).toEqual([]);
  });

  it("given a status change AND a carrier edit together > appends exactly one row", async () => {
    const db = seeded();
    await updateOrder(
      asD1(db),
      "o1",
      { orderStatus: "shipped", carrier: "Flash Express", trackingNo: "TH123" },
      "staff@airplusauto.com",
      NOW,
    );
    const rows = history(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.event).toBe("shipped");
  });

  it("stamps the row with the supplied clock", async () => {
    const db = seeded();
    await updateOrder(asD1(db), "o1", { paymentStatus: "paid" }, null, NOW + 1234);
    expect(history(db)[0]!.created_at).toBe(NOW + 1234);
  });

  it("accumulates one row per change across a whole order lifecycle", async () => {
    const db = seeded();
    const d = asD1(db);
    await updateOrder(d, "o1", { paymentStatus: "paid" }, "s@x.com", NOW + 1);
    await updateOrder(d, "o1", { orderStatus: "confirmed" }, "s@x.com", NOW + 2);
    await updateOrder(d, "o1", { orderStatus: "packing" }, "s@x.com", NOW + 3);
    await updateOrder(d, "o1", { orderStatus: "shipped", trackingNo: "TH1" }, "s@x.com", NOW + 4);
    await updateOrder(d, "o1", { orderStatus: "delivered" }, "s@x.com", NOW + 5);
    expect(history(db).map((r) => r.event)).toEqual([
      "paid",
      "confirmed",
      "packing",
      "shipped",
      "delivered",
    ]);
  });

  it("given a Shopee order > changes nothing and writes no history", async () => {
    const db = migratedDb();
    db.prepare(
      `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status,
                                 order_created_at, imported_at)
       VALUES ('sp1', 'shopee', 'SP-1', 'completed', 'paid', ?, ?)`,
    ).run(NOW, NOW);
    const out = await updateOrder(asD1(db), "sp1", { paymentStatus: "refunded" }, "s@x.com", NOW);
    expect(out).toEqual({ ok: false, code: 404, reason: "not found" });
    expect(history(db)).toEqual([]);
  });
});

describe("expireUnpaidOrders > timeline", () => {
  /**
   * The 48h sweep is the one transition no human triggers, so it is the one most likely to leave the
   * timeline silent. It runs inside listOrders — a GET — which the API's audit wrapper does not
   * record either, making this the only trace an expiry leaves anywhere.
   */
  const NOW = SQLITE_NOW;
  const OVER_48H = NOW - (48 * 60 * 60 * 1000 + 1000);

  function seeded() {
    const db = migratedDb();
    const ins = db.prepare(
      `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status,
                                 order_created_at, imported_at)
       VALUES (?, 'airplus', ?, ?, ?, ?, ?)`,
    );
    ins.run("stale-1", "AP-1", "new", "pending", OVER_48H, OVER_48H);
    ins.run("stale-2", "AP-2", "new", "pending", OVER_48H, OVER_48H);
    ins.run("fresh", "AP-3", "new", "pending", NOW, NOW);
    // COD is excluded from expiry by design — it is not waiting on a transfer.
    ins.run("cod", "AP-4", "new", "cod", OVER_48H, OVER_48H);
    db.prepare(`DELETE FROM order_status_history`).run();
    return db;
  }

  function history(db: DatabaseSync) {
    return db
      .prepare(
        `SELECT order_id, order_status, payment_status, event, actor_email, created_at
           FROM order_status_history ORDER BY order_id`,
      )
      .all() as {
      order_id: string;
      order_status: string | null;
      payment_status: string | null;
      event: string;
      actor_email: string | null;
      created_at: number;
    }[];
  }

  it("appends one expired entry per swept order, and none for the others", async () => {
    const db = seeded();
    const n = await expireUnpaidOrders(asD1(db), NOW);
    expect(n).toBe(2);
    expect(history(db).map((r) => r.order_id)).toEqual(["stale-1", "stale-2"]);
  });

  it("names the event expired and snapshots both axes as expired", async () => {
    const db = seeded();
    await expireUnpaidOrders(asD1(db), NOW);
    for (const r of history(db)) {
      expect(r.event).toBe("expired");
      expect(r.order_status).toBe("expired");
      expect(r.payment_status).toBe("expired");
    }
  });

  it("records a null actor, because the system did it and no staff member can be blamed", async () => {
    const db = seeded();
    await expireUnpaidOrders(asD1(db), NOW);
    for (const r of history(db)) expect(r.actor_email).toBeNull();
  });

  it("stamps the sweep's own clock, not the order's created-at", async () => {
    const db = seeded();
    await expireUnpaidOrders(asD1(db), NOW);
    for (const r of history(db)) expect(r.created_at).toBe(NOW);
  });

  it("given nothing stale > writes no rows at all", async () => {
    const db = migratedDb();
    db.prepare(
      `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status,
                                 order_created_at, imported_at)
       VALUES ('fresh', 'airplus', 'AP-1', 'new', 'pending', ?, ?)`,
    ).run(NOW, NOW);
    db.prepare(`DELETE FROM order_status_history`).run();
    expect(await expireUnpaidOrders(asD1(db), NOW)).toBe(0);
    expect(history(db)).toEqual([]);
  });
});

describe("migration 0071 > order_claims", () => {
  /**
   * The CHECK constraints are the point of testing this against real sqlite: they are what stop the
   * free-text problem that already bit this codebase once (the admin's Sales tab writes arbitrary
   * strings into order_status). If a CHECK is wrong or missing, nothing else notices until a claim
   * holds a state the state machine cannot read.
   */
  function seeded() {
    const db = migratedDb();
    // sales_order_lines.product_variant_id is NOT NULL and references product_variants, which in
    // turn references products — so a claim fixture needs the whole chain, not just the order.
    db.prepare(`INSERT INTO products (id, name, created_at) VALUES ('p1', 'Coil', ?)`).run(
      SQLITE_NOW,
    );
    const variant = db.prepare(
      `INSERT INTO product_variants (id, product_id, created_at) VALUES (?, 'p1', ?)`,
    );
    variant.run("v1", SQLITE_NOW);
    variant.run("v2", SQLITE_NOW);
    db.prepare(
      `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status,
                                 order_created_at, imported_at)
       VALUES ('o1', 'airplus', 'AP-1', 'delivered', 'paid', ?, ?)`,
    ).run(SQLITE_NOW, SQLITE_NOW);
    const line = db.prepare(
      `INSERT INTO sales_order_lines (id, sales_order_id, product_variant_id, quantity,
                                      unit_price_satang, line_total_satang, created_at)
       VALUES (?, 'o1', ?, ?, ?, ?, ?)`,
    );
    line.run("l1", "v1", 2, 100000, 200000, SQLITE_NOW);
    line.run("l2", "v2", 1, 50000, 50000, SQLITE_NOW);
    return db;
  }

  const insertClaim = (db: DatabaseSync, over: Record<string, unknown> = {}) => {
    const row = {
      id: "c1",
      sales_order_id: "o1",
      kind: "defect",
      state: "requested",
      ...over,
    } as Record<string, unknown>;
    return db
      .prepare(
        `INSERT INTO order_claims (id, sales_order_id, kind, state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id as string,
        row.sales_order_id as string,
        row.kind as string,
        row.state as string,
        SQLITE_NOW,
        SQLITE_NOW,
      );
  };

  it("accepts a claim in the opening state", () => {
    const db = seeded();
    expect(() => insertClaim(db)).not.toThrow();
  });

  it("accepts every state the core state machine knows", () => {
    for (const s of CLAIM_STATES) {
      const db = seeded();
      expect(() => insertClaim(db, { state: s })).not.toThrow();
    }
  });

  it("refuses a state the state machine does not know", () => {
    const db = seeded();
    expect(() => insertClaim(db, { state: "approved_maybe" })).toThrow(/CHECK/i);
  });

  it("refuses a reason that is neither a wrong item nor a defect", () => {
    const db = seeded();
    expect(() => insertClaim(db, { kind: "changed_mind" })).toThrow(/CHECK/i);
  });

  it("refuses a claim against an order that does not exist", () => {
    const db = seeded();
    expect(() => insertClaim(db, { sales_order_id: "nope" })).toThrow(/FOREIGN KEY/i);
  });

  it("refuses a negative refund", () => {
    const db = seeded();
    insertClaim(db);
    expect(() =>
      db.prepare(`UPDATE order_claims SET refund_satang = -1 WHERE id = 'c1'`).run(),
    ).toThrow(/CHECK/i);
  });

  it("allows a partial refund, which the owner's policy requires", () => {
    const db = seeded();
    insertClaim(db);
    expect(() =>
      db
        .prepare(
          `UPDATE order_claims SET resolution = 'refund', refund_satang = 120000 WHERE id = 'c1'`,
        )
        .run(),
    ).not.toThrow();
  });

  it("refuses a resolution that is neither exchange nor refund", () => {
    const db = seeded();
    insertClaim(db);
    expect(() =>
      db.prepare(`UPDATE order_claims SET resolution = 'store_credit' WHERE id = 'c1'`).run(),
    ).toThrow(/CHECK/i);
  });

  it("lets one claim cover a single line OR several — the owner said both", () => {
    const db = seeded();
    insertClaim(db);
    const line = db.prepare(
      `INSERT INTO order_claim_lines (id, claim_id, sales_order_line_id, quantity) VALUES (?, 'c1', ?, ?)`,
    );
    expect(() => line.run("cl1", "l1", 2)).not.toThrow();
    expect(() => line.run("cl2", "l2", 1)).not.toThrow();
    const n = db.prepare(`SELECT COUNT(*) AS n FROM order_claim_lines`).all() as { n: number }[];
    expect(n[0]!.n).toBe(2);
  });

  it("refuses the same order line twice on one claim", () => {
    const db = seeded();
    insertClaim(db);
    db.prepare(
      `INSERT INTO order_claim_lines (id, claim_id, sales_order_line_id, quantity) VALUES ('cl1','c1','l1',1)`,
    ).run();
    expect(() =>
      db
        .prepare(
          `INSERT INTO order_claim_lines (id, claim_id, sales_order_line_id, quantity) VALUES ('cl2','c1','l1',1)`,
        )
        .run(),
    ).toThrow(/UNIQUE/i);
  });

  it("refuses a zero or negative claimed quantity", () => {
    const db = seeded();
    insertClaim(db);
    expect(() =>
      db
        .prepare(
          `INSERT INTO order_claim_lines (id, claim_id, sales_order_line_id, quantity) VALUES ('cl1','c1','l1',0)`,
        )
        .run(),
    ).toThrow(/CHECK/i);
  });

  it("lets the same order be claimed more than once — a replacement can itself fail", () => {
    const db = seeded();
    insertClaim(db, { id: "c1" });
    expect(() => insertClaim(db, { id: "c2" })).not.toThrow();
  });
});

describe("recordRefund (failed-delivery refund)", () => {
  const NOW = SQLITE_NOW;

  /** A paid parcel that bounced, with two units on one line and a real carrier charge of ฿75. */
  function bounced(over: { orderStatus?: string; paymentStatus?: string } = {}) {
    const { orderStatus = "delivery_failed", paymentStatus = "paid" } = over;
    const db = migratedDb();
    db.prepare(`INSERT INTO products (id, name, created_at) VALUES ('p1','คอยล์เย็น',?)`).run(NOW);
    db.prepare(
      `INSERT INTO product_variants (id, product_id, sku, created_at) VALUES ('v1','p1','SKU-1',?)`,
    ).run(NOW);
    db.prepare(
      `INSERT INTO sales_orders
         (id, channel, external_order_id, order_status, payment_status, subtotal_satang,
          discount_total_satang, shipping_fee_satang, shipping_real_satang, grand_total_satang,
          profit_satang, order_created_at, imported_at)
       VALUES ('o1','airplus','AP-1',?,?,200000,10000,5000,7500,195000,60000,?,?)`,
    ).run(orderStatus, paymentStatus, NOW, NOW);
    db.prepare(
      `INSERT INTO sales_order_lines
         (id, sales_order_id, product_variant_id, quantity, unit_price_satang, unit_cost_satang,
          line_total_satang, created_at)
       VALUES ('l1','o1','v1',2,100000,70000,200000,?)`,
    ).run(NOW);
    db.prepare(
      `INSERT INTO order_status_history
         (id, order_id, order_status, payment_status, event, actor_email, created_at)
       VALUES ('h1','o1','delivery_failed','paid','updated',NULL,?)`,
    ).run(NOW);
    return db;
  }

  const orderRow = (db: DatabaseSync) =>
    db
      .prepare(
        `SELECT payment_status AS paymentStatus, refund_satang AS refundSatang,
                refunded_at AS refundedAt, refund_actor_email AS refundActorEmail,
                refund_slip_image_key AS refundSlipImageKey FROM sales_orders WHERE id='o1'`,
      )
      .get() as Record<string, unknown>;

  it("records a full refund: refunded status, amount = grand total, actor + slip stored", async () => {
    const db = bounced();
    const out = await recordRefund(asD1(db), "o1", "refund-slip/o1/x.jpg", "boss@x.com", NOW);
    expect(out.ok).toBe(true);
    const row = orderRow(db);
    expect(row.paymentStatus).toBe("refunded");
    expect(row.refundSatang).toBe(195000);
    expect(row.refundedAt).toBe(NOW);
    expect(row.refundActorEmail).toBe("boss@x.com");
    expect(row.refundSlipImageKey).toBe("refund-slip/o1/x.jpg");
  });

  it("restocks the bounced goods with a refund_return entry", async () => {
    const db = bounced();
    await recordRefund(asD1(db), "o1", "refund-slip/o1/x.jpg", "boss@x.com", NOW);
    const restock = db
      .prepare(
        `SELECT movement_type AS movementType, quantity_delta AS quantityDelta
         FROM stock_ledger_entries WHERE product_variant_id='v1'`,
      )
      .get() as { movementType: string; quantityDelta: number };
    expect(restock.movementType).toBe("refund_return");
    expect(restock.quantityDelta).toBe(2);
  });

  it("appends a 'refunded' timeline step", async () => {
    const db = bounced();
    await recordRefund(asD1(db), "o1", "refund-slip/o1/x.jpg", "boss@x.com", NOW);
    const events = (
      db.prepare(`SELECT event FROM order_status_history WHERE order_id='o1'`).all() as {
        event: string;
      }[]
    ).map((r) => r.event);
    expect(events).toContain("refunded");
  });

  it("the read model then shows profit as the shipping loss and the action as refunded", async () => {
    const db = bounced();
    await recordRefund(asD1(db), "o1", "refund-slip/o1/x.jpg", "boss@x.com", NOW);
    const d = await getOrderDetail(asD1(db), "o1", NOW);
    expect(d!.money.profitSatang).toBe(-7500); // 195000 in, 195000 back out, ฿75 carrier eaten
    expect(d!.money.customerPaidSatang).toBe(195000);
    expect(d!.refundAction).toBe("refunded");
  });

  it("before a refund, a fresh bounce reads as needs_refund", async () => {
    const d = await getOrderDetail(asD1(bounced()), "o1", NOW);
    expect(d!.refundAction).toBe("needs_refund");
    expect(d!.money.profitSatang).toBe(47500); // 190000 goods − 140000 cost − 2500 shortfall (real 7500 − charged 5000)
  });

  it("is idempotent: a second refund is refused, not double-posted", async () => {
    const db = bounced();
    await recordRefund(asD1(db), "o1", "refund-slip/o1/x.jpg", "boss@x.com", NOW);
    const again = await recordRefund(asD1(db), "o1", "refund-slip/o1/y.jpg", "boss@x.com", NOW);
    expect(again).toEqual({ ok: false, code: 409, reason: "this order has already been refunded" });
  });

  it("refuses an order that did not fail delivery", async () => {
    const out = await recordRefund(
      asD1(bounced({ orderStatus: "delivered" })),
      "o1",
      "k",
      "b",
      NOW,
    );
    expect(out.code).toBe(409);
  });

  it("refuses a bounce we were never paid for", async () => {
    const out = await recordRefund(
      asD1(bounced({ paymentStatus: "cod_denied" })),
      "o1",
      "k",
      "b",
      NOW,
    );
    expect(out.code).toBe(409);
  });

  it("requires a refund slip", async () => {
    const out = await recordRefund(asD1(bounced()), "o1", "", "boss@x.com", NOW);
    expect(out).toEqual({ ok: false, code: 400, reason: "a refund slip is required" });
  });
});

describe("recordClaimRefund (claim resolved with money back)", () => {
  const NOW = SQLITE_NOW;

  /**
   * A paid order with a mechanic-approved claim the customer chose to settle in cash. Two units on one
   * line so the "no restock" guarantee is observable, and the order already sits at `claimed` (which is
   * what mechanic_approved projects onto the order).
   */
  function claimRefund(
    over: { state?: string; resolution?: string; refundedAt?: number | null } = {},
  ) {
    const { state = "mechanic_approved", resolution = "refund", refundedAt = null } = over;
    const db = migratedDb();
    db.prepare(`INSERT INTO products (id, name, created_at) VALUES ('p1','คอมเพรสเซอร์',?)`).run(
      NOW,
    );
    db.prepare(
      `INSERT INTO product_variants (id, product_id, sku, created_at) VALUES ('v1','p1','SKU-1',?)`,
    ).run(NOW);
    db.prepare(
      `INSERT INTO sales_orders
         (id, channel, external_order_id, order_status, payment_status, subtotal_satang,
          discount_total_satang, shipping_fee_satang, grand_total_satang, profit_satang,
          order_created_at, imported_at, refunded_at)
       VALUES ('o1','airplus','AP-1','claimed','paid',200000,10000,5000,195000,60000,?,?,?)`,
    ).run(NOW, NOW, refundedAt);
    db.prepare(
      `INSERT INTO sales_order_lines
         (id, sales_order_id, product_variant_id, quantity, unit_price_satang, unit_cost_satang,
          line_total_satang, created_at)
       VALUES ('l1','o1','v1',2,100000,70000,200000,?)`,
    ).run(NOW);
    db.prepare(
      `INSERT INTO order_claims (id, sales_order_id, kind, state, resolution, created_at, updated_at)
       VALUES ('cl1','o1','defect',?,?,?,?)`,
    ).run(state, resolution, NOW, NOW);
    return db;
  }

  const orderRow = (db: DatabaseSync) =>
    db
      .prepare(
        `SELECT payment_status AS paymentStatus, refund_satang AS refundSatang,
                refunded_at AS refundedAt, refund_actor_email AS refundActorEmail,
                refund_slip_image_key AS refundSlipImageKey FROM sales_orders WHERE id='o1'`,
      )
      .get() as Record<string, unknown>;
  const stateOf = (db: DatabaseSync) =>
    (db.prepare(`SELECT state FROM order_claims WHERE id='cl1'`).get() as { state: string }).state;

  it("records the refund on the order and closes the claim as done", async () => {
    const db = claimRefund();
    const out = await recordClaimRefund(
      asD1(db),
      "cl1",
      "refund-slip/cl1/x.jpg",
      "boss@x.com",
      NOW,
    );
    expect(out.ok).toBe(true);
    const row = orderRow(db);
    expect(row.paymentStatus).toBe("refunded");
    expect(row.refundSatang).toBe(195000); // whole-order claim → the grand total
    expect(row.refundActorEmail).toBe("boss@x.com");
    expect(row.refundSlipImageKey).toBe("refund-slip/cl1/x.jpg");
    expect(stateOf(db)).toBe("done");
  });

  it("does NOT restock — the returned item is the defective one, not resellable", async () => {
    const db = claimRefund();
    await recordClaimRefund(asD1(db), "cl1", "refund-slip/cl1/x.jpg", "boss@x.com", NOW);
    const n = (
      db
        .prepare(`SELECT COUNT(*) AS n FROM stock_ledger_entries WHERE product_variant_id='v1'`)
        .get() as { n: number }
    ).n;
    expect(n).toBe(0);
  });

  it("the read model then reflects the refund in the money books", async () => {
    const db = claimRefund();
    await recordClaimRefund(asD1(db), "cl1", "refund-slip/cl1/x.jpg", "boss@x.com", NOW);
    const d = await getOrderDetail(asD1(db), "o1", NOW);
    // 195000 in, 195000 back out, no carrier loss recorded — the defective part is cost-recovered
    // up the supply chain, so profit nets to zero rather than the stale margin.
    expect(d!.money.profitSatang).toBe(0);
    expect(d!.money.customerPaidSatang).toBe(195000);
  });

  it("appends a 'refunded' timeline step", async () => {
    const db = claimRefund();
    await recordClaimRefund(asD1(db), "cl1", "refund-slip/cl1/x.jpg", "boss@x.com", NOW);
    const events = (
      db.prepare(`SELECT event FROM order_status_history WHERE order_id='o1'`).all() as {
        event: string;
      }[]
    ).map((r) => r.event);
    expect(events).toContain("refunded");
  });

  it("is idempotent: a second refund is refused, not double-posted", async () => {
    const db = claimRefund();
    await recordClaimRefund(asD1(db), "cl1", "refund-slip/cl1/x.jpg", "boss@x.com", NOW);
    const again = await recordClaimRefund(
      asD1(db),
      "cl1",
      "refund-slip/cl1/y.jpg",
      "boss@x.com",
      NOW,
    );
    expect(again).toEqual({ ok: false, code: 409, reason: "this order has already been refunded" });
  });

  it("refuses a claim the mechanic has not passed yet", async () => {
    const out = await recordClaimRefund(
      asD1(claimRefund({ state: "received" })),
      "cl1",
      "k",
      "b",
      NOW,
    );
    expect(out.code).toBe(409);
    expect(stateOf(claimRefund({ state: "received" }))).toBe("received");
  });

  it("refuses a claim the customer chose to exchange, not refund", async () => {
    const out = await recordClaimRefund(
      asD1(claimRefund({ resolution: "exchange" })),
      "cl1",
      "k",
      "b",
      NOW,
    );
    expect(out.code).toBe(409);
  });

  it("requires a refund slip", async () => {
    const out = await recordClaimRefund(asD1(claimRefund()), "cl1", "", "boss@x.com", NOW);
    expect(out).toEqual({ ok: false, code: 400, reason: "a refund slip is required" });
  });

  it("fails without throwing for an unknown claim", async () => {
    const out = await recordClaimRefund(asD1(claimRefund()), "nope", "k", "b", NOW);
    expect(out.ok).toBe(false);
    expect(out.code).toBe(404);
  });
});

describe("recordClaimReturnShipment (ship a rejected claim's product back)", () => {
  const NOW = SQLITE_NOW;

  /** A paid order with a REJECTED claim (out of T&C / misuse) whose product we still owe back. */
  function rejected(over: { state?: string; trackingNo?: string | null } = {}) {
    const { state = "mechanic_rejected", trackingNo = null } = over;
    const db = migratedDb();
    db.prepare(`INSERT INTO products (id, name, created_at) VALUES ('p1','คอมเพรสเซอร์',?)`).run(
      NOW,
    );
    db.prepare(
      `INSERT INTO product_variants (id, product_id, sku, created_at) VALUES ('v1','p1','SKU-1',?)`,
    ).run(NOW);
    db.prepare(
      `INSERT INTO sales_orders
         (id, channel, external_order_id, order_status, payment_status, subtotal_satang,
          discount_total_satang, shipping_fee_satang, grand_total_satang, profit_satang,
          order_created_at, imported_at)
       VALUES ('o1','airplus','AP-1','claim_rejected','paid',200000,10000,5000,195000,60000,?,?)`,
    ).run(NOW, NOW);
    db.prepare(
      `INSERT INTO sales_order_lines
         (id, sales_order_id, product_variant_id, quantity, unit_price_satang, unit_cost_satang,
          line_total_satang, created_at)
       VALUES ('l1','o1','v1',1,100000,70000,100000,?)`,
    ).run(NOW);
    db.prepare(
      `INSERT INTO order_claims (id, sales_order_id, kind, state, tracking_no, created_at, updated_at)
       VALUES ('cl1','o1','defect',?,?,?,?)`,
    ).run(state, trackingNo, NOW, NOW);
    return db;
  }

  const ship = { carrier: "Flash", trackingNo: "TH55", shippingFeeSatang: 9000 };
  const claimRow = (db: DatabaseSync) =>
    db
      .prepare(
        `SELECT state, carrier, tracking_no AS trackingNo, shipping_fee_satang AS fee,
                dropped_off_at AS droppedOffAt FROM order_claims WHERE id='cl1'`,
      )
      .get() as Record<string, unknown>;

  it("records the return shipment on the claim without changing its rejected state", async () => {
    const db = rejected();
    const out = await recordClaimReturnShipment(asD1(db), "cl1", ship, "boss@x.com", NOW);
    expect(out.ok).toBe(true);
    const row = claimRow(db);
    expect(row).toMatchObject({
      state: "mechanic_rejected",
      carrier: "Flash",
      trackingNo: "TH55",
      fee: 9000,
    });
    expect(row.droppedOffAt).toBe(NOW);
  });

  it("the return fee lands in the money book (profit drops by it)", async () => {
    const db = rejected();
    await recordClaimReturnShipment(asD1(db), "cl1", ship, "boss@x.com", NOW);
    const d = await getOrderDetail(asD1(db), "o1", NOW);
    // 190,000 goods − 70,000 cost − 9,000 return shipment = 111,000.
    expect(d!.money.profitSatang).toBe(111_000);
  });

  it("refuses a claim that was not rejected", async () => {
    const out = await recordClaimReturnShipment(
      asD1(rejected({ state: "received" })),
      "cl1",
      ship,
      "b",
      NOW,
    );
    expect(out.code).toBe(409);
  });

  it("is idempotent: a claim already shipped back is refused", async () => {
    const out = await recordClaimReturnShipment(
      asD1(rejected({ trackingNo: "TH-OLD" })),
      "cl1",
      ship,
      "b",
      NOW,
    );
    expect(out.code).toBe(409);
  });

  it("requires a carrier and tracking number", async () => {
    const out = await recordClaimReturnShipment(
      asD1(rejected()),
      "cl1",
      { carrier: "", trackingNo: "", shippingFeeSatang: 0 },
      "b",
      NOW,
    );
    expect(out.code).toBe(400);
  });

  it("fails without throwing for an unknown claim", async () => {
    const out = await recordClaimReturnShipment(asD1(rejected()), "nope", ship, "b", NOW);
    expect(out.ok).toBe(false);
    expect(out.code).toBe(404);
  });
});

describe("getOrderDetail (the /orders/:id read model)", () => {
  /**
   * One query set behind the whole detail page. Tested against real sqlite because the risk here is
   * relational, not arithmetic: an order with no customer, no address, no lines or no claims must
   * still render rather than throw, and the claim/timeline lists must not fan the order out.
   */
  const NOW = SQLITE_NOW;

  function seeded(opts: { withCustomer?: boolean; withClaim?: boolean } = {}) {
    const { withCustomer = true, withClaim = false } = opts;
    const db = migratedDb();
    db.prepare(`INSERT INTO products (id, name, created_at) VALUES ('p1','คอยล์ร้อน Vios',?)`).run(
      NOW,
    );
    db.prepare(
      `INSERT INTO product_variants (id, product_id, sku, created_at) VALUES ('v1','p1','SKU-1',?)`,
    ).run(NOW);

    if (withCustomer) {
      db.prepare(
        `INSERT INTO storefront_customers
           (id, phone, name, created_at, updated_at, customer_code, credit_score, tier)
         VALUES ('c1','0810000001','สมชาย ใจดี',?,?,'AP-8F2C41A9',4,'good')`,
      ).run(NOW, NOW);
    }
    db.prepare(
      `INSERT INTO sales_orders
         (id, channel, external_order_id, order_status, payment_status, subtotal_satang,
          discount_total_satang, shipping_fee_satang, grand_total_satang, profit_satang,
          order_created_at, imported_at, buyer_username, storefront_customer_id, staff_note)
       VALUES ('o1','airplus','AP-1','packing','paid',200000,10000,5000,195000,60000,?,?,
               'somchai99',?,'ลูกค้าขอเลื่อนส่ง')`,
    ).run(NOW, NOW, withCustomer ? "c1" : null);
    db.prepare(
      `INSERT INTO sales_order_lines
         (id, sales_order_id, product_variant_id, quantity, unit_price_satang, unit_cost_satang,
          line_total_satang, created_at)
       VALUES ('l1','o1','v1',2,100000,70000,200000,?)`,
    ).run(NOW);
    db.prepare(
      `INSERT INTO order_status_history
         (id, order_id, order_status, payment_status, event, actor_email, created_at)
       VALUES ('h1','o1','new','pending','created',NULL,?), ('h2','o1','packing','paid','paid','s@x.com',?)`,
    ).run(NOW, NOW + 1000);

    if (withClaim) {
      db.prepare(
        `INSERT INTO order_claims (id, sales_order_id, kind, state, created_at, updated_at)
         VALUES ('cl1','o1','defect','received',?,?)`,
      ).run(NOW, NOW);
      db.prepare(
        `INSERT INTO order_claim_lines (id, claim_id, sales_order_line_id, quantity)
         VALUES ('cll1','cl1','l1',1)`,
      ).run();
    }
    return db;
  }

  it("returns the order with its money figures, profit included", async () => {
    const d = await getOrderDetail(asD1(seeded()), "o1");
    expect(d).not.toBeNull();
    expect(d!.order.grandTotalSatang).toBe(195000);
    expect(d!.order.discountTotalSatang).toBe(10000);
    expect(d!.order.shippingFeeSatang).toBe(5000);
    expect(d!.order.profitSatang).toBe(60000);
  });

  it("returns the staff note", async () => {
    const d = await getOrderDetail(asD1(seeded()), "o1");
    expect(d!.order.staffNote).toBe("ลูกค้าขอเลื่อนส่ง");
  });

  it("returns the customer WITH tier and credit, which the orders list does not carry", async () => {
    const d = await getOrderDetail(asD1(seeded()), "o1");
    expect(d!.customer).not.toBeNull();
    expect(d!.customer!.customerCode).toBe("AP-8F2C41A9");
    expect(d!.customer!.tier).toBe("good");
    expect(d!.customer!.creditScore).toBe(4);
  });

  it("given an order with no linked customer > returns null customer, not an error", async () => {
    // Imported orders and any legacy row have no storefront account.
    const d = await getOrderDetail(asD1(seeded({ withCustomer: false })), "o1");
    expect(d).not.toBeNull();
    expect(d!.customer).toBeNull();
  });

  it("returns the line items with product name and sku", async () => {
    const d = await getOrderDetail(asD1(seeded()), "o1");
    expect(d!.lines).toHaveLength(1);
    expect(d!.lines[0]!.name).toBe("คอยล์ร้อน Vios");
    expect(d!.lines[0]!.sku).toBe("SKU-1");
    expect(d!.lines[0]!.quantity).toBe(2);
  });

  it("returns the timeline newest-first, matching the Shopee reference", async () => {
    const d = await getOrderDetail(asD1(seeded()), "o1");
    expect(d!.timeline.map((t) => t.event)).toEqual(["paid", "created"]);
  });

  it("returns claims with the lines they cover", async () => {
    const d = await getOrderDetail(asD1(seeded({ withClaim: true })), "o1");
    expect(d!.claims).toHaveLength(1);
    expect(d!.claims[0]!.state).toBe("received");
    expect(d!.claims[0]!.lines.map((l) => l.salesOrderLineId)).toEqual(["l1"]);
  });

  it("given no claims > returns an empty array, never null", async () => {
    const d = await getOrderDetail(asD1(seeded()), "o1");
    expect(d!.claims).toEqual([]);
  });

  it("the claim and timeline lists do not duplicate the order", async () => {
    // The bug this guards: joining lines/timeline/claims in one query fans the order row out.
    const d = await getOrderDetail(asD1(seeded({ withClaim: true })), "o1");
    expect(d!.order.id).toBe("o1");
    expect(d!.lines).toHaveLength(1);
    expect(d!.timeline).toHaveLength(2);
  });

  it("given an id that does not exist > returns null", async () => {
    expect(await getOrderDetail(asD1(seeded()), "nope")).toBeNull();
  });

  it("given a Shopee order > returns null; this page is AirPlus-only", async () => {
    const db = seeded();
    db.prepare(
      `INSERT INTO sales_orders (id, channel, external_order_id, imported_at)
       VALUES ('sp1','shopee','SP-1',?)`,
    ).run(NOW);
    expect(await getOrderDetail(asD1(db), "sp1")).toBeNull();
  });

  it("surfaces the stored slip image key (migration 0074, super-admin evidence)", async () => {
    const db = seeded();
    db.prepare(`UPDATE sales_orders SET slip_image_key = 'slip/o1/a.jpg' WHERE id='o1'`).run();
    const d = await getOrderDetail(asD1(db), "o1");
    expect(d!.order.slipImageKey).toBe("slip/o1/a.jpg");
  });

  it("given no slip uploaded > slipImageKey is null", async () => {
    const d = await getOrderDetail(asD1(seeded()), "o1");
    expect(d!.order.slipImageKey).toBeNull();
  });

  it("parses claim photo_keys JSON into an array of keys", async () => {
    const db = seeded({ withClaim: true });
    db.prepare(`UPDATE order_claims SET photo_keys = ? WHERE id='cl1'`).run(
      JSON.stringify(["claim/cl1/1.jpg", "claim/cl1/2.jpg"]),
    );
    const d = await getOrderDetail(asD1(db), "o1");
    expect(d!.claims[0]!.photoKeys).toEqual(["claim/cl1/1.jpg", "claim/cl1/2.jpg"]);
  });

  it("given a claim with malformed or absent photo_keys > photoKeys is an empty array", async () => {
    const db = seeded({ withClaim: true });
    db.prepare(`UPDATE order_claims SET photo_keys = 'not json' WHERE id='cl1'`).run();
    const d = await getOrderDetail(asD1(db), "o1");
    expect(d!.claims[0]!.photoKeys).toEqual([]);
  });
});

describe("transitionClaim (the claim gates, server-side)", () => {
  /**
   * The UI only offers legal moves, but the UI is not the guard — a stale tab or a hand-rolled
   * request must not be able to jump a gate. So the API re-checks canTransition/actorFor itself.
   * The gate that matters most: nothing reaches a replacement delivery without a mechanic passing
   * it, and nothing is cancelled once we are physically holding the customer's product.
   */
  const NOW = SQLITE_NOW;

  function seeded(state = "requested") {
    const db = migratedDb();
    db.prepare(
      `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status, imported_at)
       VALUES ('o1','airplus','AP-1','delivered','paid',?)`,
    ).run(NOW);
    db.prepare(
      `INSERT INTO order_claims (id, sales_order_id, kind, state, created_at, updated_at)
       VALUES ('cl1','o1','defect',?,?,?)`,
    ).run(state, NOW, NOW);
    return db;
  }

  const stateOf = (db: DatabaseSync) =>
    (db.prepare(`SELECT state FROM order_claims WHERE id='cl1'`).get() as { state: string }).state;

  it("allows a legal admin move and records who made it", async () => {
    const db = seeded("requested");
    // No pre-approve gate: the admin's first move on a fresh claim is confirming the item arrived.
    const out = await transitionClaim(asD1(db), "cl1", "received", "owner@airplusauto.com", NOW);
    expect(out.ok).toBe(true);
    expect(stateOf(db)).toBe("received");
  });

  it("cancel (legacy approved → cancelled) records the reason + assignee and frees the order to delivered", async () => {
    const db = migratedDb();
    // A pending claim holds the order on claim_pending; cancelling it must return it to delivered so
    // the order does not stick on "Claim pending" forever. (Cancel is now a legacy-only path from the
    // old `approved` state; fresh claims are rejected by the mechanic instead.)
    db.prepare(
      `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status, imported_at)
       VALUES ('o1','airplus','AP-1','claim_pending','paid',?)`,
    ).run(NOW);
    db.prepare(
      `INSERT INTO order_claims (id, sales_order_id, kind, state, created_at, updated_at)
       VALUES ('cl1','o1','defect','approved',?,?)`,
    ).run(NOW, NOW);
    const out = await transitionClaim(asD1(db), "cl1", "cancelled", "boss@x.com", NOW, {
      note: "ปิดเคส (เดิม)",
      assignee: "mech@x.com",
    });
    expect(out.ok).toBe(true);
    const claim = db
      .prepare(
        `SELECT state, admin_note AS note, assignee_name AS assignee FROM order_claims WHERE id='cl1'`,
      )
      .get() as { state: string; note: string; assignee: string };
    expect(claim).toMatchObject({
      state: "cancelled",
      note: "ปิดเคส (เดิม)",
      assignee: "mech@x.com",
    });
    const order = db.prepare(`SELECT order_status AS s FROM sales_orders WHERE id='o1'`).get() as {
      s: string;
    };
    expect(order.s).toBe("delivered");
  });

  it("REFUSES skipping the mechanic to ship a replacement", async () => {
    const db = seeded("received");
    const out = await transitionClaim(asD1(db), "cl1", "shipped", "owner@airplusauto.com", NOW);
    expect(out.ok).toBe(false);
    expect(stateOf(db)).toBe("received");
  });

  it("REFUSES a mechanic verdict on goods that never arrived", async () => {
    const db = seeded("requested");
    const out = await transitionClaim(asD1(db), "cl1", "mechanic_approved", "mech@x.com", NOW);
    expect(out.ok).toBe(false);
    expect(stateOf(db)).toBe("requested");
  });

  it("REFUSES cancelling once we hold the customer's product", async () => {
    const db = seeded("received");
    const out = await transitionClaim(asD1(db), "cl1", "cancelled", "owner@airplusauto.com", NOW);
    expect(out.ok).toBe(false);
    expect(stateOf(db)).toBe("received");
  });

  it("refuses to leave a terminal state", async () => {
    const db = seeded("done");
    const out = await transitionClaim(asD1(db), "cl1", "shipped", "owner@airplusauto.com", NOW);
    expect(out.ok).toBe(false);
    expect(stateOf(db)).toBe("done");
  });

  it("refuses an invented state outright", async () => {
    const db = seeded("requested");
    const out = await transitionClaim(asD1(db), "cl1", "approved_maybe", "o@x.com", NOW);
    expect(out.ok).toBe(false);
    expect(stateOf(db)).toBe("requested");
  });

  it("stamps the mechanic's verdict on the claim, not the admin fields", async () => {
    const db = seeded("received");
    await transitionClaim(asD1(db), "cl1", "mechanic_approved", "mech@airplusauto.com", NOW);
    const row = db
      .prepare(
        `SELECT mechanic_name, mechanic_decided_at, admin_email FROM order_claims WHERE id='cl1'`,
      )
      .get() as {
      mechanic_name: string | null;
      mechanic_decided_at: number | null;
      admin_email: string | null;
    };
    expect(row.mechanic_name).toBe("mech@airplusauto.com");
    expect(row.mechanic_decided_at).toBe(NOW);
    expect(row.admin_email).toBeNull();
  });

  it("stamps the admin's decision on the admin fields, not the mechanic's", async () => {
    const db = seeded("requested");
    await transitionClaim(asD1(db), "cl1", "received", "owner@airplusauto.com", NOW);
    const row = db
      .prepare(
        `SELECT admin_email, admin_decided_at, mechanic_name FROM order_claims WHERE id='cl1'`,
      )
      .get() as {
      admin_email: string | null;
      admin_decided_at: number | null;
      mechanic_name: string | null;
    };
    expect(row.admin_email).toBe("owner@airplusauto.com");
    expect(row.admin_decided_at).toBe(NOW);
    expect(row.mechanic_name).toBeNull();
  });

  it("mirrors the claim onto the order's status so /orders reflects it", async () => {
    const db = seeded("received");
    await transitionClaim(asD1(db), "cl1", "mechanic_approved", "mech@x.com", NOW);
    const o = db.prepare(`SELECT order_status FROM sales_orders WHERE id='o1'`).get() as {
      order_status: string;
    };
    expect(o.order_status).toBe("claimed");
  });

  it("the exchange drop-off records the replacement carrier + tracking + shipping fee on the claim", async () => {
    const db = seeded("mechanic_approved");
    const out = await transitionClaim(asD1(db), "cl1", "shipped", "owner@airplusauto.com", NOW, {
      carrier: "Flash",
      trackingNo: "TH99887766",
      shippingFeeSatang: 8000,
    });
    expect(out.ok).toBe(true);
    const row = db
      .prepare(
        `SELECT state, carrier, tracking_no AS trackingNo, shipping_fee_satang AS fee
         FROM order_claims WHERE id='cl1'`,
      )
      .get() as {
      state: string;
      carrier: string | null;
      trackingNo: string | null;
      fee: number | null;
    };
    expect(row).toMatchObject({
      state: "shipped",
      carrier: "Flash",
      trackingNo: "TH99887766",
      fee: 8000,
    });
  });

  it("a cancelled (legacy) claim leaves no mark on the order", async () => {
    const db = seeded("approved");
    await transitionClaim(asD1(db), "cl1", "cancelled", "owner@airplusauto.com", NOW);
    const o = db.prepare(`SELECT order_status FROM sales_orders WHERE id='o1'`).get() as {
      order_status: string;
    };
    // Nothing shipped, no verdict reached — the order is still simply delivered.
    expect(o.order_status).toBe("delivered");
  });

  it("given a claim id that does not exist > fails without throwing", async () => {
    const db = seeded();
    const out = await transitionClaim(asD1(db), "nope", "approved", "o@x.com", NOW);
    expect(out.ok).toBe(false);
  });
});

describe("createClaim (admin raises a claim on the customer's behalf)", () => {
  /**
   * The owner's flow starts with the customer making contact — by phone or LINE — so the admin
   * raises the claim. The validation here is what stops a phone call turning into corrupt data:
   * claiming lines from someone else's order, claiming more units than were ever bought, or
   * claiming goods the customer has not received yet.
   */
  const NOW = SQLITE_NOW;

  function seeded(orderStatus = "delivered") {
    const db = migratedDb();
    db.prepare(`INSERT INTO products (id, name, created_at) VALUES ('p1','Coil',?)`).run(NOW);
    db.prepare(
      `INSERT INTO product_variants (id, product_id, created_at) VALUES ('v1','p1',?), ('v2','p1',?)`,
    ).run(NOW, NOW);
    db.prepare(
      `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status, imported_at)
       VALUES ('o1','airplus','AP-1',?,'paid',?), ('o2','airplus','AP-2','delivered','paid',?)`,
    ).run(orderStatus, NOW, NOW);
    db.prepare(
      `INSERT INTO sales_order_lines
         (id, sales_order_id, product_variant_id, quantity, unit_price_satang, line_total_satang, created_at)
       VALUES ('l1','o1','v1',3,100000,300000,?), ('l2','o1','v2',1,50000,50000,?),
              ('lx','o2','v1',1,100000,100000,?)`,
    ).run(NOW, NOW, NOW);
    return db;
  }

  const claimsIn = (db: DatabaseSync) =>
    db.prepare(`SELECT id, kind, state FROM order_claims`).all() as {
      id: string;
      kind: string;
      state: string;
    }[];

  it("creates a claim that opens at `requested`, awaiting the admin's own contact", async () => {
    const db = seeded();
    const out = await createClaim(
      asD1(db),
      "o1",
      { kind: "defect", reasonNote: "คอยล์รั่ว", lines: [{ salesOrderLineId: "l1", quantity: 1 }] },
      "owner@airplusauto.com",
      NOW,
    );
    expect(out.ok).toBe(true);
    expect(claimsIn(db)[0]!.state).toBe("requested");
    expect(claimsIn(db)[0]!.kind).toBe("defect");
  });

  it("records the claimed lines and quantities", async () => {
    const db = seeded();
    await createClaim(
      asD1(db),
      "o1",
      {
        kind: "wrong_item",
        reasonNote: "ส่งผิดรุ่น",
        lines: [
          { salesOrderLineId: "l1", quantity: 2 },
          { salesOrderLineId: "l2", quantity: 1 },
        ],
      },
      "owner@airplusauto.com",
      NOW,
    );
    const rows = db
      .prepare(`SELECT sales_order_line_id AS l, quantity FROM order_claim_lines ORDER BY l`)
      .all() as { l: string; quantity: number }[];
    expect(rows).toEqual([
      { l: "l1", quantity: 2 },
      { l: "l2", quantity: 1 },
    ]);
  });

  it("moves the order to claim_pending so /orders shows it", async () => {
    const db = seeded();
    await createClaim(
      asD1(db),
      "o1",
      { kind: "defect", reasonNote: "x", lines: [{ salesOrderLineId: "l1", quantity: 1 }] },
      "o@x.com",
      NOW,
    );
    const o = db.prepare(`SELECT order_status FROM sales_orders WHERE id='o1'`).get() as {
      order_status: string;
    };
    expect(o.order_status).toBe("claim_pending");
  });

  it("REFUSES a line belonging to a different order", async () => {
    const db = seeded();
    const out = await createClaim(
      asD1(db),
      "o1",
      { kind: "defect", reasonNote: "x", lines: [{ salesOrderLineId: "lx", quantity: 1 }] },
      "o@x.com",
      NOW,
    );
    expect(out.ok).toBe(false);
    expect(claimsIn(db)).toEqual([]);
  });

  it("REFUSES claiming more units than were bought", async () => {
    const db = seeded();
    const out = await createClaim(
      asD1(db),
      "o1",
      { kind: "defect", reasonNote: "x", lines: [{ salesOrderLineId: "l1", quantity: 4 }] },
      "o@x.com",
      NOW,
    );
    expect(out.ok).toBe(false);
    expect(claimsIn(db)).toEqual([]);
  });

  it("allows claiming exactly the quantity bought", async () => {
    const db = seeded();
    const out = await createClaim(
      asD1(db),
      "o1",
      { kind: "defect", reasonNote: "x", lines: [{ salesOrderLineId: "l1", quantity: 3 }] },
      "o@x.com",
      NOW,
    );
    expect(out.ok).toBe(true);
  });

  it("REFUSES a claim on goods the customer has not received", async () => {
    // Nothing has been delivered, so there is nothing to be defective or wrongly sent.
    for (const s of ["new", "packing", "shipped"]) {
      const db = seeded(s);
      const out = await createClaim(
        asD1(db),
        "o1",
        { kind: "defect", reasonNote: "x", lines: [{ salesOrderLineId: "l1", quantity: 1 }] },
        "o@x.com",
        NOW,
      );
      expect(out.ok).toBe(false);
      expect(claimsIn(db)).toEqual([]);
    }
  });

  it("ALLOWS a second claim after a replacement itself fails", async () => {
    // The owner's words: a replacement can itself fail. So `claimed` must still accept a new claim.
    const db = seeded("claimed");
    const out = await createClaim(
      asD1(db),
      "o1",
      {
        kind: "defect",
        reasonNote: "อันใหม่ก็เสีย",
        lines: [{ salesOrderLineId: "l1", quantity: 1 }],
      },
      "o@x.com",
      NOW,
    );
    expect(out.ok).toBe(true);
  });

  it("REFUSES an empty line list — a claim must say what it covers", async () => {
    const db = seeded();
    const out = await createClaim(
      asD1(db),
      "o1",
      { kind: "defect", reasonNote: "x", lines: [] },
      "o@x.com",
      NOW,
    );
    expect(out.ok).toBe(false);
  });

  it("REFUSES a reason that is neither a wrong item nor a defect", async () => {
    const db = seeded();
    const out = await createClaim(
      asD1(db),
      "o1",
      { kind: "changed_mind", reasonNote: "x", lines: [{ salesOrderLineId: "l1", quantity: 1 }] },
      "o@x.com",
      NOW,
    );
    expect(out.ok).toBe(false);
  });

  it("REFUSES the same line twice in one claim", async () => {
    const db = seeded();
    const out = await createClaim(
      asD1(db),
      "o1",
      {
        kind: "defect",
        reasonNote: "x",
        lines: [
          { salesOrderLineId: "l1", quantity: 1 },
          { salesOrderLineId: "l1", quantity: 1 },
        ],
      },
      "o@x.com",
      NOW,
    );
    expect(out.ok).toBe(false);
  });

  it("records who raised it and writes a timeline entry", async () => {
    const db = seeded();
    await createClaim(
      asD1(db),
      "o1",
      { kind: "defect", reasonNote: "x", lines: [{ salesOrderLineId: "l1", quantity: 1 }] },
      "owner@airplusauto.com",
      NOW,
    );
    const c = db.prepare(`SELECT admin_email FROM order_claims`).get() as { admin_email: string };
    expect(c.admin_email).toBe("owner@airplusauto.com");
    const h = db
      .prepare(`SELECT COUNT(*) n FROM order_status_history WHERE order_id='o1'`)
      .get() as { n: number };
    expect(h.n).toBeGreaterThan(0);
  });

  it("given an order that does not exist > fails without throwing", async () => {
    const db = seeded();
    const out = await createClaim(
      asD1(db),
      "nope",
      { kind: "defect", reasonNote: "x", lines: [{ salesOrderLineId: "l1", quantity: 1 }] },
      "o@x.com",
      NOW,
    );
    expect(out.ok).toBe(false);
  });
});

describe("updateOrder > staff note", () => {
  const NOW = SQLITE_NOW;
  function seeded() {
    const db = migratedDb();
    db.prepare(
      `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status, imported_at)
       VALUES ('o1','airplus','AP-1','packing','paid',?)`,
    ).run(NOW);
    db.prepare(`DELETE FROM order_status_history`).run();
    return db;
  }
  const noteOf = (db: DatabaseSync) =>
    (
      db.prepare(`SELECT staff_note FROM sales_orders WHERE id='o1'`).get() as {
        staff_note: string | null;
      }
    ).staff_note;

  it("saves a note", async () => {
    const db = seeded();
    await updateOrder(asD1(db), "o1", { staffNote: "ลูกค้าขอเลื่อนส่ง" }, "o@x.com", NOW);
    expect(noteOf(db)).toBe("ลูกค้าขอเลื่อนส่ง");
  });

  it("clears a note when emptied", async () => {
    const db = seeded();
    await updateOrder(asD1(db), "o1", { staffNote: "x" }, "o@x.com", NOW);
    await updateOrder(asD1(db), "o1", { staffNote: "" }, "o@x.com", NOW);
    expect(noteOf(db)).toBeNull();
  });

  it("leaves the note alone when the patch does not mention it", async () => {
    const db = seeded();
    await updateOrder(asD1(db), "o1", { staffNote: "keep me" }, "o@x.com", NOW);
    await updateOrder(asD1(db), "o1", { carrier: "Flash Express" }, "o@x.com", NOW);
    expect(noteOf(db)).toBe("keep me");
  });

  it("writing a note is NOT a timeline event", async () => {
    // A note is a scratchpad, not a state change. Logging it would bury real transitions.
    const db = seeded();
    await updateOrder(asD1(db), "o1", { staffNote: "just a note" }, "o@x.com", NOW);
    const n = db.prepare(`SELECT COUNT(*) n FROM order_status_history`).get() as { n: number };
    expect(n.n).toBe(0);
  });
});

describe("order shipping breakdown (migration 0073 + the drop-off write)", () => {
  /**
   * The owner's brief, 30 Jul 2026: /orders/:id shows four shipping figures — what our calculator
   * quoted, what we offered on a shared-fee order, what the customer paid, and what landed on us —
   * and the real carrier charge is typed in after the parcel is dropped off.
   *
   * Real sqlite because the risk is relational and positional: updateOrder is read-first with an
   * explicit column list and a positional bind list, so a new money column can be silently dropped
   * from the SELECT or bound in the wrong slot and still type-check.
   */
  const NOW = SQLITE_NOW;

  function seeded(
    opts: {
      orderStatus?: string | null;
      paymentStatus?: string | null;
      auto?: number;
      offer?: number | null;
      real?: number | null;
      profit?: number | null;
    } = {},
  ) {
    const {
      orderStatus = "packing",
      paymentStatus = "paid",
      auto = 5_000,
      offer = null,
      real = null,
      profit = 140_000,
    } = opts;
    const db = migratedDb();
    db.prepare(
      `INSERT INTO products (id, name, created_at) VALUES ('p1','คอมเพรสเซอร์ Denso',?)`,
    ).run(NOW);
    db.prepare(
      `INSERT INTO product_variants (id, product_id, sku, created_at) VALUES ('v1','p1','SKU-1',?)`,
    ).run(NOW);
    db.prepare(
      `INSERT INTO sales_orders
         (id, channel, external_order_id, order_status, payment_status, subtotal_satang,
          discount_total_satang, shipping_fee_satang, grand_total_satang, profit_satang,
          shipping_auto_satang, shipping_offer_satang, shipping_real_satang,
          order_created_at, imported_at, buyer_username)
       VALUES ('o1','airplus','AP-1',?,?,450000,20000,5000,435000,?,?,?,?,?,?,'somchai99')`,
    ).run(orderStatus, paymentStatus, profit, auto, offer, real, NOW, NOW);
    db.prepare(
      `INSERT INTO sales_order_lines
         (id, sales_order_id, product_variant_id, quantity, unit_price_satang, unit_cost_satang,
          line_total_satang, created_at)
       VALUES ('l1','o1','v1',2,225000,145000,450000,?)`,
    ).run(NOW);
    return db;
  }

  const feesOf = (db: DatabaseSync) =>
    db
      .prepare(
        `SELECT shipping_auto_satang a, shipping_offer_satang o, shipping_real_satang r,
                shipping_fee_satang c, carrier, tracking_no t, order_status s
         FROM sales_orders WHERE id='o1'`,
      )
      .get() as Record<string, unknown>;

  it("migration 0073 backfills the auto fee from what the customer was charged", async () => {
    // Every order that exists today was charged exactly what we quoted, so that IS the true
    // historical value. A plain 0 default would report every past parcel as having been quoted free,
    // and the quote-gap report would then show a fictional shortfall on all of them.
    //
    // Applied in two halves against one database, because the order matters: the row has to exist
    // BEFORE 0073 runs for the backfill to have anything to do. migratedDb() applies everything up
    // front, so it cannot see this.
    const db = new DatabaseSync(":memory:");
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const cut = files.findIndex((f) => f.startsWith("0073_"));
    expect(cut).toBeGreaterThan(0);
    for (const f of files.slice(0, cut)) db.exec(readFileSync(join(migrationsDir, f), "utf8"));

    db.prepare(
      `INSERT INTO sales_orders
         (id, channel, external_order_id, subtotal_satang, discount_total_satang,
          shipping_fee_satang, grand_total_satang, imported_at)
       VALUES ('legacy','airplus','AP-OLD',100000,0,7500,107500,?)`,
    ).run(NOW);

    for (const f of files.slice(cut)) db.exec(readFileSync(join(migrationsDir, f), "utf8"));

    const row = db
      .prepare(
        `SELECT shipping_auto_satang a, shipping_offer_satang o, shipping_real_satang r
         FROM sales_orders WHERE id='legacy'`,
      )
      .get() as { a: number; o: number | null; r: number | null };
    expect(row.a).toBe(7500);
    // The other two stay unknown: we never offered a shared fee on a past order, and nobody typed in
    // what Flash charged. Defaulting either to 0 would invent a measurement.
    expect(row.o).toBeNull();
    expect(row.r).toBeNull();
  });

  it("getOrderDetail returns all three new shipping figures", async () => {
    const d = await getOrderDetail(
      asD1(seeded({ auto: 26_000, offer: 12_000, real: 27_500 })),
      "o1",
    );
    expect(d!.order.shippingAutoSatang).toBe(26_000);
    expect(d!.order.shippingOfferSatang).toBe(12_000);
    expect(d!.order.shippingRealSatang).toBe(27_500);
  });

  it("a normal order has no offered fee, which is what marks it as not shared-fee", async () => {
    const d = await getOrderDetail(asD1(seeded()), "o1");
    expect(d!.order.shippingOfferSatang).toBeNull();
  });

  it("getOrderDetail derives both money books so the page never computes them itself", async () => {
    const d = await getOrderDetail(asD1(seeded({ real: 9_000 })), "o1");
    expect(d!.money.customerPaidSatang).toBe(435_000);
    expect(d!.money.goodsAfterDiscountSatang).toBe(430_000);
    expect(d!.money.itemCostSatang).toBe(290_000);
    expect(d!.money.shippingShortfallSatang).toBe(4_000);
    expect(d!.money.profitSatang).toBe(136_000);
  });

  it("before drop-off the shortfall is unknown, not zero", async () => {
    const d = await getOrderDetail(asD1(seeded()), "o1");
    expect(d!.money.shippingShortfallSatang).toBeNull();
    expect(d!.money.profitSatang).toBe(140_000);
  });

  it("derived profit ignores the stale stored profit_satang", async () => {
    // profit_satang says 140,000 because checkout excludes shipping. Once a ฿90 parcel is recorded
    // against a ฿50 charge the truth is 136,000, and the page must show the truth.
    const db = seeded({ real: 9_000, profit: 140_000 });
    const d = await getOrderDetail(asD1(db), "o1");
    expect(d!.order.profitSatang).toBe(140_000);
    expect(d!.money.profitSatang).toBe(136_000);
  });

  it("unmatched SKUs > derived profit stays null rather than claiming the whole order", async () => {
    const d = await getOrderDetail(asD1(seeded({ real: 9_000, profit: null })), "o1");
    expect(d!.money.profitSatang).toBeNull();
    expect(d!.money.shippingShortfallSatang).toBe(4_000);
  });

  it("recording a drop-off persists carrier, tracking and the real charge together", async () => {
    const db = seeded();
    await updateOrder(
      asD1(db),
      "o1",
      {
        carrier: "Flash Express",
        trackingNo: "TH26104508613",
        shippingRealSatang: 9_000,
        orderStatus: "shipped",
      },
      "o@x.com",
      NOW,
    );
    const f = feesOf(db);
    expect(f.carrier).toBe("Flash Express");
    expect(f.t).toBe("TH26104508613");
    expect(f.r).toBe(9_000);
    expect(f.s).toBe("shipped");
  });

  it("the drop-off leaves To ship, which needs order_status shipped", async () => {
    // to_ship is DERIVED from the payment axis, so a write that only sets carrier and tracking
    // leaves the order reading "To ship" forever and the form never disappears.
    const db = seeded();
    await updateOrder(
      asD1(db),
      "o1",
      {
        carrier: "Flash Express",
        trackingNo: "TH1",
        shippingRealSatang: 9_000,
        orderStatus: "shipped",
      },
      "o@x.com",
      NOW,
    );
    const d = await getOrderDetail(asD1(db), "o1");
    expect(operationalStatus(d!.order.orderStatus, d!.order.paymentStatus)).toBe("in_transit");
  });

  it("the drop-off writes exactly one timeline entry, for the shipping", async () => {
    const db = seeded();
    await updateOrder(
      asD1(db),
      "o1",
      {
        carrier: "Flash Express",
        trackingNo: "TH1",
        shippingRealSatang: 9_000,
        orderStatus: "shipped",
      },
      "o@x.com",
      NOW,
    );
    const rows = db.prepare(`SELECT event FROM order_status_history WHERE order_id='o1'`).all() as {
      event: string;
    }[];
    expect(rows.map((r) => r.event)).toEqual(["shipped"]);
  });

  it("a real charge on an unpaid order is refused", async () => {
    // Nonsense that would land straight in the owner's profit figure: nobody hands a carrier a
    // parcel for an order that has not been paid for.
    const db = seeded({ paymentStatus: "pending", orderStatus: "new" });
    const out = await updateOrder(asD1(db), "o1", { shippingRealSatang: 9_000 }, "o@x.com", NOW);
    expect(out.ok).toBe(false);
    expect(!out.ok && out.code).toBe(409);
    expect(feesOf(db).r).toBeNull();
  });

  it("a real charge on a COD order awaiting approval is refused", async () => {
    // COD not yet approved by the owner. cod_confirmed is the value that means "we will send it".
    const db = seeded({ paymentStatus: "cod", orderStatus: "new" });
    const out = await updateOrder(asD1(db), "o1", { shippingRealSatang: 9_000 }, "o@x.com", NOW);
    expect(!out.ok && out.code).toBe(409);
    expect(feesOf(db).r).toBeNull();
  });

  it("a refused drop-off writes nothing at all, not even the carrier alongside it", async () => {
    const db = seeded({ paymentStatus: "pending", orderStatus: "new" });
    await updateOrder(
      asD1(db),
      "o1",
      { carrier: "Flash Express", trackingNo: "TH1", shippingRealSatang: 9_000 },
      "o@x.com",
      NOW,
    );
    const f = feesOf(db);
    expect([f.carrier, f.t, f.r]).toEqual([null, null, null]);
  });

  it("a COD-confirmed order may record a drop-off — the money is settled enough to send", async () => {
    const db = seeded({ paymentStatus: "cod_confirmed" });
    await updateOrder(asD1(db), "o1", { shippingRealSatang: 9_000 }, "o@x.com", NOW);
    expect(feesOf(db).r).toBe(9_000);
  });

  it("the real charge can still be corrected after the parcel has shipped", async () => {
    // A typo at the counter must be fixable; gating on to_ship itself would freeze the wrong number
    // in place forever.
    const db = seeded({ orderStatus: "shipped", real: 9_000 });
    await updateOrder(asD1(db), "o1", { shippingRealSatang: 8_500 }, "o@x.com", NOW);
    expect(feesOf(db).r).toBe(8_500);
  });

  it("the offered fee is patchable, by hand, until the auto-apply rule exists", async () => {
    const db = seeded();
    await updateOrder(asD1(db), "o1", { shippingOfferSatang: 12_000 }, "o@x.com", NOW);
    expect(feesOf(db).o).toBe(12_000);
  });

  it("a patch that does not mention the fees leaves every one of them alone", async () => {
    // updateOrder is read-first with a positional UPDATE; this is the shape that silently wiped the
    // staff note before, so it is worth pinning for money too.
    const db = seeded({ auto: 26_000, offer: 12_000, real: 27_500 });
    await updateOrder(asD1(db), "o1", { staffNote: "unrelated" }, "o@x.com", NOW);
    const f = feesOf(db);
    expect([f.a, f.o, f.r]).toEqual([26_000, 12_000, 27_500]);
  });

  it("the PATCH response carries the shipping fee it was previously dropping", async () => {
    // OrderRow declares shippingFeeSatang as required but updateOrder's SELECT omitted it, so every
    // PATCH response shipped `undefined` while typed as a number. The derivation needs it.
    const db = seeded();
    const out = await updateOrder(asD1(db), "o1", { carrier: "Flash Express" }, "o@x.com", NOW);
    expect(out.ok && out.order.shippingFeeSatang).toBe(5_000);
  });

  it("clearing the real charge with null puts the order back to not-measured", async () => {
    const db = seeded({ real: 9_000 });
    await updateOrder(asD1(db), "o1", { shippingRealSatang: null }, "o@x.com", NOW);
    expect(feesOf(db).r).toBeNull();
  });
});

describe("getOrderDetail > product brand on each line", () => {
  /**
   * The owner asked for the brand on every line of the shipping label (30 Jul 2026) — a parcel of
   * "คอมเพรสเซอร์ Denso 10PA17C" is easier to check against a receipt when DENSO is printed next to
   * it. products.brand_id is nullable and points at `brands`, so this needs a LEFT JOIN: an INNER one
   * would drop every line whose product has no brand set, and the label would go out short an item.
   */
  const NOW = SQLITE_NOW;

  function seeded() {
    const db = migratedDb();
    // Migration 0005 already seeds the part brands and brands.name is UNIQUE, so use the real DENSO
    // row rather than inserting a second one — which is also closer to production.
    const denso = db.prepare(`SELECT id FROM brands WHERE name = 'DENSO'`).get() as
      { id: string } | undefined;
    expect(denso?.id).toBeTruthy();
    db.prepare(
      `INSERT INTO products (id, name, brand_id, created_at)
       VALUES ('p1','คอมเพรสเซอร์ Denso 10PA17C',?,?)`,
    ).run(denso!.id, NOW);
    // Deliberately no brand_id — the case an INNER JOIN would silently delete.
    db.prepare(
      `INSERT INTO products (id, name, brand_id, created_at)
       VALUES ('p2','น้ำยาแอร์ R134a',NULL,?)`,
    ).run(NOW);
    db.prepare(
      `INSERT INTO product_variants (id, product_id, sku, created_at)
       VALUES ('v1','p1','SKU-1',?), ('v2','p2','SKU-2',?)`,
    ).run(NOW, NOW);
    db.prepare(
      `INSERT INTO sales_orders
         (id, channel, external_order_id, order_status, payment_status, subtotal_satang,
          discount_total_satang, shipping_fee_satang, grand_total_satang, imported_at)
       VALUES ('o1','airplus','AP-1','packing','paid',100000,0,5000,105000,?)`,
    ).run(NOW);
    db.prepare(
      `INSERT INTO sales_order_lines
         (id, sales_order_id, product_variant_id, quantity, unit_price_satang, unit_cost_satang,
          line_total_satang, created_at)
       VALUES ('l1','o1','v1',2,50000,30000,100000,?), ('l2','o1','v2',2,25000,15000,50000,?)`,
    ).run(NOW, NOW + 1);
    return db;
  }

  it("returns the brand name for a line whose product has one", async () => {
    const d = await getOrderDetail(asD1(seeded()), "o1");
    expect(d!.lines[0]!.brand).toBe("DENSO");
  });

  it("given a product with no brand set > null, and the line is still returned", async () => {
    const d = await getOrderDetail(asD1(seeded()), "o1");
    expect(d!.lines).toHaveLength(2);
    expect(d!.lines[1]!.name).toBe("น้ำยาแอร์ R134a");
    expect(d!.lines[1]!.brand).toBeNull();
  });

  it("adding the brand join does not fan the order out into duplicate lines", async () => {
    // brands is one row per product, but a join written against the wrong key would multiply lines
    // and the label would list the same item twice.
    const d = await getOrderDetail(asD1(seeded()), "o1");
    expect(d!.lines.map((l) => l.id)).toEqual(["l1", "l2"]);
  });
});

describe("GET /file/:key — private order evidence serving", () => {
  /** IMAGES double that serves a fixed set of objects. */
  function bucketWith(objects: Record<string, string>): R2Bucket {
    return {
      get: async (key: string) =>
        key in objects ? { body: objects[key], httpMetadata: { contentType: "image/png" } } : null,
    } as unknown as R2Bucket;
  }
  // Access unset here = local-dev fail-open, same as the rest of the API. The super-admin ENFORCEMENT
  // (slip 403 for a non-super email) is unit-tested in packages/core/src/access.test.ts, because
  // reaching this route as an authenticated non-super user needs a real Access JWT.
  const env = (objects: Record<string, string>) =>
    ({ IMAGES: bucketWith(objects) }) as unknown as Env;

  it("serves a claim photo from the claim/ namespace", async () => {
    const res = await worker.fetch!(
      new Request("https://x/file/claim/o1/1.png"),
      env({ "claim/o1/1.png": "PNGBYTES" }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(await res.text()).toBe("PNGBYTES");
  });

  it("serves a slip when Access is off (local dev fail-open)", async () => {
    const res = await worker.fetch!(
      new Request("https://x/file/slip/o1/1.png"),
      env({ "slip/o1/1.png": "SLIP" }),
      ctx,
    );
    expect(res.status).toBe(200);
  });

  it("never serves a private file with a shared-cacheable header", async () => {
    const res = await worker.fetch!(
      new Request("https://x/file/slip/o1/1.png"),
      env({ "slip/o1/1.png": "SLIP" }),
      ctx,
    );
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("404s for a key outside the allow-listed namespaces (no key can reach other objects)", async () => {
    const res = await worker.fetch!(
      new Request("https://x/file/products/leak.png"),
      env({ "products/leak.png": "SECRET" }),
      ctx,
    );
    expect(res.status).toBe(404);
  });

  it("404s when the object is genuinely absent", async () => {
    const res = await worker.fetch!(
      new Request("https://x/file/claim/o1/missing.png"),
      env({}),
      ctx,
    );
    expect(res.status).toBe(404);
  });
});

describe("reviewOrderPayment (confirm / reject a slip awaiting review)", () => {
  const NOW = SQLITE_NOW;
  const DAY = 24 * 60 * 60 * 1000;
  const EXPIRY = 48 * 60 * 60 * 1000;

  function seeded(paymentStatus = "verifying", createdAt = NOW) {
    const db = migratedDb();
    db.prepare(
      `INSERT INTO sales_orders
         (id, channel, external_order_id, order_status, payment_status, subtotal_satang,
          discount_total_satang, shipping_fee_satang, grand_total_satang, profit_satang,
          order_created_at, imported_at, buyer_username)
       VALUES ('o1','airplus','AP-1','new',?,100000,0,4000,104000,30000,?,?,'u1')`,
    ).run(paymentStatus, createdAt, createdAt);
    db.prepare(
      `INSERT INTO payments (id, method_label, promptpay_id, amount_satang, status, created_at, sales_order_id)
       VALUES ('pay1','โอนเงิน','0899999999',104000,'pending',?,'o1')`,
    ).run(NOW);
    return db;
  }
  const order = (db: DatabaseSync) =>
    db
      .prepare(`SELECT payment_status p, payment_expires_at e FROM sales_orders WHERE id='o1'`)
      .get() as { p: string; e: number | null };
  const history = (db: DatabaseSync) =>
    db
      .prepare(
        `SELECT event, note FROM order_status_history WHERE order_id='o1' ORDER BY created_at`,
      )
      .all() as { event: string; note: string | null }[];

  it("confirm > order becomes paid, payment row confirmed, timeline gets a paid entry", async () => {
    const db = seeded();
    const out = await reviewOrderPayment(asD1(db), "o1", "confirm", null, "admin@x.com", NOW);
    expect(out).toEqual({ ok: true, paymentStatus: "paid" });
    expect(order(db).p).toBe("paid");
    expect(
      (db.prepare(`SELECT status FROM payments WHERE id='pay1'`).get() as { status: string })
        .status,
    ).toBe("confirmed");
    expect(history(db).some((h) => h.event === "paid")).toBe(true);
  });

  it("reject with a reason > back to pending with a fresh 48h window and the reason on the timeline", async () => {
    const db = seeded();
    const out = await reviewOrderPayment(asD1(db), "o1", "reject", "ยอดไม่ตรง", "admin@x.com", NOW);
    expect(out).toEqual({ ok: true, paymentStatus: "pending" });
    const o = order(db);
    expect(o.p).toBe("pending");
    expect(o.e).toBe(NOW + EXPIRY);
    expect(
      history(db).some((h) => h.event === "updated" && (h.note ?? "").includes("ยอดไม่ตรง")),
    ).toBe(true);
  });

  it("reject without a reason > 400, and the order is untouched", async () => {
    const db = seeded();
    const out = await reviewOrderPayment(asD1(db), "o1", "reject", "   ", "admin@x.com", NOW);
    expect(out).toMatchObject({ ok: false, code: 400 });
    expect(order(db).p).toBe("verifying");
  });

  it("an order not awaiting review > 409", async () => {
    const db = seeded("paid");
    const out = await reviewOrderPayment(asD1(db), "o1", "confirm", null, "admin@x.com", NOW);
    expect(out).toMatchObject({ ok: false, code: 409 });
  });

  it("a missing order > 404", async () => {
    const out = await reviewOrderPayment(asD1(seeded()), "nope", "confirm", null, "a@x.com", NOW);
    expect(out).toMatchObject({ ok: false, code: 404 });
  });

  it("expireUnpaidOrders honours the fresh window: a rejected order does not expire until it lapses", async () => {
    // Placed 3 days ago (long past the original 48h), rejected just now → fresh window protects it.
    const db = seeded("verifying", NOW - 3 * DAY);
    await reviewOrderPayment(asD1(db), "o1", "reject", "รอลูกค้าโอนใหม่", "a@x.com", NOW);
    expect(await expireUnpaidOrders(asD1(db), NOW)).toBe(0);
    // …but once the fresh window lapses, it expires like any unpaid order.
    expect(await expireUnpaidOrders(asD1(db), NOW + EXPIRY + 1)).toBe(1);
  });

  it("expireUnpaidOrders still expires an ordinary old unpaid order (null window = created + 48h)", async () => {
    const db = seeded("pending", NOW - 3 * DAY);
    expect(await expireUnpaidOrders(asD1(db), NOW)).toBe(1);
  });
});
