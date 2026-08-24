import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createStaffSession,
  staffFromToken,
  revokeStaffSession,
  loginStaff,
  requireStaff,
  STAFF_SESSION_HEADER,
  loginWithPin,
} from "./staffSession";
import {
  listStaff,
  createStaff,
  setStaffPassword,
  updateStaff,
  ownProfile,
  changeOwnPassword,
  setOwnPin,
  recordDayOff,
  revealPassword,
  deleteStaff,
  salaryMonth,
  markSalaryPaid,
  staffActivity,
  staffProfileFor,
  updateStaffProfile,
  clearStaffPin,
  setStaffPin,
  purgeExpiredSalarySlips,
  salarySlipKey,
  staffPayments,
} from "./staffRoutes";
import {
  hashPassword,
  sha256Hex,
  pinLookup,
  LOCK_AFTER_FAILURES,
  LOCK_DURATION_MS,
} from "@l-shopee/core";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import worker, {
  addBarcodeToProduct,
  applyAdjustmentToDb,
  applySyncToDb,
  applyOnlineSaleToDb,
  setProductPaused,
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
  recalculateCustomerCredit,
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
  shopeeSyncWorklist,
  markShopeeSynced,
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
  /** Who the staff-session lookup resolves to. Defaults to a super admin; pass null for nobody. */
  staff?: { userId: string; email: string; name: string; role: string } | null;
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
        // Role-gated routes resolve the staff session before doing anything else. Default to an
        // authenticated super admin so the hundreds of tests written before role enforcement keep
        // testing what they were written to test; the authorisation rules themselves are covered
        // against the REAL schema in "role enforcement on money, catalog and payment routes".
        if (sql.includes("FROM staff_sessions s")) {
          if (canned.staff === null) return null;
          return {
            userId: "u-test",
            email: "boss@shop.test",
            name: "Boss",
            role: "super_admin",
            sessionId: "s-test",
            lastSeenAt: 0,
            ...(canned.staff ?? {}),
          } as T;
        }
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

/**
 * Headers for a request that carries a staff session.
 *
 * Role gates run BEFORE body parsing, so a request with no session is refused without ever being
 * read. Tests that exercise a guarded route's behaviour have to sign in first — the token value is
 * irrelevant to the canned mock, its presence is not.
 */
const AUTHED = { "X-Staff-Session": "test-token" };

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

  it("also matches by bill / sale number, so typing a bill ID finds its car", async () => {
    const { db } = makeDb({});
    const prepare = vi.spyOn(db, "prepare");
    await searchCustomers(db, "DA-25080201");
    const sql = prepare.mock.calls[0]?.[0] as string;
    // A bill number belongs to a plate via onsite_sales; the search must reach it.
    expect(sql).toContain("sale_number LIKE ?");
    expect(sql).toContain("FROM onsite_sales");
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

  it("malformed JSON bodies on money/stock routes never 500 — 400, or 401 behind a role gate", async () => {
    // Original point: a bad body must not crash the Worker. Still true.
    //
    // Since role enforcement (2026-08-24) two of these sit behind a role gate, and a gate runs
    // BEFORE the body is read — so an unauthenticated caller gets 401 and the body is never
    // parsed. That ordering is deliberate: body-validation feedback is information, and someone
    // who has not proved who they are should not be able to probe a route's expectations.
    const guarded = new Set(["/products", "/products/p1/pricing"]);
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
      expect(res.status, `${method} ${path}`).toBe(guarded.has(path) ? 401 : 400);
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
    await worker.fetch!(new Request("https://x/finance/summary", { headers: AUTHED }), env, ctx);
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
        headers: AUTHED,
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
      new Request("https://x/customers/by-plate", {
        method: "PUT",
        headers: AUTHED,
        body: JSON.stringify({}),
      }),
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
    const res = await worker.fetch!(
      new Request("https://x/finance/summary", { headers: AUTHED }),
      env,
      ctx,
    );
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
        headers: AUTHED,
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
        headers: AUTHED,
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
        headers: AUTHED,
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
    staff_sessions:
      "transient: only token hashes. Restoring is worse than losing them — it would revive " +
      "sessions that were revoked (staff removed, device logged out) between backup and restore.",
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

  it("setProductPaused resolves (the reversible half of removing a product)", async () => {
    const { db } = makeDb({});
    await expect(setProductPaused(db, "p1", true)).resolves.toBeUndefined();
  });

  it("DELETE /products/:id without a staff session > 401, it does not archive anything", async () => {
    // This asserted `{ ok: true }` until 2026-08-24, when deleting became super-admin only. The
    // old expectation WAS the bug: any caller reaching this Worker could archive any product.
    // The authorised path is covered against the real schema in "DELETE /products/:id — super
    // admin only", which needs a genuine session row the canned mock cannot provide.
    const { env } = makeDb({});
    const res = await worker.fetch!(
      new Request("https://x/products/p1", { method: "DELETE" }),
      env,
      ctx,
    );
    expect(res.status).toBe(401);
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
    // Carries a slip: these tests move the order to `paid`, which is refused without one. The
    // subject here is the timeline, not the payment rule, so the evidence is simply present.
    db.prepare(
      `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status,
                                 order_created_at, imported_at, slip_image_key)
       VALUES ('o1', 'airplus', 'AP-1', 'new', 'pending', ?, ?, 'slip/o1/a.jpg')`,
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

describe("recalculateCustomerCredit (the demerit credit model, end-to-end)", () => {
  const NOW = SQLITE_NOW;
  const DAY = 86_400_000;

  function seedCustomer(over: { tierOverride?: string | null } = {}) {
    const db = migratedDb();
    db.prepare(
      `INSERT INTO storefront_customers (id, phone, name, created_at, updated_at, customer_code, tier_override)
       VALUES ('c1','0810000000','ทดสอบ',?,?,?,?)`,
    ).run(NOW, NOW, "AP-TEST", over.tierOverride ?? null);
    return db;
  }
  function addOrder(
    db: DatabaseSync,
    i: number,
    orderStatus: string,
    paymentStatus: string,
    grandSatang: number,
    createdAt: number,
  ) {
    db.prepare(
      `INSERT INTO sales_orders
         (id, channel, external_order_id, order_status, payment_status, grand_total_satang,
          order_created_at, imported_at, storefront_customer_id)
       VALUES (?, 'airplus', ?, ?, ?, ?, ?, ?, 'c1')`,
    ).run(`o${i}`, `AP-${i}`, orderStatus, paymentStatus, grandSatang, createdAt, NOW);
  }

  it("a couple of completed orders stay at 0 / good — no per-order inflation", async () => {
    const db = seedCustomer();
    // 2 small completes: below the hold (3) and earn (฿15k) loyalty bars, so no loyalty, no inflation.
    addOrder(db, 1, "delivered", "paid", 100_00, NOW - 2 * DAY);
    addOrder(db, 2, "delivered", "paid", 100_00, NOW - 1 * DAY);
    expect(await recalculateCustomerCredit(asD1(db), "c1", NOW)).toEqual({
      credit: 0,
      tier: "good",
    });
  });

  it("38 completed orders read as loyalty +2 (best), NEVER 38 — the reported bug", async () => {
    const db = seedCustomer();
    for (let i = 0; i < 38; i++) addOrder(db, i, "delivered", "paid", 100_00, NOW - (40 - i) * DAY);
    expect(await recalculateCustomerCredit(asD1(db), "c1", NOW)).toEqual({
      credit: 2,
      tier: "best",
    });
  });

  it("one incomplete → −1 / watch", async () => {
    const db = seedCustomer();
    addOrder(db, 1, "expired", "expired", 100_00, NOW - DAY);
    expect(await recalculateCustomerCredit(asD1(db), "c1", NOW)).toEqual({
      credit: -1,
      tier: "watch",
    });
  });

  it("a mistake then 2 later completions recovers to 0 / good", async () => {
    const db = seedCustomer();
    addOrder(db, 1, "expired", "expired", 100_00, NOW - 3 * DAY);
    addOrder(db, 2, "delivered", "paid", 100_00, NOW - 2 * DAY);
    addOrder(db, 3, "delivered", "paid", 100_00, NOW - 1 * DAY);
    expect(await recalculateCustomerCredit(asD1(db), "c1", NOW)).toEqual({
      credit: 0,
      tier: "good",
    });
  });

  it("a loyal customer (฿20k recent) earns +2 → best", async () => {
    const db = seedCustomer();
    addOrder(db, 1, "delivered", "paid", 20_000_00, NOW - DAY); // meets earn + hold
    expect(await recalculateCustomerCredit(asD1(db), "c1", NOW)).toEqual({
      credit: 2,
      tier: "best",
    });
  });

  it("loyalty buffers a mistake: +2 then one incomplete → +1 / best", async () => {
    const db = seedCustomer();
    addOrder(db, 1, "delivered", "paid", 20_000_00, NOW - 2 * DAY);
    addOrder(db, 2, "expired", "expired", 100_00, NOW - 1 * DAY);
    expect(await recalculateCustomerCredit(asD1(db), "c1", NOW)).toEqual({
      credit: 1,
      tier: "best",
    });
  });

  it("admin block overrides the credit", async () => {
    const db = seedCustomer({ tierOverride: "block" });
    addOrder(db, 1, "delivered", "paid", 20_000_00, NOW - DAY);
    expect((await recalculateCustomerCredit(asD1(db), "c1", NOW))?.tier).toBe("block");
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

  it("counts complete (delivered) vs incomplete (expired / cancelled-unpaid) orders", async () => {
    const db = seeded(); // o1 is 'packing' — neither complete nor incomplete
    const add = (id: string, orderStatus: string, paymentStatus: string) =>
      db
        .prepare(
          `INSERT INTO sales_orders
             (id, channel, external_order_id, order_status, payment_status, grand_total_satang,
              order_created_at, imported_at, storefront_customer_id)
           VALUES (?, 'airplus', ?, ?, ?, 100000, ?, ?, 'c1')`,
        )
        .run(id, id, orderStatus, paymentStatus, NOW, NOW);
    add("o2", "delivered", "paid");
    add("o3", "delivered", "cod_collected");
    add("o4", "expired", "expired");
    add("o5", "cancelled", "pending");
    add("o6", "cancelled", "refunded"); // product-fault return — counts as neither
    const d = await getOrderDetail(asD1(db), "o1");
    expect(d!.customer!.completeCount).toBe(2); // o2, o3
    expect(d!.customer!.incompleteCount).toBe(2); // o4, o5 (o6 excluded)
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

  /**
   * DB double that resolves the staff session and nothing else — this route asks one question.
   *
   * Since 2026-08-24 the slip gate reads the STAFF ROLE, not the Access email list, so these tests
   * sign in. The role-by-role enforcement lives in "GET /file/:key — slip images follow the staff
   * role", which runs against the real migrated schema.
   */
  const dbAs = (role: string) =>
    ({
      prepare: () => ({
        bind: () => ({
          first: async () => ({
            userId: "u1",
            email: "s@shop.test",
            name: "S",
            role,
            sessionId: "sess",
            lastSeenAt: 0,
          }),
          run: async () => ({}),
        }),
      }),
    }) as unknown as D1Database;

  const env = (objects: Record<string, string>, role = "super_admin") =>
    ({ IMAGES: bucketWith(objects), DB: dbAs(role) }) as unknown as Env;

  const AUTH = { headers: { "X-Staff-Session": "t" } };

  it("serves a claim photo from the claim/ namespace", async () => {
    const res = await worker.fetch!(
      new Request("https://x/file/claim/o1/1.png", AUTH),
      env({ "claim/o1/1.png": "PNGBYTES" }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(await res.text()).toBe("PNGBYTES");
  });

  it("serves a slip to a super admin", async () => {
    const res = await worker.fetch!(
      new Request("https://x/file/slip/o1/1.png", AUTH),
      env({ "slip/o1/1.png": "SLIP" }),
      ctx,
    );
    expect(res.status).toBe(200);
  });

  it("refuses a slip with NO session — the old local-dev fail-open is gone", async () => {
    // This asserted 200 until 2026-08-24: with Access unconfigured, `isSuperAdmin` returned true
    // and the route served a customer's bank slip to an unauthenticated caller. The rule did not
    // change, its identity source did — and the new one has no open default.
    const res = await worker.fetch!(
      new Request("https://x/file/slip/o1/1.png"),
      env({ "slip/o1/1.png": "SLIP" }),
      ctx,
    );
    expect(res.status).toBe(401);
  });

  it("never serves a private file with a shared-cacheable header", async () => {
    const res = await worker.fetch!(
      new Request("https://x/file/slip/o1/1.png", AUTH),
      env({ "slip/o1/1.png": "SLIP" }),
      ctx,
    );
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("404s for a key outside the allow-listed namespaces (no key can reach other objects)", async () => {
    const res = await worker.fetch!(
      new Request("https://x/file/products/leak.png", AUTH),
      env({ "products/leak.png": "SECRET" }),
      ctx,
    );
    expect(res.status).toBe(404);
  });

  it("404s when the object is genuinely absent", async () => {
    const res = await worker.fetch!(
      new Request("https://x/file/claim/o1/missing.png", AUTH),
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
    // The order carries a slip: an order awaiting review got there BY a slip arriving, and confirm
    // now refuses without one (owner's rule, 2026-08-04).
    db.prepare(
      `INSERT INTO sales_orders
         (id, channel, external_order_id, order_status, payment_status, subtotal_satang,
          discount_total_satang, shipping_fee_satang, grand_total_satang, profit_satang,
          order_created_at, imported_at, buyer_username, slip_image_key)
       VALUES ('o1','airplus','AP-1','new',?,100000,0,4000,104000,30000,?,?,'u1','slip/o1/a.jpg')`,
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

describe("shopeeSyncWorklist + markShopeeSynced", () => {
  const T = SQLITE_NOW;
  const envOf = (db: DatabaseSync) => ({ DB: asD1(db) }) as unknown as Env;

  // Build a scenario that exercises every rule the worklist has to hold: on-Shopee vs off-Shopee,
  // movements before vs after the last sync, a Shopee sale (online_sale) that must NOT count, and a
  // net-zero change that must NOT show.
  async function scenario() {
    const db = migratedDb();
    const D1 = asD1(db);
    const move = (variantId: string, type: string, delta: number, after: number, at: number) =>
      db
        .prepare(
          `INSERT INTO stock_ledger_entries (id, product_variant_id, movement_type, quantity_delta, quantity_after, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(crypto.randomUUID(), variantId, type, delta, after, at);
    const list = (productId: string, syncedAt: number | null) =>
      db
        .prepare(`UPDATE products SET shopee_listed = 1, shopee_synced_at = ? WHERE id = ?`)
        .run(syncedAt, productId);

    // A — on Shopee, synced before its only sale → a clean −3, opening balance already reconciled.
    const a = await createProduct(D1, { productRef: "A-001", name: "แอร์ A" });
    list(a.productId, T - 500);
    move(a.variantId!, "opening_balance", 10, 10, T - 1000);
    move(a.variantId!, "onsite_sale", -3, 7, T);

    // B — on Shopee, a pre-sync sale that must be ignored, a post-sync write-off that must count (−1).
    const b = await createProduct(D1, { productRef: "B-002", name: "แอร์ B" });
    list(b.productId, T - 500);
    move(b.variantId!, "opening_balance", 8, 8, T - 1000);
    move(b.variantId!, "onsite_sale", -5, 3, T - 800); // before sync — already reconciled
    move(b.variantId!, "write_off", -1, 2, T + 100); // after sync — counts

    // C — on Shopee, but the only change is a Shopee order (online_sale): Shopee already knows. Skip.
    const c = await createProduct(D1, { productRef: "C-003", name: "แอร์ C" });
    list(c.productId, null);
    move(c.variantId!, "online_sale", -4, 6, T);

    // D — NOT on Shopee. A real change, but nothing to update on Shopee. Skip.
    const d = await createProduct(D1, { productRef: "D-004", name: "แอร์ D" });
    move(d.variantId!, "onsite_sale", -1, 5, T); // shopee_listed stays 0

    // E — on Shopee, but a sale then an equal restock net to zero: the Shopee number is unchanged.
    const e = await createProduct(D1, { productRef: "E-005", name: "แอร์ E" });
    list(e.productId, T - 500);
    move(e.variantId!, "onsite_sale", -2, 4, T);
    move(e.variantId!, "receive", 2, 6, T + 100);

    return { db, ids: { a: a.productId, b: b.productId, d: d.productId } };
  }

  async function worklist(db: DatabaseSync) {
    const res = await shopeeSyncWorklist(envOf(db));
    return (await res.json()) as {
      items: { productId: string; productRef: string; deltaSinceSync: number; onHand: number }[];
    };
  }

  it("lists only on-Shopee products whose stock changed since sync (not online_sale, not net-zero, not off-Shopee)", async () => {
    const { db } = await scenario();
    const refs = (await worklist(db)).items.map((i) => i.productRef).sort();
    expect(refs).toEqual(["A-001", "B-002"]);
  });

  it("counts only the movements after the last sync, and reports whole-ledger on-hand", async () => {
    const { db } = await scenario();
    const items = (await worklist(db)).items;
    const a = items.find((i) => i.productRef === "A-001")!;
    const b = items.find((i) => i.productRef === "B-002")!;
    expect(a.deltaSinceSync).toBe(-3);
    expect(a.onHand).toBe(7); // 10 − 3, the SUM over all movements
    expect(b.deltaSinceSync).toBe(-1); // the pre-sync −5 is excluded
    expect(b.onHand).toBe(2); // 8 − 5 − 1
  });

  it("Clear stamps shopee_synced_at so the cleared product drops off and stays off", async () => {
    const { db, ids } = await scenario();
    await markShopeeSynced(envOf(db), [ids.a], T + 9999);
    const refs = (await worklist(db)).items.map((i) => i.productRef).sort();
    expect(refs).toEqual(["B-002"]); // A cleared; B untouched
  });

  it("Clear refuses to stamp a product that is not on Shopee", async () => {
    const { db, ids } = await scenario();
    await markShopeeSynced(envOf(db), [ids.d], T + 9999);
    const synced = db
      .prepare(`SELECT shopee_synced_at AS s FROM products WHERE id = ?`)
      .get(ids.d) as { s: number | null };
    expect(synced.s).toBeNull();
  });

  it("an empty Clear is a no-op", async () => {
    const { db } = await scenario();
    const res = await markShopeeSynced(envOf(db), [], T);
    expect((await res.json()) as { updated: number }).toEqual({ ok: true, updated: 0 });
  });
});

// ── Staff logins (replacing Cloudflare Access) ───────────────────────────────────────────────────
// Run against the real migrated schema, not the canned mock: session lookup is a JOIN whose WHERE
// clause IS the security boundary, and a mock that matches on sql.includes() would happily approve
// a query that forgot `revoked_at IS NULL`.
describe("staff sessions", () => {
  const NOW = 1_800_000_000_000;
  const DAY = 24 * 60 * 60 * 1000;

  async function withUser(
    overrides: { role?: string; status?: string; password?: string | null } = {},
  ) {
    const raw = migratedDb();
    const db = asD1(raw);
    const stored = overrides.password
      ? await hashPassword(overrides.password, { iterations: 1000 })
      : { hash: null, salt: null, iterations: null };
    raw
      .prepare(
        `INSERT INTO users (id, name, email, role, status, created_at,
                            password_hash, password_salt, password_iterations)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "u1",
        "Somchai",
        "somchai@shop.test",
        overrides.role ?? "mechanic",
        overrides.status ?? "active",
        NOW,
        stored.hash,
        stored.salt,
        stored.iterations,
      );
    return { raw, db };
  }

  it("a fresh session identifies its user", async () => {
    const { db } = await withUser({ role: "admin" });
    const { token } = await createStaffSession(db, "u1", NOW);
    await expect(staffFromToken(db, token, NOW + 1000)).resolves.toMatchObject({
      userId: "u1",
      email: "somchai@shop.test",
      role: "admin",
    });
  });

  it("stores only the hash — the raw token never lands in the database", async () => {
    const { raw, db } = await withUser();
    const { token } = await createStaffSession(db, "u1", NOW);
    const rows = raw.prepare(`SELECT token_hash FROM staff_sessions`).all() as {
      token_hash: string;
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token_hash).not.toBe(token);
    expect(rows[0]!.token_hash).toBe(await sha256Hex(token));
  });

  it("an unknown token is nobody", async () => {
    const { db } = await withUser();
    await expect(staffFromToken(db, "not-a-real-token", NOW)).resolves.toBeNull();
    await expect(staffFromToken(db, "", NOW)).resolves.toBeNull();
  });

  it("an expired session is nobody", async () => {
    const { db } = await withUser();
    const { token, expiresAt } = await createStaffSession(db, "u1", NOW);
    // Checked on an untouched session: any earlier lookup would have ROLLED it (see next test),
    // which is exactly the interaction that made an earlier version of this test lie.
    await expect(staffFromToken(db, token, expiresAt + 1)).resolves.toBeNull();
  });

  it("a session in daily use rolls forward instead of expiring under you", async () => {
    const { raw, db } = await withUser();
    const { token, expiresAt } = await createStaffSession(db, "u1", NOW);
    const later = NOW + 25 * 60 * 60 * 1000; // stale by more than a day => rolls
    await expect(staffFromToken(db, token, later)).resolves.not.toBeNull();
    const row = raw.prepare(`SELECT expires_at AS e FROM staff_sessions`).get() as { e: number };
    expect(row.e).toBeGreaterThan(expiresAt);
  });

  it("does not write on every request — only once the session is a day stale", async () => {
    const { raw, db } = await withUser();
    const { token } = await createStaffSession(db, "u1", NOW);
    const before = (
      raw.prepare(`SELECT last_seen_at AS s FROM staff_sessions`).get() as { s: number }
    ).s;
    await staffFromToken(db, token, NOW + 60_000); // a minute later: not stale
    const after = (
      raw.prepare(`SELECT last_seen_at AS s FROM staff_sessions`).get() as { s: number }
    ).s;
    expect(after).toBe(before);
  });

  it("a revoked session is nobody, immediately", async () => {
    const { db } = await withUser();
    const { token } = await createStaffSession(db, "u1", NOW);
    await revokeStaffSession(db, token, NOW + 5);
    await expect(staffFromToken(db, token, NOW + 6)).resolves.toBeNull();
  });

  it("deactivating a person kills their live sessions without touching the session rows", async () => {
    const { raw, db } = await withUser();
    const { token } = await createStaffSession(db, "u1", NOW);
    raw.prepare(`UPDATE users SET status = 'disabled' WHERE id = 'u1'`).run();
    await expect(staffFromToken(db, token, NOW + 10)).resolves.toBeNull();
  });

  it("an unknown role on the row is refused rather than trusted", async () => {
    const { raw, db } = await withUser();
    const { token } = await createStaffSession(db, "u1", NOW);
    raw.prepare(`UPDATE users SET role = 'wizard' WHERE id = 'u1'`).run();
    await expect(staffFromToken(db, token, NOW + 10)).resolves.toBeNull();
  });
});

describe("loginStaff", () => {
  const NOW = 1_800_000_000_000;

  async function withUser(password: string | null, status = "active", role = "admin") {
    const raw = migratedDb();
    const db = asD1(raw);
    const stored = password
      ? await hashPassword(password, { iterations: 1000 })
      : { hash: null, salt: null, iterations: null };
    raw
      .prepare(
        `INSERT INTO users (id, name, email, role, status, created_at,
                            password_hash, password_salt, password_iterations)
         VALUES ('u1','Nok','nok@shop.test',?,?,?,?,?,?)`,
      )
      .run(role, status, NOW, stored.hash, stored.salt, stored.iterations);
    return { raw, db };
  }

  it("the right password opens a session", async () => {
    const { db } = await withUser("aircon-2026");
    const out = await loginStaff(db, "nok@shop.test", "aircon-2026", NOW);
    expect(out.ok).toBe(true);
    if (out.ok)
      await expect(staffFromToken(db, out.token, NOW + 1)).resolves.toMatchObject({
        userId: "u1",
      });
  });

  it("matches the email case-insensitively — nobody types their own capitals twice", async () => {
    const { db } = await withUser("aircon-2026");
    expect((await loginStaff(db, "  Nok@Shop.TEST ", "aircon-2026", NOW)).ok).toBe(true);
  });

  it("the wrong password opens nothing", async () => {
    const { db } = await withUser("aircon-2026");
    expect((await loginStaff(db, "nok@shop.test", "aircon-2025", NOW)).ok).toBe(false);
  });

  it("an account with no password set can never be logged into", async () => {
    const { db } = await withUser(null);
    expect((await loginStaff(db, "nok@shop.test", "", NOW)).ok).toBe(false);
    expect((await loginStaff(db, "nok@shop.test", "anything", NOW)).ok).toBe(false);
  });

  it("a deactivated account cannot log in even with the right password", async () => {
    const { db } = await withUser("aircon-2026", "disabled");
    expect((await loginStaff(db, "nok@shop.test", "aircon-2026", NOW)).ok).toBe(false);
  });

  it("an unknown email fails the same way a wrong password does", async () => {
    const { db } = await withUser("aircon-2026");
    const unknown = await loginStaff(db, "nobody@shop.test", "aircon-2026", NOW);
    const wrong = await loginStaff(db, "nok@shop.test", "nope", NOW);
    // Same shape and same message: the response must not reveal which emails exist.
    expect(unknown).toEqual(wrong);
  });

  it("locks for 24 hours after 3 failures — the owner's rule, not a soft throttle", async () => {
    // A MECHANIC: admins and super admins are exempt from the lock (owner, 9 Aug 2026), so testing
    // it on one would assert the opposite of the rule.
    const { db } = await withUser("aircon-2026", "active", "mechanic");
    for (let i = 0; i < LOCK_AFTER_FAILURES; i++) {
      await loginStaff(db, "nok@shop.test", "wrong", NOW);
    }
    // Even the CORRECT password is refused, and stays refused for a full day.
    const out = await loginStaff(db, "nok@shop.test", "aircon-2026", NOW);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("locked");
    expect(
      (await loginStaff(db, "nok@shop.test", "aircon-2026", NOW + LOCK_DURATION_MS - 1)).ok,
    ).toBe(false);
    // ...and opens again once the day is up.
    expect((await loginStaff(db, "nok@shop.test", "aircon-2026", NOW + LOCK_DURATION_MS)).ok).toBe(
      true,
    );
  });

  it("counts PIN and password failures against the SAME allowance", async () => {
    // A mechanic, for the same reason as the test above: the allowance only ends in a lock for
    // roles that can be locked.
    const { db } = await withUser("aircon-2026", "active", "mechanic");
    await loginStaff(db, "nok@shop.test", "wrong", NOW);
    await loginStaff(db, "nok@shop.test", "wrong", NOW);
    // Two password misses already spent; the third failure of EITHER kind locks the account.
    await loginStaff(db, "nok@shop.test", "wrong", NOW);
    expect((await loginStaff(db, "nok@shop.test", "aircon-2026", NOW)).ok).toBe(false);
  });
});

describe("requireStaff (the gate that must never fail open)", () => {
  const NOW = 1_800_000_000_000;

  it("no token at all > 401, whatever the environment looks like", async () => {
    const raw = migratedDb();
    const db = asD1(raw);
    // Deliberately an env with NOTHING configured — the shape that made the old requireAccess
    // return an open {email: null}. It must not open anything here.
    const res = await requireStaff(new Request("https://x/products"), { DB: db } as unknown as Env);
    expect(res instanceof Response).toBe(true);
    if (res instanceof Response) expect(res.status).toBe(401);
  });

  it("a garbage token > 401", async () => {
    const raw = migratedDb();
    const db = asD1(raw);
    const req = new Request("https://x/products", {
      headers: { [STAFF_SESSION_HEADER]: "deadbeef" },
    });
    const res = await requireStaff(req, { DB: db } as unknown as Env);
    expect(res instanceof Response && res.status).toBe(401);
  });

  it("a live session > the identity, not a Response", async () => {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id, name, email, role, status, created_at)
         VALUES ('u1','Boss','boss@shop.test','super_admin','active',?)`,
      )
      .run(NOW);
    const { token } = await createStaffSession(db, "u1", Date.now());
    const req = new Request("https://x/products", {
      headers: { [STAFF_SESSION_HEADER]: token },
    });
    const res = await requireStaff(req, { DB: db } as unknown as Env);
    expect(res instanceof Response).toBe(false);
    expect(res).toMatchObject({ userId: "u1", role: "super_admin" });
  });
});

// ── Staff management (super admin only) ──────────────────────────────────────────────────────────
describe("staff management", () => {
  const NOW = 1_800_000_000_000;

  async function seed() {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id, name, email, role, status, created_at)
         VALUES ('boss','Boss','boss@shop.test','super_admin','active',?)`,
      )
      .run(NOW);
    return { raw, db };
  }
  const boss = {
    userId: "boss",
    email: "boss@shop.test",
    name: "Boss",
    role: "super_admin",
  } as const;
  const clerk = { userId: "c1", email: "c1@shop.test", name: "Nok", role: "admin" } as const;
  const mech = { userId: "m1", email: "m1@shop.test", name: "Somchai", role: "mechanic" } as const;

  it("only a super admin may list or create staff", async () => {
    const { db } = await seed();
    expect((await listStaff(db, clerk)).status).toBe(403);
    expect((await listStaff(db, mech)).status).toBe(403);
    expect((await listStaff(db, boss)).status).toBe(200);
    const denied = await createStaff(
      db,
      clerk,
      { name: "X", email: "x@s.test", role: "admin" },
      NOW,
    );
    expect(denied.status).toBe(403);
  });

  it("creating staff stores a hashed password and never the password itself", async () => {
    const { raw, db } = await seed();
    const res = await createStaff(
      db,
      boss,
      { name: "Somchai", email: "Somchai@Shop.test", role: "mechanic", password: "aircon-2026" },
      NOW,
    );
    expect(res.status).toBe(201);
    const row = raw
      .prepare(
        `SELECT email, role, password_hash AS h FROM users WHERE email = 'somchai@shop.test'`,
      )
      .get() as { email: string; role: string; h: string };
    expect(row.email).toBe("somchai@shop.test"); // stored lowercase, so login can match
    expect(row.role).toBe("mechanic");
    expect(row.h).not.toBe("aircon-2026");
    expect(row.h.length).toBeGreaterThan(20);
  });

  it("stores the Thai and English names separately (owner, 2026-08-03)", async () => {
    const { raw, db } = await seed();
    await createStaff(
      db,
      boss,
      {
        name: "สมชาย ใจดี",
        nameTh: "สมชาย ใจดี",
        nameEn: "Somchai Jaidee",
        email: "s@shop.test",
        role: "mechanic",
      },
      NOW,
    );
    const row = raw
      .prepare(`SELECT name, name_th AS th, name_en AS en FROM users WHERE email='s@shop.test'`)
      .get() as { name: string; th: string; en: string };
    expect(row).toEqual({ name: "สมชาย ใจดี", th: "สมชาย ใจดี", en: "Somchai Jaidee" });
  });

  it("refuses a role it does not know", async () => {
    const { db } = await seed();
    const res = await createStaff(db, boss, { name: "X", email: "x@s.test", role: "wizard" }, NOW);
    expect(res.status).toBe(400);
  });

  it("refuses a duplicate email rather than shadowing an existing login", async () => {
    const { db } = await seed();
    const res = await createStaff(
      db,
      boss,
      { name: "Another Boss", email: "BOSS@shop.test", role: "admin" },
      NOW,
    );
    expect(res.status).toBe(409);
  });

  it("resetting a password logs that person's devices out", async () => {
    const { raw, db } = await seed();
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at) VALUES ('m1','S','m1@shop.test','mechanic','active',?)`,
      )
      .run(NOW);
    const { token } = await createStaffSession(db, "m1", NOW);
    await expect(staffFromToken(db, token, NOW + 1)).resolves.not.toBeNull();
    const res = await setStaffPassword(db, boss, "m1", "brand-new-password", NOW + 2);
    expect(res.status).toBe(200);
    // The old session must die with the old password.
    await expect(staffFromToken(db, token, NOW + 3)).resolves.toBeNull();
  });

  it("setting a new password lifts the 24-hour block (owner, 2026-08-03)", async () => {
    const { raw, db } = await seed();
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at,failed_attempts,locked_until,last_failed_at)
         VALUES ('m1','S','m1@shop.test','mechanic','active',?,3,?,?)`,
      )
      .run(NOW, NOW + LOCK_DURATION_MS, NOW);
    // Locked solid before...
    expect((await loginStaff(db, "m1@shop.test", "whatever", NOW + 1000)).ok).toBe(false);

    await setStaffPassword(db, boss, "m1", "brand-new-password", NOW + 2000);

    // ...and the new password works at once. The credential they were failing against is gone, so
    // the run of failures has nothing left to be a run of.
    const out = await loginStaff(db, "m1@shop.test", "brand-new-password", NOW + 3000);
    expect(out.ok).toBe(true);
    const row = raw
      .prepare(`SELECT failed_attempts AS f, locked_until AS l FROM users WHERE id='m1'`)
      .get() as { f: number; l: number | null };
    expect(row).toEqual({ f: 0, l: null });
  });

  it("changing your OWN password lifts it too", async () => {
    const { raw, db } = await seed();
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at,failed_attempts,locked_until,last_failed_at)
         VALUES ('m2','S','m2@shop.test','mechanic','active',?,3,?,?)`,
      )
      .run(NOW, NOW + LOCK_DURATION_MS, NOW);
    const them = {
      userId: "m2",
      email: "m2@shop.test",
      name: "S",
      role: "mechanic",
    } as const;
    await changeOwnPassword(db, them, "my-own-new-password", NOW + 2000, "9f".repeat(32));
    expect((await loginStaff(db, "m2@shop.test", "my-own-new-password", NOW + 3000)).ok).toBe(true);
  });

  it("the last super admin cannot demote or disable themselves out of the system", async () => {
    const { db } = await seed();
    const demote = await updateStaff(db, boss, "boss", { role: "admin" }, NOW);
    expect(demote.status).toBe(409);
    const disable = await updateStaff(db, boss, "boss", { status: "disabled" }, NOW);
    expect(disable.status).toBe(409);
  });

  it("a second super admin makes the first one demotable again", async () => {
    const { db } = await seed();
    await createStaff(db, boss, { name: "Two", email: "two@shop.test", role: "super_admin" }, NOW);
    expect((await updateStaff(db, boss, "boss", { role: "admin" }, NOW)).status).toBe(200);
  });

  it("disabling someone revokes their sessions immediately", async () => {
    const { raw, db } = await seed();
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at) VALUES ('m1','S','m1@shop.test','mechanic','active',?)`,
      )
      .run(NOW);
    const { token } = await createStaffSession(db, "m1", NOW);
    await updateStaff(db, boss, "m1", { status: "disabled" }, NOW + 1);
    await expect(staffFromToken(db, token, NOW + 2)).resolves.toBeNull();
  });

  it("never returns password material in a staff listing", async () => {
    const { db } = await seed();
    await createStaff(
      db,
      boss,
      { name: "S", email: "s@shop.test", role: "mechanic", password: "x-secret-123" },
      NOW,
    );
    const body = await (await listStaff(db, boss)).text();
    expect(body).not.toContain("x-secret-123");
    expect(body).not.toContain("password_hash");
    expect(body).not.toContain("passwordHash");
  });
});

// ── PIN login (no email — the PIN identifies the person by itself) ───────────────────────────────
describe("loginWithPin", () => {
  const NOW = 1_800_000_000_000;
  const PEPPER = "test-pepper";

  async function seed(pins: { id: string; pin: string; status?: string }[]) {
    const raw = migratedDb();
    const db = asD1(raw);
    for (const p of pins) {
      const hashed = await hashPassword(p.pin, { iterations: 1000 });
      raw
        .prepare(
          `INSERT INTO users (id, name, email, role, status, created_at,
                              pin_hash, pin_salt, pin_iterations, pin_lookup)
           VALUES (?, ?, ?, 'mechanic', ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          p.id,
          p.id,
          `${p.id}@shop.test`,
          p.status ?? "active",
          NOW,
          hashed.hash,
          hashed.salt,
          hashed.iterations,
          await pinLookup(p.pin, PEPPER),
        );
    }
    return { raw, db };
  }

  it("the right PIN identifies its owner with no email typed", async () => {
    const { db } = await seed([{ id: "somchai", pin: "481920" }]);
    const out = await loginWithPin(db, "481920", NOW, PEPPER);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.identity.userId).toBe("somchai");
  });

  it("tells two people apart by their PIN alone", async () => {
    const { db } = await seed([
      { id: "somchai", pin: "481920" },
      { id: "nok", pin: "735104" },
    ]);
    const a = await loginWithPin(db, "735104", NOW, PEPPER);
    expect(a.ok && a.identity.userId).toBe("nok");
  });

  it("a PIN nobody holds opens nothing", async () => {
    const { db } = await seed([{ id: "somchai", pin: "481920" }]);
    expect((await loginWithPin(db, "999111", NOW, PEPPER)).ok).toBe(false);
  });

  it("a switched-off person cannot use their PIN", async () => {
    const { db } = await seed([{ id: "pond", pin: "481920", status: "disabled" }]);
    expect((await loginWithPin(db, "481920", NOW, PEPPER)).ok).toBe(false);
  });

  it("a deleted person cannot use their PIN", async () => {
    const { raw, db } = await seed([{ id: "pond", pin: "481920" }]);
    raw.prepare(`UPDATE users SET deleted_at = ? WHERE id = 'pond'`).run(NOW);
    expect((await loginWithPin(db, "481920", NOW, PEPPER)).ok).toBe(false);
  });

  it("locks the account for 24 hours after 3 wrong PINs", async () => {
    const { db } = await seed([{ id: "somchai", pin: "481920" }]);
    // Wrong PINs that DO belong to nobody can't lock an account — there is none to lock. What must
    // lock is the account whose PIN was got wrong, so drive it through that account's own failures.
    for (let i = 0; i < 3; i++) await loginStaff(db, "somchai@shop.test", "wrong", NOW);
    const out = await loginWithPin(db, "481920", NOW, PEPPER);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("locked");
  });

  it("a correct PIN clears the failure count", async () => {
    const { raw, db } = await seed([{ id: "somchai", pin: "481920" }]);
    await loginStaff(db, "somchai@shop.test", "wrong", NOW);
    await loginWithPin(db, "481920", NOW, PEPPER);
    const row = raw.prepare(`SELECT failed_attempts AS f FROM users WHERE id='somchai'`).get() as {
      f: number;
    };
    expect(row.f).toBe(0);
  });
});

// ── Own profile: change password, set PIN, record a day off ──────────────────────────────────────
describe("staff profile (their own)", () => {
  const NOW = 1_800_000_000_000;
  const KEY = "9f".repeat(32);
  const PEPPER = "test-pepper";

  async function seed() {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at,name_th,name_en,day_rate_satang)
         VALUES ('m1','Somchai','somchai@shop.test','mechanic','active',?,'สมชาย','Somchai',40000)`,
      )
      .run(NOW);
    return { raw, db };
  }
  const me = {
    userId: "m1",
    email: "somchai@shop.test",
    name: "Somchai",
    role: "mechanic",
  } as const;

  it("shows their own details, and their password in readable form", async () => {
    const { db } = await seed();
    await changeOwnPassword(db, me, "aircon-2026", NOW, KEY);
    const body = (await (await ownProfile(db, me, KEY)).json()) as {
      profile: { nameTh: string; password: string | null; dayRateSatang: number };
    };
    expect(body.profile.nameTh).toBe("สมชาย");
    expect(body.profile.password).toBe("aircon-2026");
    expect(body.profile.dayRateSatang).toBe(40000);
  });

  it("never leaks the password hash to the browser", async () => {
    const { db } = await seed();
    await changeOwnPassword(db, me, "aircon-2026", NOW, KEY);
    const text = await (await ownProfile(db, me, KEY)).text();
    expect(text).not.toContain("password_hash");
    expect(text).not.toContain("passwordHash");
    expect(text).not.toContain("pin_hash");
  });

  it("changing their own password logs it for the owner to see", async () => {
    const { raw, db } = await seed();
    await changeOwnPassword(db, me, "aircon-2026", NOW, KEY);
    const rows = raw.prepare(`SELECT kind, user_id FROM staff_activity`).all() as {
      kind: string;
      user_id: string;
    }[];
    expect(rows).toEqual([{ kind: "password_changed", user_id: "m1" }]);
  });

  it("a changed password actually works, and the old one stops working", async () => {
    const { db } = await seed();
    await changeOwnPassword(db, me, "aircon-2026", NOW, KEY);
    await changeOwnPassword(db, me, "aircon-2027", NOW + 1, KEY);
    expect((await loginStaff(db, "somchai@shop.test", "aircon-2027", NOW + 2)).ok).toBe(true);
    expect((await loginStaff(db, "somchai@shop.test", "aircon-2026", NOW + 3)).ok).toBe(false);
  });

  it("refuses a password too weak to bother with", async () => {
    const { db } = await seed();
    expect((await changeOwnPassword(db, me, "short", NOW, KEY)).status).toBe(400);
  });

  it("sets their own 6-digit PIN, and it signs them in", async () => {
    const { db } = await seed();
    expect((await setOwnPin(db, me, "481920", NOW, PEPPER)).status).toBe(200);
    const out = await loginWithPin(db, "481920", NOW + 1, PEPPER);
    expect(out.ok && out.identity.userId).toBe("m1");
  });

  it("refuses a PIN that is not six digits, or one anybody would guess", async () => {
    const { db } = await seed();
    expect((await setOwnPin(db, me, "1234", NOW, PEPPER)).status).toBe(400);
    expect((await setOwnPin(db, me, "123456", NOW, PEPPER)).status).toBe(400);
  });

  it("refuses a PIN somebody else already holds", async () => {
    const { raw, db } = await seed();
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at) VALUES ('n1','Nok','nok@shop.test','admin','active',?)`,
      )
      .run(NOW);
    const nok = { userId: "n1", email: "nok@shop.test", name: "Nok", role: "admin" } as const;
    expect((await setOwnPin(db, nok, "481920", NOW, PEPPER)).status).toBe(200);
    // Two people sharing six digits would make a PIN-only login ambiguous.
    expect((await setOwnPin(db, me, "481920", NOW, PEPPER)).status).toBe(409);
  });

  it("records a day off, full or half, without asking anyone", async () => {
    const { raw, db } = await seed();
    expect((await recordDayOff(db, me, { day: "2026-08-15", halves: 2 }, NOW)).status).toBe(201);
    expect(
      (await recordDayOff(db, me, { day: "2026-08-09", halves: 1, reason: "มาสาย" }, NOW)).status,
    ).toBe(201);
    const rows = raw.prepare(`SELECT day, halves FROM staff_days_off ORDER BY day`).all() as {
      day: string;
      halves: number;
    }[];
    expect(rows).toEqual([
      { day: "2026-08-09", halves: 1 },
      { day: "2026-08-15", halves: 2 },
    ]);
  });

  it("changing a day already recorded replaces it rather than double-counting", async () => {
    const { raw, db } = await seed();
    await recordDayOff(db, me, { day: "2026-08-15", halves: 2 }, NOW);
    await recordDayOff(db, me, { day: "2026-08-15", halves: 1 }, NOW + 1);
    const rows = raw.prepare(`SELECT halves FROM staff_days_off`).all() as { halves: number }[];
    expect(rows).toEqual([{ halves: 1 }]);
  });

  it("refuses a nonsense date or amount", async () => {
    const { db } = await seed();
    expect((await recordDayOff(db, me, { day: "15/08/2026", halves: 2 }, NOW)).status).toBe(400);
    expect((await recordDayOff(db, me, { day: "2026-08-15", halves: 3 }, NOW)).status).toBe(400);
  });
});

describe("revealPassword", () => {
  const NOW = 1_800_000_000_000;
  const KEY = "9f".repeat(32);
  const boss = {
    userId: "boss",
    email: "boss@shop.test",
    name: "Boss",
    role: "super_admin",
  } as const;
  const clerk = { userId: "c1", email: "c1@shop.test", name: "Nok", role: "admin" } as const;

  async function seed() {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at) VALUES ('m1','S','s@shop.test','mechanic','active',?)`,
      )
      .run(NOW);
    return { raw, db };
  }

  it("the super admin can read any staff password back, any time", async () => {
    const { db } = await seed();
    await setStaffPassword(db, boss, "m1", "aircon-2026", NOW, KEY);
    const body = (await (await revealPassword(db, boss, "m1", KEY)).json()) as {
      password: string | null;
    };
    expect(body.password).toBe("aircon-2026");
  });

  it("nobody else can — not even an admin", async () => {
    const { db } = await seed();
    await setStaffPassword(db, boss, "m1", "aircon-2026", NOW, KEY);
    expect((await revealPassword(db, clerk, "m1", KEY)).status).toBe(403);
  });

  it("with the key missing, it says so instead of pretending there is no password", async () => {
    const { db } = await seed();
    await setStaffPassword(db, boss, "m1", "aircon-2026", NOW, KEY);
    expect((await revealPassword(db, boss, "m1", "")).status).toBe(503);
  });
});

// ── Deleting a person (keeps their name on past work) ────────────────────────────────────────────
describe("deleteStaff", () => {
  const NOW = 1_800_000_000_000;
  const boss = {
    userId: "boss",
    email: "boss@shop.test",
    name: "Boss",
    role: "super_admin",
  } as const;
  const clerk = { userId: "c1", email: "c1@shop.test", name: "Nok", role: "admin" } as const;

  async function seed() {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at) VALUES ('boss','Boss','boss@shop.test','super_admin','active',?)`,
      )
      .run(NOW);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at,phone,emergency_phone,
                            bank_account_no,pin_hash,pin_lookup,password_hash,password_cipher)
         VALUES ('p1','ปอนด์ (Pond)','pond@shop.test','mechanic','active',?,'0821114444','0899992222',
                 '1234567890','h','lookup','ph','cipher')`,
      )
      .run(NOW);
    return { raw, db };
  }

  it("only a super admin may delete", async () => {
    const { db } = await seed();
    expect((await deleteStaff(db, clerk, "p1", NOW)).status).toBe(403);
  });

  it("keeps the name but destroys everything personal", async () => {
    const { raw, db } = await seed();
    expect((await deleteStaff(db, boss, "p1", NOW)).status).toBe(200);
    const row = raw
      .prepare(
        `SELECT name, phone, emergency_phone AS ep, bank_account_no AS bank, pin_hash AS pin,
                pin_lookup AS lookup, password_hash AS pw, password_cipher AS cipher,
                deleted_at AS deletedAt, status
           FROM users WHERE id='p1'`,
      )
      .get() as Record<string, unknown>;
    // The name survives so old bills still say who made them — the owner's choice.
    expect(row.name).toBe("ปอนด์ (Pond)");
    // Everything else that identifies or admits them is gone.
    expect(row.phone).toBeNull();
    expect(row.ep).toBeNull();
    expect(row.bank).toBeNull();
    expect(row.pin).toBeNull();
    expect(row.lookup).toBeNull();
    expect(row.pw).toBeNull();
    expect(row.cipher).toBeNull();
    expect(row.deletedAt).toBe(NOW);
    expect(row.status).toBe("disabled");
  });

  it("a deleted person disappears from the staff list", async () => {
    const { db } = await seed();
    await deleteStaff(db, boss, "p1", NOW);
    const body = (await (await listStaff(db, boss)).json()) as { staff: { id: string }[] };
    expect(body.staff.map((s) => s.id)).toEqual(["boss"]);
  });

  it("a deleted person's live session dies at once", async () => {
    const { db } = await seed();
    const { token } = await createStaffSession(db, "p1", NOW);
    await deleteStaff(db, boss, "p1", NOW + 1);
    await expect(staffFromToken(db, token, NOW + 2)).resolves.toBeNull();
  });

  it("frees their PIN for somebody else to use", async () => {
    const { raw, db } = await seed();
    await deleteStaff(db, boss, "p1", NOW);
    // pin_lookup is UNIQUE; if delete left it behind, nobody could ever reuse those six digits.
    const rows = raw
      .prepare(`SELECT COUNT(*) AS n FROM users WHERE pin_lookup = 'lookup'`)
      .get() as { n: number };
    expect(rows.n).toBe(0);
  });

  it("refuses to delete your own account", async () => {
    const { db } = await seed();
    expect((await deleteStaff(db, boss, "boss", NOW)).status).toBe(409);
  });

  it("refuses to delete the last super admin, even from another super admin's account", async () => {
    const { raw, db } = await seed();
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at) VALUES ('b2','Two','two@shop.test','super_admin','active',?)`,
      )
      .run(NOW);
    const other = {
      userId: "b2",
      email: "two@shop.test",
      name: "Two",
      role: "super_admin",
    } as const;
    // Two supers: removing one is fine...
    expect((await deleteStaff(db, other, "boss", NOW)).status).toBe(200);
    // ...but the survivor cannot then be removed by anyone.
    const solo = { ...other };
    expect((await deleteStaff(db, solo, "b2", NOW)).status).toBe(409);
  });
});

// ── Salary: the month's run ──────────────────────────────────────────────────────────────────────
describe("salaryMonth", () => {
  const NOW = 1_800_000_000_000;
  const boss = {
    userId: "boss",
    email: "boss@shop.test",
    name: "Boss",
    role: "super_admin",
  } as const;
  const clerk = { userId: "c1", email: "c1@shop.test", name: "Nok", role: "admin" } as const;

  async function seed() {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,name_th,email,role,status,created_at,day_rate_satang)
         VALUES ('boss','Boss','เลดี้','boss@shop.test','super_admin','active',?,NULL)`,
      )
      .run(NOW);
    raw
      .prepare(
        `INSERT INTO users (id,name,name_th,email,role,status,created_at,day_rate_satang)
         VALUES ('s1','Somchai','สมชาย','s@shop.test','mechanic','active',?,40000)`,
      )
      .run(NOW);
    return { raw, db };
  }

  it("is super-admin only", async () => {
    const { db } = await seed();
    expect((await salaryMonth(db, clerk, "2026-07")).status).toBe(403);
  });

  it("computes the owner's example from the days off people recorded themselves", async () => {
    const { raw, db } = await seed();
    // Two full days off in July.
    for (const day of ["2026-07-04", "2026-07-18"]) {
      raw
        .prepare(
          `INSERT INTO staff_days_off (id,user_id,day,halves,created_at) VALUES (?, 's1', ?, 2, ?)`,
        )
        .run(crypto.randomUUID(), day, NOW);
    }
    const body = (await (await salaryMonth(db, boss, "2026-07")).json()) as {
      daysInMonth: number;
      rows: { userId: string; offHalves: number; workingHalves: number; amountSatang: number }[];
    };
    expect(body.daysInMonth).toBe(31);
    const somchai = body.rows.find((r) => r.userId === "s1")!;
    expect(somchai.offHalves).toBe(4);
    expect(somchai.workingHalves).toBe(58); // 29 days
    expect(somchai.amountSatang).toBe(1_160_000); // ฿11,600
  });

  it("counts a half day as half", async () => {
    const { raw, db } = await seed();
    raw
      .prepare(
        `INSERT INTO staff_days_off (id,user_id,day,halves,created_at) VALUES (?, 's1','2026-07-09',1,?)`,
      )
      .run(crypto.randomUUID(), NOW);
    const body = (await (await salaryMonth(db, boss, "2026-07")).json()) as {
      rows: { userId: string; amountSatang: number }[];
    };
    expect(body.rows.find((r) => r.userId === "s1")!.amountSatang).toBe(1_220_000); // 30.5 × ฿400
  });

  it("only counts days off inside the month asked for", async () => {
    const { raw, db } = await seed();
    for (const day of ["2026-06-30", "2026-08-01"]) {
      raw
        .prepare(
          `INSERT INTO staff_days_off (id,user_id,day,halves,created_at) VALUES (?, 's1', ?, 2, ?)`,
        )
        .run(crypto.randomUUID(), day, NOW);
    }
    const body = (await (await salaryMonth(db, boss, "2026-07")).json()) as {
      rows: { userId: string; offHalves: number }[];
    };
    expect(body.rows.find((r) => r.userId === "s1")!.offHalves).toBe(0);
  });

  it("leaves out anyone with no day rate — there is nothing to pay them by yet", async () => {
    const { db } = await seed();
    const body = (await (await salaryMonth(db, boss, "2026-07")).json()) as {
      rows: { userId: string }[];
    };
    expect(body.rows.map((r) => r.userId)).toEqual(["s1"]);
  });

  it("leaves out people who have been deleted", async () => {
    const { raw, db } = await seed();
    raw.prepare(`UPDATE users SET deleted_at = ? WHERE id='s1'`).run(NOW);
    const body = (await (await salaryMonth(db, boss, "2026-07")).json()) as { rows: unknown[] };
    expect(body.rows).toEqual([]);
  });

  it("refuses a period that isn't a month", async () => {
    const { db } = await seed();
    expect((await salaryMonth(db, boss, "July")).status).toBe(400);
    expect((await salaryMonth(db, boss, "2026-13")).status).toBe(400);
  });
});

describe("markSalaryPaid + staffActivity", () => {
  const NOW = 1_800_000_000_000;
  const boss = {
    userId: "boss",
    email: "boss@shop.test",
    name: "Boss",
    role: "super_admin",
  } as const;
  const clerk = { userId: "c1", email: "c1@shop.test", name: "Nok", role: "admin" } as const;

  async function seed() {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at,day_rate_satang)
         VALUES ('boss','Boss','boss@shop.test','super_admin','active',?,NULL)`,
      )
      .run(NOW);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at,day_rate_satang)
         VALUES ('s1','Somchai','s@shop.test','mechanic','active',?,40000)`,
      )
      .run(NOW);
    raw
      .prepare(
        `INSERT INTO staff_days_off (id,user_id,day,halves,created_at) VALUES ('d1','s1','2026-07-04',2,?)`,
      )
      .run(NOW);
    raw
      .prepare(
        `INSERT INTO staff_days_off (id,user_id,day,halves,created_at) VALUES ('d2','s1','2026-07-18',2,?)`,
      )
      .run(NOW);
    return { raw, db };
  }

  it("marking paid freezes the figures as they stood", async () => {
    const { raw, db } = await seed();
    expect(
      (
        await markSalaryPaid(db, boss, "s1", "2026-07", NOW, {
          method: "transfer",
          slipKey: "salary-slip/s1/a.jpg",
        })
      ).status,
    ).toBe(200);
    const slip = raw
      .prepare(
        `SELECT day_rate_satang AS rate, off_halves AS off, amount_satang AS amt FROM staff_payslips`,
      )
      .get() as { rate: number; off: number; amt: number };
    expect(slip).toEqual({ rate: 40000, off: 4, amt: 1_160_000 });
  });

  it("a later raise does not rewrite a month already paid", async () => {
    const { raw, db } = await seed();
    await markSalaryPaid(db, boss, "s1", "2026-07", NOW, {
      method: "transfer",
      slipKey: "salary-slip/s1/a.jpg",
    });
    raw.prepare(`UPDATE users SET day_rate_satang = 60000 WHERE id='s1'`).run();
    const body = (await (await salaryMonth(db, boss, "2026-07")).json()) as {
      rows: { amountSatang: number; paidAt: number | null }[];
    };
    // The row still reports what was actually paid, not what the new rate would give.
    expect(body.rows[0]!.amountSatang).toBe(1_160_000);
    expect(body.rows[0]!.paidAt).toBe(NOW);
  });

  it("only a super admin may mark paid, or read the activity log", async () => {
    const { db } = await seed();
    expect(
      (
        await markSalaryPaid(db, clerk, "s1", "2026-07", NOW, {
          method: "transfer",
          slipKey: "salary-slip/s1/a.jpg",
        })
      ).status,
    ).toBe(403);
    expect((await staffActivity(db, clerk, {})).status).toBe(403);
  });

  it("activity comes back newest first, with the person's name attached", async () => {
    const { raw, db } = await seed();
    raw
      .prepare(
        `INSERT INTO staff_activity (id,user_id,kind,detail,created_at) VALUES ('a1','s1','pin_changed',NULL,?)`,
      )
      .run(NOW);
    raw
      .prepare(
        `INSERT INTO staff_activity (id,user_id,kind,detail,created_at) VALUES ('a2','s1','day_off','2026-07-04 · full day',?)`,
      )
      .run(NOW + 5000);
    const body = (await (await staffActivity(db, boss, {})).json()) as {
      activity: { id: string; name: string; kind: string }[];
    };
    expect(body.activity.map((a) => a.id)).toEqual(["a2", "a1"]);
    expect(body.activity[0]!.name).toBe("Somchai");
  });

  it("filters by person and by month", async () => {
    const { raw, db } = await seed();
    raw
      .prepare(
        `INSERT INTO staff_activity (id,user_id,kind,detail,created_at) VALUES ('a1','s1','pin_changed',NULL,?)`,
      )
      .run(Date.UTC(2026, 6, 15));
    raw
      .prepare(
        `INSERT INTO staff_activity (id,user_id,kind,detail,created_at) VALUES ('a2','boss','pin_changed',NULL,?)`,
      )
      .run(Date.UTC(2026, 7, 15));
    const byPerson = (await (await staffActivity(db, boss, { userId: "s1" })).json()) as {
      activity: { id: string }[];
    };
    expect(byPerson.activity.map((a) => a.id)).toEqual(["a1"]);
    const byMonth = (await (await staffActivity(db, boss, { period: "2026-08" })).json()) as {
      activity: { id: string }[];
    };
    expect(byMonth.activity.map((a) => a.id)).toEqual(["a2"]);
  });
});

// ── One person's profile, as the owner sees and edits it ─────────────────────────────────────────
describe("staffProfileFor + updateStaffProfile + clearStaffPin", () => {
  const NOW = 1_800_000_000_000;
  const KEY = "9f".repeat(32);
  const PEPPER = "test-pepper";
  const boss = {
    userId: "boss",
    email: "boss@shop.test",
    name: "Boss",
    role: "super_admin",
  } as const;
  const clerk = { userId: "c1", email: "c1@shop.test", name: "Nok", role: "admin" } as const;

  async function seed() {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at)
         VALUES ('boss','Boss','boss@shop.test','super_admin','active',?)`,
      )
      .run(NOW);
    raw
      .prepare(
        `INSERT INTO users (id,name,name_th,name_en,email,role,status,created_at,phone)
         VALUES ('m1','Somchai','สมชาย','Somchai','s@shop.test','mechanic','active',?,'0811111111')`,
      )
      .run(NOW);
    return { raw, db };
  }

  it("only a super admin may read or change someone else's profile", async () => {
    const { db } = await seed();
    expect((await staffProfileFor(db, clerk, "m1", KEY)).status).toBe(403);
    expect((await updateStaffProfile(db, clerk, "m1", { phone: "x" }, NOW)).status).toBe(403);
    expect((await clearStaffPin(db, clerk, "m1", NOW)).status).toBe(403);
  });

  it("shows their details and their password in readable form", async () => {
    const { db } = await seed();
    await setStaffPassword(db, boss, "m1", "aircon-2026", NOW, KEY);
    const body = (await (await staffProfileFor(db, boss, "m1", KEY)).json()) as {
      profile: { nameTh: string; phone: string; password: string };
    };
    expect(body.profile.nameTh).toBe("สมชาย");
    expect(body.profile.phone).toBe("0811111111");
    expect(body.profile.password).toBe("aircon-2026");
  });

  it("never ships a hash to the browser", async () => {
    const { db } = await seed();
    await setStaffPassword(db, boss, "m1", "aircon-2026", NOW, KEY);
    const text = await (await staffProfileFor(db, boss, "m1", KEY)).text();
    expect(text).not.toContain("password_hash");
    expect(text).not.toContain("pin_hash");
    expect(text).not.toContain("passwordHash");
  });

  it("edits everything about them", async () => {
    const { raw, db } = await seed();
    const res = await updateStaffProfile(
      db,
      boss,
      "m1",
      {
        nameTh: "สมชาย ใจดี",
        nameEn: "Somchai Jaidee",
        phone: "0822222222",
        emergencyName: "มาลี",
        emergencyPhone: "0899999999",
        startedOn: Date.UTC(2026, 2, 4),
        dayRateSatang: 40000,
        bankName: "Kasikorn",
        bankAccountNo: "1234567890",
        bankAccountName: "Somchai Jaidee",
      },
      NOW,
    );
    expect(res.status).toBe(200);
    const row = raw
      .prepare(
        `SELECT name_th AS th, name_en AS en, phone, emergency_name AS en2, day_rate_satang AS rate,
                bank_account_no AS acct, name
           FROM users WHERE id='m1'`,
      )
      .get() as Record<string, unknown>;
    expect(row.th).toBe("สมชาย ใจดี");
    expect(row.phone).toBe("0822222222");
    expect(row.rate).toBe(40000);
    expect(row.acct).toBe("1234567890");
    // The display name follows the Thai name, so the staff list and salary run stay in step.
    expect(row.name).toBe("สมชาย ใจดี");
  });

  it("leaves alone anything not sent", async () => {
    const { raw, db } = await seed();
    await updateStaffProfile(db, boss, "m1", { phone: "0899000000" }, NOW);
    const row = raw.prepare(`SELECT name_th AS th, phone FROM users WHERE id='m1'`).get() as {
      th: string;
      phone: string;
    };
    expect(row).toEqual({ th: "สมชาย", phone: "0899000000" });
  });

  it("refuses an email that already belongs to somebody else", async () => {
    const { db } = await seed();
    expect(
      (await updateStaffProfile(db, boss, "m1", { email: "BOSS@shop.test" }, NOW)).status,
    ).toBe(409);
  });

  it("refuses a negative or fractional day rate", async () => {
    const { db } = await seed();
    expect((await updateStaffProfile(db, boss, "m1", { dayRateSatang: -1 }, NOW)).status).toBe(400);
    expect((await updateStaffProfile(db, boss, "m1", { dayRateSatang: 1.5 }, NOW)).status).toBe(
      400,
    );
  });

  it("clearing a PIN frees those six digits for somebody else", async () => {
    const { db } = await seed();
    const them = {
      userId: "m1",
      email: "s@shop.test",
      name: "Somchai",
      role: "mechanic",
    } as const;
    await setOwnPin(db, them, "481920", NOW, PEPPER);
    expect((await loginWithPin(db, "481920", NOW + 1, PEPPER)).ok).toBe(true);

    expect((await clearStaffPin(db, boss, "m1", NOW + 2)).status).toBe(200);
    // Gone as a way in...
    expect((await loginWithPin(db, "481920", NOW + 3, PEPPER)).ok).toBe(false);
    // ...and available again, which a left-behind unique index would have prevented forever.
    expect((await setOwnPin(db, boss, "481920", NOW + 4, PEPPER)).status).toBe(200);
  });
});

// ── PINs the owner can read back (0085) ──────────────────────────────────────────────────────────
describe("setStaffPin + PIN reveal", () => {
  const NOW = 1_800_000_000_000;
  const KEY = "9f".repeat(32);
  const PEPPER = "test-pepper";
  const boss = {
    userId: "boss",
    email: "boss@shop.test",
    name: "Boss",
    role: "super_admin",
  } as const;
  const them = {
    userId: "m1",
    email: "s@shop.test",
    name: "Somchai",
    role: "mechanic",
  } as const;

  async function seed() {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at) VALUES ('boss','Boss','boss@shop.test','super_admin','active',?)`,
      )
      .run(NOW);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at) VALUES ('m1','Somchai','s@shop.test','mechanic','active',?)`,
      )
      .run(NOW);
    return { raw, db };
  }

  it("a PIN the staff member sets themselves can be read back by the owner", async () => {
    const { db } = await seed();
    expect((await setOwnPin(db, them, "620418", NOW, PEPPER, KEY)).status).toBe(200);
    const body = (await (await staffProfileFor(db, boss, "m1", KEY)).json()) as {
      profile: { pin: string | null };
    };
    expect(body.profile.pin).toBe("620418");
  });

  it("the owner can set somebody's PIN, and it signs them in", async () => {
    const { db } = await seed();
    expect((await setStaffPin(db, boss, "m1", "481920", NOW, PEPPER, KEY)).status).toBe(200);
    const out = await loginWithPin(db, "481920", NOW + 1, PEPPER);
    expect(out.ok && out.identity.userId).toBe("m1");
  });

  it("resetting a PIN signs that person out of every device", async () => {
    const { db } = await seed();
    await setStaffPin(db, boss, "m1", "481920", NOW, PEPPER, KEY);
    const { token } = await createStaffSession(db, "m1", NOW + 1);
    await expect(staffFromToken(db, token, NOW + 2)).resolves.not.toBeNull();
    await setStaffPin(db, boss, "m1", "735104", NOW + 3, PEPPER, KEY);
    await expect(staffFromToken(db, token, NOW + 4)).resolves.toBeNull();
  });

  it("only a super admin may set somebody else's PIN", async () => {
    const { db } = await seed();
    const clerk = { userId: "c1", email: "c@x.test", name: "Nok", role: "admin" } as const;
    expect((await setStaffPin(db, clerk, "m1", "481920", NOW, PEPPER, KEY)).status).toBe(403);
  });

  it("refuses a PIN that isn't six digits, or one anybody would guess", async () => {
    const { db } = await seed();
    expect((await setStaffPin(db, boss, "m1", "1234", NOW, PEPPER, KEY)).status).toBe(400);
    expect((await setStaffPin(db, boss, "m1", "111111", NOW, PEPPER, KEY)).status).toBe(400);
  });

  it("refuses a PIN somebody else already holds", async () => {
    const { db } = await seed();
    await setOwnPin(db, them, "620418", NOW, PEPPER, KEY);
    expect((await setStaffPin(db, boss, "boss", "620418", NOW, PEPPER, KEY)).status).toBe(409);
  });

  it("clearing a PIN destroys the readable copy too", async () => {
    const { raw, db } = await seed();
    await setOwnPin(db, them, "620418", NOW, PEPPER, KEY);
    await clearStaffPin(db, boss, "m1", NOW + 1);
    const row = raw.prepare(`SELECT pin_cipher AS c FROM users WHERE id='m1'`).get() as {
      c: string | null;
    };
    expect(row.c).toBeNull();
  });

  it("says a password EXISTS even when it can't be revealed", async () => {
    const { raw, db } = await seed();
    // A password set before the encryption key existed: a working hash, no readable copy. The eye
    // has to stay usable-looking rather than claiming there is no password.
    const hashed = await hashPassword("older-password", { iterations: 1000 });
    raw
      .prepare(
        `UPDATE users SET password_hash=?, password_salt=?, password_iterations=? WHERE id='m1'`,
      )
      .run(hashed.hash, hashed.salt, hashed.iterations);
    const body = (await (await staffProfileFor(db, boss, "m1", KEY)).json()) as {
      profile: { password: string | null; hasPassword: number };
    };
    expect(body.profile.hasPassword).toBe(1);
    expect(body.profile.password).toBeNull();
  });

  it("with no key configured, the PIN reads as unavailable rather than as absent", async () => {
    const { db } = await seed();
    await setOwnPin(db, them, "620418", NOW, PEPPER, KEY);
    const body = (await (await staffProfileFor(db, boss, "m1", "")).json()) as {
      profile: { pin: string | null; hasPin: number };
    };
    // hasPin still says there IS one — only the reveal is unavailable.
    expect(body.profile.pin).toBeNull();
    expect(body.profile.hasPin).toBe(1);
  });
});

// ── Wage slips: required to confirm, gone after three months ─────────────────────────────────────
describe("wage transfer slips", () => {
  const NOW = 1_800_000_000_000; // 2027-01-15
  const boss = {
    userId: "boss",
    email: "boss@shop.test",
    name: "Boss",
    role: "super_admin",
  } as const;
  const mech = { userId: "s1", email: "s@shop.test", name: "Somchai", role: "mechanic" } as const;

  async function seed() {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at,day_rate_satang,
                            bank_name,bank_account_no,bank_account_name)
         VALUES ('boss','Boss','boss@shop.test','super_admin','active',?,NULL,NULL,NULL,NULL)`,
      )
      .run(NOW);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at,day_rate_satang,
                            bank_name,bank_account_no,bank_account_name)
         VALUES ('s1','Somchai','s@shop.test','mechanic','active',?,40000,
                 'Kasikorn','1234567890','Somchai Jaidee')`,
      )
      .run(NOW);
    return { raw, db };
  }

  /** A stand-in for the R2 bucket: remembers what was deleted so the sweep can be checked. */
  function fakeBucket() {
    const deleted: string[] = [];
    return {
      deleted,
      bucket: { delete: async (k: string) => void deleted.push(k) } as unknown as R2Bucket,
    };
  }

  // CHANGED 2026-08-24: a slip used to be demanded for every payment. It is now demanded only for a
  // TRANSFER — cash needs none — because a shop that mostly hands over cash was being pushed into
  // either not recording the payment or attaching something meaningless. The cash path is covered
  // in advances.test.ts; this keeps the half of the old rule that still holds.
  it("given a transfer with no slip > when marking paid > then it is refused", async () => {
    const { db } = await seed();
    const res = await markSalaryPaid(db, boss, "s1", "2026-07", NOW, {
      method: "transfer",
      slipKey: null,
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/slip/i);
  });

  it("given a slip > then the payslip keeps its key and the month reads as paid", async () => {
    const { raw, db } = await seed();
    expect(
      (
        await markSalaryPaid(db, boss, "s1", "2026-07", NOW, {
          method: "transfer",
          slipKey: "salary-slip/s1/x.jpg",
        })
      ).status,
    ).toBe(200);
    const row = raw
      .prepare(
        `SELECT slip_key AS k, slip_uploaded_at AS at FROM staff_payslips WHERE user_id='s1'`,
      )
      .get() as { k: string; at: number };
    expect(row.k).toBe("salary-slip/s1/x.jpg");
    expect(row.at).toBe(NOW);
  });

  it("the month's rows carry the bank details needed to pay, and whether a slip is held", async () => {
    const { db } = await seed();
    await markSalaryPaid(db, boss, "s1", "2026-07", NOW, {
      method: "transfer",
      slipKey: "salary-slip/s1/x.jpg",
    });
    const body = (await (await salaryMonth(db, boss, "2026-07")).json()) as {
      rows: {
        userId: string;
        bankName: string | null;
        bankAccountNo: string | null;
        bankAccountName: string | null;
        hasSlip: boolean;
      }[];
    };
    const row = body.rows.find((r) => r.userId === "s1")!;
    expect(row.bankName).toBe("Kasikorn");
    expect(row.bankAccountNo).toBe("1234567890");
    expect(row.bankAccountName).toBe("Somchai Jaidee");
    expect(row.hasSlip).toBe(true);
  });

  it("given a payment three months old > when the sweep runs > then the image goes and the record stays", async () => {
    const { raw, db } = await seed();
    const paidAt = Date.UTC(2026, 9, 5); // 5 October 2026 — expires 5 January 2027
    await markSalaryPaid(db, boss, "s1", "2026-09", paidAt, {
      method: "transfer",
      slipKey: "salary-slip/s1/old.jpg",
    });
    const { deleted, bucket } = fakeBucket();

    const purged = await purgeExpiredSalarySlips(db, bucket, NOW);

    expect(purged).toBe(1);
    expect(deleted).toEqual(["salary-slip/s1/old.jpg"]);
    const row = raw
      .prepare(
        `SELECT slip_key AS k, paid_at AS paidAt, amount_satang AS amt
                  FROM staff_payslips WHERE user_id='s1'`,
      )
      .get() as { k: string | null; paidAt: number; amt: number };
    expect(row.k).toBeNull(); // the image is gone…
    expect(row.paidAt).toBe(paidAt); // …the payment record is not
    expect(row.amt).toBeGreaterThan(0);
  });

  it("given a recent payment > then the sweep leaves it alone", async () => {
    const { db } = await seed();
    await markSalaryPaid(db, boss, "s1", "2026-12", Date.UTC(2026, 11, 5), {
      method: "transfer",
      slipKey: "salary-slip/s1/new.jpg",
    });
    const { deleted, bucket } = fakeBucket();
    expect(await purgeExpiredSalarySlips(db, bucket, NOW)).toBe(0);
    expect(deleted).toEqual([]);
  });

  it("a slip is readable by the owner and by the person it paid, and by nobody else", async () => {
    const { db } = await seed();
    await markSalaryPaid(db, boss, "s1", "2026-07", NOW, {
      method: "transfer",
      slipKey: "salary-slip/s1/x.jpg",
    });
    expect(await salarySlipKey(db, boss, "s1", "2026-07")).toBe("salary-slip/s1/x.jpg");
    expect(await salarySlipKey(db, mech, "s1", "2026-07")).toBe("salary-slip/s1/x.jpg");
    const other = { ...mech, userId: "s2", email: "s2@shop.test" };
    expect(await salarySlipKey(db, other, "s1", "2026-07")).toBeNull();
  });
});

describe("staffPayments — one person's wage history", () => {
  const NOW = 1_800_000_000_000;
  const boss = {
    userId: "boss",
    email: "boss@shop.test",
    name: "Boss",
    role: "super_admin",
  } as const;
  const mech = { userId: "s1", email: "s@shop.test", name: "Somchai", role: "mechanic" } as const;

  async function seed() {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at,day_rate_satang)
         VALUES ('boss','Boss','boss@shop.test','super_admin','active',?,NULL)`,
      )
      .run(NOW);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at,day_rate_satang)
         VALUES ('s1','Somchai','s@shop.test','mechanic','active',?,40000)`,
      )
      .run(NOW);
    return { raw, db };
  }

  it("lists that person's months, newest first, with whether a slip is still held", async () => {
    const { db } = await seed();
    await markSalaryPaid(db, boss, "s1", "2026-06", NOW - 100, {
      method: "transfer",
      slipKey: "salary-slip/s1/jun.jpg",
    });
    await markSalaryPaid(db, boss, "s1", "2026-07", NOW, {
      method: "transfer",
      slipKey: "salary-slip/s1/jul.jpg",
    });

    const body = (await (await staffPayments(db, boss, "s1", "2026-07")).json()) as {
      payments: { period: string; earnedSatang: number; paidAt: number; hasSlip: boolean }[];
    };
    expect(body.payments.map((p) => p.period)).toEqual(["2026-07", "2026-06"]);
    expect(body.payments[0]!.hasSlip).toBe(true);
    expect(body.payments[0]!.earnedSatang).toBeGreaterThan(0);
  });

  it("a swept slip leaves the payment on the list, just without one", async () => {
    const { raw, db } = await seed();
    await markSalaryPaid(db, boss, "s1", "2026-06", NOW, {
      method: "transfer",
      slipKey: "salary-slip/s1/jun.jpg",
    });
    raw.prepare(`UPDATE staff_payslips SET slip_key = NULL`).run();
    const body = (await (await staffPayments(db, boss, "s1", "2026-07")).json()) as {
      payments: { period: string; hasSlip: boolean; paidAt: number | null }[];
    };
    // Two rows now, not one: the running month is always listed (2026-07 here) alongside the paid
    // month whose slip was swept. Asserting on the June row rather than the count, so this test
    // keeps testing the sweep rather than the shape of the list.
    const june = body.payments.find((p) => p.period === "2026-06")!;
    expect(june.paidAt).not.toBeNull();
    expect(june.hasSlip).toBe(false);
  });

  it("a person may read their own wage history, but never anyone else's", async () => {
    const { db } = await seed();
    await markSalaryPaid(db, boss, "s1", "2026-07", NOW, {
      method: "transfer",
      slipKey: "salary-slip/s1/jul.jpg",
    });
    expect((await staffPayments(db, mech, "s1", "2026-07")).status).toBe(200);
    const other = { ...mech, userId: "s2", email: "s2@shop.test" };
    expect((await staffPayments(db, other, "s1", "2026-07")).status).toBe(403);
  });
});

// ── A paid order is a proven order ───────────────────────────────────────────────────────────────
// The owner's locked rule (2026-08-04): "all slips need to be approved > then turn to 'to ship'".
// A slip cannot be approved if there is no slip, so confirming payment without one is refused.
describe("reviewOrderPayment > a transfer cannot be confirmed without its slip", () => {
  const NOW = 1_800_000_000_000;

  function awaitingReview(opts: { slip?: string | null } = {}) {
    const raw = migratedDb();
    raw
      .prepare(
        `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status,
                                   order_created_at, imported_at, slip_image_key)
         VALUES ('o1','airplus','AP-1','new','verifying',?,?,?)`,
      )
      .run(NOW, NOW, opts.slip ?? null);
    return { raw, db: asD1(raw) };
  }

  const status = (raw: DatabaseSync) =>
    (
      raw.prepare(`SELECT payment_status AS s FROM sales_orders WHERE id='o1'`).get() as {
        s: string;
      }
    ).s;

  it("given no slip on the order > when confirming > then it is refused and stays unpaid", async () => {
    const { raw, db } = awaitingReview({ slip: null });
    const out = await reviewOrderPayment(db, "o1", "confirm", null, "boss@shop.test", NOW);
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.code).toBe(409);
    // Unpaid means the flow stops — the order must not become To ship.
    expect(status(raw)).toBe("verifying");
  });

  it("given a slip on the order > when confirming > then it settles as paid", async () => {
    const { raw, db } = awaitingReview({ slip: "slip/o1/a.jpg" });
    const out = await reviewOrderPayment(db, "o1", "confirm", null, "boss@shop.test", NOW);
    expect(out.ok).toBe(true);
    expect(status(raw)).toBe("paid");
  });

  it("rejecting needs no slip — that is the case where one never arrived", async () => {
    const { raw, db } = awaitingReview({ slip: null });
    const out = await reviewOrderPayment(db, "o1", "reject", "ไม่พบสลิป", "boss@shop.test", NOW);
    expect(out.ok).toBe(true);
    expect(status(raw)).toBe("pending");
  });
});

describe("updateOrder > paid is not a status you can simply type", () => {
  const NOW = 1_800_000_000_000;

  function order(opts: { slip?: string | null; status?: string } = {}) {
    const raw = migratedDb();
    raw
      .prepare(
        `INSERT INTO sales_orders (id, channel, external_order_id, order_status, payment_status,
                                   order_created_at, imported_at, slip_image_key)
         VALUES ('o1','airplus','AP-1','new',?,?,?,?)`,
      )
      .run(opts.status ?? "verifying", NOW, NOW, opts.slip ?? null);
    return { raw, db: asD1(raw) };
  }
  const paymentStatus = (raw: DatabaseSync) =>
    (
      raw.prepare(`SELECT payment_status AS s FROM sales_orders WHERE id='o1'`).get() as {
        s: string;
      }
    ).s;

  it("given no slip > when an admin patches it straight to paid > then it is refused", async () => {
    const { raw, db } = order({ slip: null });
    const out = await updateOrder(db, "o1", { paymentStatus: "paid" });
    expect(out.ok).toBe(false);
    expect(paymentStatus(raw)).toBe("verifying");
  });

  it("given a slip > then the same patch is allowed, so a mistake can still be corrected", async () => {
    const { raw, db } = order({ slip: "slip/o1/a.jpg" });
    expect((await updateOrder(db, "o1", { paymentStatus: "paid" })).ok).toBe(true);
    expect(paymentStatus(raw)).toBe("paid");
  });

  it("COD is a different flow — its statuses never need a transfer slip", async () => {
    const { raw, db } = order({ slip: null, status: "cod" });
    expect((await updateOrder(db, "o1", { paymentStatus: "cod_confirmed" })).ok).toBe(true);
    expect(paymentStatus(raw)).toBe("cod_confirmed");
  });
});

// ── The activity log is read by a person ─────────────────────────────────────────────────────────
describe("staff activity names the person it is about, never their id", () => {
  const NOW = 1_800_000_000_000;
  const boss = {
    userId: "boss",
    email: "boss@shop.test",
    name: "Boss",
    role: "super_admin",
  } as const;
  const UUID = "d7f46888-9b19-4b3c-a78a-c355eeaf7d4e";

  function seed() {
    const raw = migratedDb();
    raw
      .prepare(
        `INSERT INTO users (id,name,name_th,email,role,status,created_at)
         VALUES ('boss','Boss','เลดี้','boss@shop.test','super_admin','active',?)`,
      )
      .run(NOW);
    raw
      .prepare(
        `INSERT INTO users (id,name,name_th,email,role,status,created_at)
         VALUES (?, 'Somchai','สมชาย','s@shop.test','mechanic','active',?)`,
      )
      .run(UUID, NOW);
    return { raw, db: asD1(raw) };
  }

  const details = async (db: D1Database) =>
    (
      (await (await staffActivity(db, boss, {})).json()) as {
        activity: { detail: string | null }[];
      }
    ).activity.map((a) => a.detail ?? "");

  it("given a profile edit > then the line names them, with no id in sight", async () => {
    const { db } = seed();
    await updateStaffProfile(db, boss, UUID, { phone: "081-555-0000" }, NOW);
    const lines = await details(db);
    expect(lines.join(" ")).toContain("สมชาย");
    expect(lines.join(" ")).not.toContain(UUID);
  });

  it("given a PIN cleared > then the line names them", async () => {
    const { db } = seed();
    await clearStaffPin(db, boss, UUID, NOW);
    const lines = await details(db);
    expect(lines.join(" ")).toContain("สมชาย");
    expect(lines.join(" ")).not.toContain(UUID);
  });

  it("given a PIN reset > then the line names them", async () => {
    const { db } = seed();
    await setStaffPin(db, boss, UUID, "482913", NOW, "test-pepper", "9f".repeat(32));
    const lines = await details(db);
    expect(lines.join(" ")).toContain("สมชาย");
    expect(lines.join(" ")).not.toContain(UUID);
  });
});

// ── Deleting a product is super-admin only (owner, 2026-08-24) ───────────────────────────────────
// Against the real migrated schema and a real session, not the canned mock: the point of these
// tests is the AUTHORISATION boundary, and a mock that matches on sql.includes() would approve a
// query that forgot it. The UI also hides the delete box for other roles, but a hidden control is
// not a permission — this is where the rule is actually enforced.
describe("DELETE /products/:id — super admin only", () => {
  const NOW = 1_800_000_000_000;

  async function withRole(role: string) {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id, name, email, role, status, created_at)
         VALUES ('u1', 'Somchai', 'somchai@shop.test', ?, 'active', ?)`,
      )
      .run(role, NOW);
    raw
      .prepare(
        `INSERT INTO products (id, name, status, created_at, shopee_listed, weight_grams)
         VALUES ('p1', 'คอมเพรสเซอร์ Denso 10PA17C', 'active', ?, 0, 0)`,
      )
      .run(NOW);
    const { token } = await createStaffSession(db, "u1", NOW);
    return { raw, env: { DB: db } as unknown as Env, token };
  }

  const del = (env: Env, token?: string) =>
    worker.fetch!(
      new Request("https://x/products/p1", {
        method: "DELETE",
        headers: token ? { "X-Staff-Session": token } : {},
      }),
      env,
      ctx,
    );

  const statusOf = (raw: DatabaseSync) =>
    (raw.prepare(`SELECT status FROM products WHERE id = 'p1'`).get() as { status: string }).status;

  it("given the super admin > the product is really removed", async () => {
    // This asserted status='archived' for a few hours on 2026-08-24, between deleting becoming
    // super-admin-only and the owner separating the two words. Delete now means gone; "not live"
    // is what archive means, and it lives on its own route.
    const { raw, env, token } = await withRole("super_admin");
    const res = await del(env, token);
    expect(res.status).toBe(200);
    expect(
      (raw.prepare(`SELECT COUNT(*) AS n FROM products WHERE id='p1'`).get() as { n: number }).n,
    ).toBe(0);
  });

  it("given an admin > refuses, and the product survives", async () => {
    // An admin runs the catalog day to day. Destroying part of it is the owner's call — and there
    // is no restore screen, so a refusal here is the only thing standing between a slip and D1.
    const { raw, env, token } = await withRole("admin");
    const res = await del(env, token);
    expect(res.status).toBe(403);
    expect(statusOf(raw)).toBe("active");
  });

  it("given a mechanic > refuses, and the product survives", async () => {
    const { raw, env, token } = await withRole("mechanic");
    const res = await del(env, token);
    expect(res.status).toBe(403);
    expect(statusOf(raw)).toBe("active");
  });

  it("given no staff session at all > refuses rather than falling through", async () => {
    // Cloudflare Access sits in front of the admin host, but the API is its own public hostname
    // and has to defend itself. No session means no role, and no role must never mean "allowed".
    const { raw, env } = await withRole("super_admin");
    const res = await del(env);
    expect(res.status).toBe(401);
    expect(statusOf(raw)).toBe("active");
  });
});

// ── The permission matrix, actually enforced (owner, 2026-08-24) ─────────────────────────────────
// Until now `canViewFinance`, `canRefund`, `canWrite` and `canReviewPaymentRole` were defined and
// unit-tested but never CALLED, so every rule below was decoration. These tests exercise the real
// routes so a green permission test can no longer be mistaken for an enforced rule.
//
// Identity comes from the STAFF SESSION, not the Cloudflare Access email. Since per-staff logins
// shipped, the Access email identifies whoever opened the host, not who is operating the admin —
// and `MECHANIC_EMAILS` is unset in prod, so the email lists cannot recognise a mechanic at all.
describe("role enforcement on money, catalog and payment routes", () => {
  const NOW = 1_800_000_000_000;

  async function asRole(role: string) {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at)
         VALUES ('u1','Somchai','s@shop.test',?,'active',?)`,
      )
      .run(role, NOW);
    raw
      .prepare(
        `INSERT INTO products (id,name,status,created_at,shopee_listed,weight_grams)
         VALUES ('p1','Compressor','active',?,0,0)`,
      )
      .run(NOW);
    const { token } = await createStaffSession(db, "u1", NOW);
    return { raw, env: { DB: db } as unknown as Env, token };
  }

  const call = (env: Env, path: string, init: RequestInit = {}, token?: string) =>
    worker.fetch!(
      new Request(`https://x${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(token ? { "X-Staff-Session": token } : {}),
        },
      }),
      env,
      ctx,
    );

  describe("Finance is the super admin's alone", () => {
    for (const role of ["admin", "mechanic"]) {
      it(`given a ${role} > 403 on the expenses list`, async () => {
        const { env, token } = await asRole(role);
        expect((await call(env, "/finance/expenses", {}, token)).status).toBe(403);
      });
      it(`given a ${role} > 403 on the finance summary`, async () => {
        const { env, token } = await asRole(role);
        expect((await call(env, "/finance/summary", {}, token)).status).toBe(403);
      });
    }
    it("given the super admin > lets them through", async () => {
      const { env, token } = await asRole("super_admin");
      expect((await call(env, "/finance/expenses", {}, token)).status).toBe(200);
    });
    it("given no session > 401, never an open door", async () => {
      const { env } = await asRole("super_admin");
      expect((await call(env, "/finance/expenses")).status).toBe(401);
    });
  });

  describe("refunds are the super admin's alone", () => {
    // These routes already checked the Access email list, but that identifies whoever opened the
    // host — not who is signed in. In this harness ACCESS_AUD is unset, so `isSuperAdmin` fails
    // OPEN exactly as it does in local dev; only the staff-role check can refuse here.
    for (const role of ["admin", "mechanic"]) {
      it(`given a ${role} > 403 on an order refund`, async () => {
        const { env, token } = await asRole(role);
        const res = await call(env, "/orders/o1/refund", { method: "POST" }, token);
        expect(res.status).toBe(403);
      });
      it(`given a ${role} > 403 on a claim refund`, async () => {
        const { env, token } = await asRole(role);
        expect((await call(env, "/claims/c1/refund", { method: "POST" }, token)).status).toBe(403);
      });
    }
  });

  describe("a mechanic reads the catalog but never changes it", () => {
    it("given a mechanic > 403 editing a product", async () => {
      const { env, token } = await asRole("mechanic");
      const res = await call(
        env,
        "/products/p1",
        { method: "PATCH", body: JSON.stringify({ name: "Renamed by a mechanic" }) },
        token,
      );
      expect(res.status).toBe(403);
    });

    it("given an admin > allowed to edit a product; only DELETE is the owner's", async () => {
      const { env, token } = await asRole("admin");
      const res = await call(
        env,
        "/products/p1",
        { method: "PATCH", body: JSON.stringify({ name: "Renamed by an admin" }) },
        token,
      );
      expect(res.status).not.toBe(403);
    });

    it("given a mechanic > 403 changing a customer", async () => {
      const { env, token } = await asRole("mechanic");
      const res = await call(
        env,
        "/customers/by-plate",
        { method: "PUT", body: JSON.stringify({ plate: "1กก1234", name: "X" }) },
        token,
      );
      expect(res.status).toBe(403);
    });
  });

  describe("a mechanic never signs off an online order's payment", () => {
    it("given a mechanic marking an order paid > 403", async () => {
      const { env, token } = await asRole("mechanic");
      const res = await call(
        env,
        "/orders/o1",
        { method: "PATCH", body: JSON.stringify({ paymentStatus: "paid" }) },
        token,
      );
      expect(res.status).toBe(403);
    });

    it("given a mechanic touching a NON-payment field > allowed", async () => {
      // The rule is about signing off money, not about locking a mechanic out of orders entirely.
      const { env, token } = await asRole("mechanic");
      const res = await call(
        env,
        "/orders/o1",
        { method: "PATCH", body: JSON.stringify({ trackingNo: "TH123" }) },
        token,
      );
      expect(res.status).not.toBe(403);
    });

    it("given an admin marking an order paid > allowed, that is the operational call", async () => {
      const { env, token } = await asRole("admin");
      const res = await call(
        env,
        "/orders/o1",
        { method: "PATCH", body: JSON.stringify({ paymentStatus: "paid" }) },
        token,
      );
      expect(res.status).not.toBe(403);
    });
  });
});

// ── Bank slips move onto the staff session (owner, 2026-08-24) ───────────────────────────────────
// The RULE is unchanged and was already right: approving a payment is any admin's call, but the
// customer's slip IMAGE — their bank, their account number — is the super admin's alone. Only the
// identity behind it moved, from the Access email list (which fails open where Access is
// unconfigured, and names whoever opened the host rather than whoever signed in) to the staff row.
describe("GET /file/:key — slip images follow the staff role", () => {
  const NOW = 1_800_000_000_000;

  async function asRole(role: string) {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at)
         VALUES ('u1','Somchai','s@shop.test',?,'active',?)`,
      )
      .run(role, NOW);
    const { token } = await createStaffSession(db, "u1", NOW);
    // R2 stub: presence is irrelevant to the authorisation answer, which is what these assert.
    const IMAGES = { get: async () => null };
    return { env: { DB: db, IMAGES } as unknown as Env, token };
  }

  const get = (env: Env, key: string, token?: string) =>
    worker.fetch!(
      new Request(`https://x/file/${key}`, {
        headers: token ? { "X-Staff-Session": token } : {},
      }),
      env,
      ctx,
    );

  it("given a bank slip and the super admin > allowed through to storage", async () => {
    const { env, token } = await asRole("super_admin");
    // 404 = permitted, then the (empty) stub had no object. Anything but 403.
    expect((await get(env, "slip/o1/1.jpg", token)).status).not.toBe(403);
  });

  for (const role of ["admin", "mechanic"]) {
    it(`given a bank slip and a ${role} > 403, they never see the customer's bank details`, async () => {
      const { env, token } = await asRole(role);
      expect((await get(env, "slip/o1/1.jpg", token)).status).toBe(403);
    });
  }

  it("given no staff session > 401, never the old fail-open", async () => {
    // The replaced path answered "ok" for a slip whenever ACCESS_AUD was unset — exactly this
    // harness's configuration. That default is gone.
    const { env } = await asRole("super_admin");
    expect((await get(env, "slip/o1/1.jpg")).status).toBe(401);
  });

  it("given claim evidence and a mechanic > allowed; it is not bank PII", async () => {
    const { env, token } = await asRole("mechanic");
    expect((await get(env, "claim/o1/1.jpg", token)).status).not.toBe(403);
  });

  it("given our outgoing refund slip and an admin > allowed; it is proof WE paid, not their PII", async () => {
    const { env, token } = await asRole("admin");
    expect((await get(env, "refund-slip/o1/1.jpg", token)).status).not.toBe(403);
  });

  it("given any other namespace > 404 even for the super admin, so a guessed key reaches nothing", async () => {
    const { env, token } = await asRole("super_admin");
    expect((await get(env, "backups/db.json", token)).status).toBe(404);
  });
});

// ── The order page's slip gate follows the staff role too ────────────────────────────────────────
// `viewerIsSuperAdmin` is what hides the slip preview in the UI and redacts the customer's refund
// bank details from the response. It read the Access email list; it now reads the staff session.
// Resolved OPTIONALLY rather than required: an order should still render for anyone allowed to see
// the page, it just carries less. Absence of a session therefore means "not a super admin", never
// "assume yes" — the same fail-CLOSED direction as the file route.
describe("GET /orders/:id — the slip gate follows the staff role", () => {
  const NOW = 1_800_000_000_000;

  async function seedOrderAndRole(role: string) {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at)
         VALUES ('u1','Somchai','s@shop.test',?,'active',?)`,
      )
      .run(role, NOW);
    raw
      .prepare(
        `INSERT INTO sales_orders
           (id, channel, external_order_id, imported_at,
            refund_bank_name, refund_account_no, refund_account_name)
         VALUES ('o1','airplus','AP-1',?,'SCB','1234567890','ลูกค้า ทดสอบ')`,
      )
      .run(NOW);
    const { token } = await createStaffSession(db, "u1", NOW);
    return { env: { DB: db } as unknown as Env, token };
  }

  const detail = async (env: Env, token?: string) => {
    const res = await worker.fetch!(
      new Request("https://x/orders/o1", { headers: token ? { "X-Staff-Session": token } : {} }),
      env,
      ctx,
    );
    return (await res.json()) as {
      viewerIsSuperAdmin: boolean;
      order: { refundAccountNo: string | null };
    };
  };

  it("given the super admin > may see slips, and the bank details come through", async () => {
    const { env, token } = await seedOrderAndRole("super_admin");
    const body = await detail(env, token);
    expect(body.viewerIsSuperAdmin).toBe(true);
    expect(body.order.refundAccountNo).toBe("1234567890");
  });

  for (const role of ["admin", "mechanic"]) {
    it(`given a ${role} > no slips, and the customer's account number is stripped`, async () => {
      const { env, token } = await seedOrderAndRole(role);
      const body = await detail(env, token);
      expect(body.viewerIsSuperAdmin).toBe(false);
      expect(body.order.refundAccountNo).toBeNull();
    });
  }

  it("given no session > treated as NOT a super admin, never assumed yes", async () => {
    const { env } = await seedOrderAndRole("super_admin");
    const body = await detail(env);
    expect(body.viewerIsSuperAdmin).toBe(false);
    expect(body.order.refundAccountNo).toBeNull();
  });
});

// ── "Not live" needs archived rows, but ONLY where they were asked for ───────────────────────────
// The merged tab (owner, 2026-08-24) shows draft + paused + archived together. That means the admin
// products list has to be able to return archived rows — and the SAME payload feeds the POS and the
// Barcodes page, where an archived product must never appear or you could sell a deleted part.
// Hence opt-in: the default is unchanged, and only the products table asks.
// "Archived" was retired into "paused" on 2026-08-24 (owner: "Archived = Paused globally, and
// delete = gone"), so the list no longer hides anything and the `includeArchived` opt-in is gone.
// Three states remain: active, draft, paused — all of them normal rows the admin should see.
describe("GET /products — every state the catalog has", () => {
  const NOW = 1_800_000_000_000;

  function seeded() {
    const raw = migratedDb();
    for (const [id, name, status] of [
      ["p-live", "Live compressor", "active"],
      ["p-draft", "Half-written", "draft"],
      ["p-paused", "Taken off the shop", "paused"],
    ] as const) {
      raw
        .prepare(
          `INSERT INTO products (id,name,status,created_at,shopee_listed,weight_grams)
           VALUES (?,?,?,?,0,0)`,
        )
        .run(id, name, status, NOW);
    }
    return { env: { DB: asD1(raw) } as unknown as Env };
  }

  it("returns live, draft and paused alike — the tab decides what is shown, not the query", async () => {
    const { env } = seeded();
    const res = await worker.fetch!(new Request("https://x/products"), env, ctx);
    const body = (await res.json()) as { products: { id: string }[] };
    expect(body.products.map((p) => p.id).sort()).toEqual(["p-draft", "p-live", "p-paused"]);
  });
});

// ── Delete means GONE; Archive means not live (owner, 2026-08-24) ────────────────────────────────
// Until now both words meant the same thing: DELETE /products/:id set status='archived'. The owner
// separated them — "delete = delete from the system", "archive = not live" — so DELETE now really
// removes the row and its catalog data.
//
// THE GUARD IS THE WHOLE POINT. `sales_order_lines` and `onsite_sale_lines` point at a product's
// VARIANT and store no product name of their own, so removing a product that has ever been sold
// would leave past orders holding a line that cannot say what was in it — and the books are built
// from those lines. A product with history is refused and must be archived instead.
describe("DELETE /products/:id — a real delete, refused when there is history", () => {
  const NOW = 1_800_000_000_000;

  async function seed(opts: { sold?: boolean; movements?: boolean } = {}) {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at)
         VALUES ('u1','Boss','boss@shop.test','super_admin','active',?)`,
      )
      .run(NOW);
    raw
      .prepare(
        `INSERT INTO products (id,name,status,created_at,shopee_listed,weight_grams)
         VALUES ('p1','Compressor','active',?,0,0)`,
      )
      .run(NOW);
    raw
      .prepare(`INSERT INTO product_variants (id,product_id,created_at) VALUES ('v1','p1',?)`)
      .run(NOW);
    if (opts.sold) {
      raw
        .prepare(
          `INSERT INTO sales_orders (id,channel,external_order_id,imported_at)
           VALUES ('o1','airplus','AP-1',?)`,
        )
        .run(NOW);
      raw
        .prepare(
          `INSERT INTO sales_order_lines
             (id,sales_order_id,product_variant_id,quantity,unit_price_satang,line_total_satang,created_at)
           VALUES ('l1','o1','v1',1,10000,10000,?)`,
        )
        .run(NOW);
    }
    if (opts.movements) {
      raw
        .prepare(
          `INSERT INTO stock_ledger_entries
             (id,product_variant_id,movement_type,quantity_delta,quantity_after,created_at)
           VALUES ('m1','v1','receive',5,5,?)`,
        )
        .run(NOW);
    }
    const { token } = await createStaffSession(db, "u1", NOW);
    return { raw, env: { DB: db } as unknown as Env, token };
  }

  const del = (env: Env, token: string) =>
    worker.fetch!(
      new Request("https://x/products/p1", {
        method: "DELETE",
        headers: { "X-Staff-Session": token },
      }),
      env,
      ctx,
    );

  const count = (raw: DatabaseSync, sql: string) => (raw.prepare(sql).get() as { n: number }).n;

  it("given a product with no history > the row and its variants are really gone", async () => {
    const { raw, env, token } = await seed();
    const res = await del(env, token);
    expect(res.status).toBe(200);
    expect(count(raw, `SELECT COUNT(*) AS n FROM products WHERE id='p1'`)).toBe(0);
    expect(count(raw, `SELECT COUNT(*) AS n FROM product_variants WHERE product_id='p1'`)).toBe(0);
  });

  it("given a product that has been SOLD > refused, and nothing is touched", async () => {
    // The order line names no product of its own. Delete it and the order can never say what was
    // in it — and Finance is built from those lines.
    const { raw, env, token } = await seed({ sold: true });
    const res = await del(env, token);
    expect(res.status).toBe(409);
    expect((await res.json()) as { reason: string }).toMatchObject({ reason: "has_history" });
    expect(count(raw, `SELECT COUNT(*) AS n FROM products WHERE id='p1'`)).toBe(1);
    expect(count(raw, `SELECT COUNT(*) AS n FROM sales_order_lines WHERE id='l1'`)).toBe(1);
  });

  it("given a product with stock movements > refused; the ledger is an audit trail", async () => {
    const { raw, env, token } = await seed({ movements: true });
    expect((await del(env, token)).status).toBe(409);
    expect(count(raw, `SELECT COUNT(*) AS n FROM products WHERE id='p1'`)).toBe(1);
  });

  it("pausing is what a sold product gets instead, and it is reversible", async () => {
    // Its own endpoint rather than PATCH: PATCH /products/:id demands a whole product body, and
    // "take this off the shop" should not require re-sending the catalog entry to say so.
    const { raw, env, token } = await seed({ sold: true });
    const post = (path: string) =>
      worker.fetch!(
        new Request(`https://x/products/p1/${path}`, {
          method: "POST",
          headers: { "X-Staff-Session": token },
        }),
        env,
        ctx,
      );
    const status = () =>
      (raw.prepare(`SELECT status FROM products WHERE id='p1'`).get() as { status: string }).status;

    expect((await post("pause")).status).toBe(200);
    expect(status()).toBe("paused");

    // ...and back again. That is the whole difference from delete: nothing was lost.
    expect((await post("resume")).status).toBe(200);
    expect(status()).toBe("active");
  });

  it("resuming puts a product back ON SALE — pausing is what you do to something that was selling", async () => {
    // Deliberately not "draft": you pause a product that was on sale, so the undo is putting it
    // back on sale. It publishes, which is why it is super-admin only and the button says so.
    const { raw, env, token } = await seed();
    raw.prepare(`UPDATE products SET status='paused' WHERE id='p1'`).run();
    await worker.fetch!(
      new Request("https://x/products/p1/resume", {
        method: "POST",
        headers: { "X-Staff-Session": token },
      }),
      env,
      ctx,
    );
    expect(
      (raw.prepare(`SELECT status FROM products WHERE id='p1'`).get() as { status: string }).status,
    ).toBe("active");
  });

  it("pausing is super-admin only, like deleting", async () => {
    const { raw, env } = await seed();
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at)
         VALUES ('u2','Adm','adm@shop.test','admin','active',?)`,
      )
      .run(NOW);
    const { token } = await createStaffSession(asD1(raw), "u2", NOW);
    const res = await worker.fetch!(
      new Request("https://x/products/p1/pause", {
        method: "POST",
        headers: { "X-Staff-Session": token },
      }),
      env,
      ctx,
    );
    expect(res.status).toBe(403);
  });
});

// ── Pausing per channel (owner, 2026-08-24) ──────────────────────────────────────────────────────
// AirPlus and Shopee are paused separately, from the products-table row menu.
//
// AirPlus is real: the storefront gates on `status = 'active'`, so pause/resume genuinely takes a
// product off the shop and puts it back.
//
// Shopee is BOOKKEEPING ONLY. There is no Shopee connection — `shopee.ts` holds signing helpers
// that nothing imports, and the sync queue is commented out in wrangler.jsonc. `shopee_listed`
// drives the dashboard's MANUAL "Update on Shopee" worklist and the Not-listed pill, so unlisting
// here removes a product from that to-do list; pausing it on Shopee itself is still done by hand on
// Shopee's own site.
describe("POST /products/:id/shopee/list|unlist — the Shopee listing flag", () => {
  const NOW = 1_800_000_000_000;

  async function seed(role = "super_admin", listed = 1) {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at)
         VALUES ('u1','Somchai','s@shop.test',?,'active',?)`,
      )
      .run(role, NOW);
    raw
      .prepare(
        `INSERT INTO products (id,name,status,created_at,shopee_listed,weight_grams)
         VALUES ('p1','Compressor','active',?,?,0)`,
      )
      .run(NOW, listed);
    const { token } = await createStaffSession(db, "u1", NOW);
    return { raw, env: { DB: db } as unknown as Env, token };
  }

  const post = (env: Env, path: string, token?: string) =>
    worker.fetch!(
      new Request(`https://x/products/p1/shopee/${path}`, {
        method: "POST",
        headers: token ? { "X-Staff-Session": token } : {},
      }),
      env,
      ctx,
    );

  const listed = (raw: DatabaseSync) =>
    (raw.prepare(`SELECT shopee_listed AS n FROM products WHERE id='p1'`).get() as { n: number }).n;

  it("unlist > clears the flag, so the product drops off the manual Shopee worklist", async () => {
    const { raw, env, token } = await seed("super_admin", 1);
    expect((await post(env, "unlist", token)).status).toBe(200);
    expect(listed(raw)).toBe(0);
  });

  it("list > sets it again", async () => {
    const { raw, env, token } = await seed("super_admin", 0);
    expect((await post(env, "list", token)).status).toBe(200);
    expect(listed(raw)).toBe(1);
  });

  it("does NOT touch the AirPlus status — the two channels pause independently", async () => {
    // The whole point of splitting the menu item in two.
    const { raw, env, token } = await seed("super_admin", 1);
    await post(env, "unlist", token);
    expect(
      (raw.prepare(`SELECT status FROM products WHERE id='p1'`).get() as { status: string }).status,
    ).toBe("active");
  });

  for (const role of ["admin", "mechanic"]) {
    it(`given a ${role} > 403; taking a product off a sales channel is the owner's call`, async () => {
      const { raw, env, token } = await seed(role, 1);
      expect((await post(env, "unlist", token)).status).toBe(403);
      expect(listed(raw)).toBe(1);
    });
  }

  it("given no session > 401", async () => {
    const { env } = await seed();
    expect((await post(env, "unlist")).status).toBe(401);
  });
});

// ── Price is the owner's; profit is not a mechanic's (owner, 2026-08-24) ─────────────────────────
describe("product money: who may change a price, and who may see margin", () => {
  const NOW = 1_800_000_000_000;

  async function seed(role: string) {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at)
         VALUES ('u1','S','s@shop.test',?,'active',?)`,
      )
      .run(role, NOW);
    raw
      .prepare(
        `INSERT INTO products (id,name,status,created_at,shopee_listed,weight_grams)
         VALUES ('p1','Compressor','active',?,0,0)`,
      )
      .run(NOW);
    raw
      .prepare(`INSERT INTO product_variants (id,product_id,created_at) VALUES ('v1','p1',?)`)
      .run(NOW);
    raw
      .prepare(
        `INSERT INTO pricing_profiles
           (id, product_variant_id, item_cost_satang, target_price_satang, online_price_satang,
            b2b_price_satang, online_commission_bp, tax_on_cost, active_from)
         VALUES ('pp1','v1',40000,90000,95000,80000,0,0,?)`,
      )
      .run(NOW);
    const { token } = await createStaffSession(db, "u1", NOW);
    return { raw, env: { DB: db } as unknown as Env, token };
  }

  const putPricing = (env: Env, token: string) =>
    worker.fetch!(
      new Request("https://x/products/p1/pricing", {
        method: "PUT",
        headers: { "content-type": "application/json", "X-Staff-Session": token },
        body: JSON.stringify({ itemCostSatang: 10, onlinePriceSatang: 999999 }),
      }),
      env,
      ctx,
    );

  const cost = (raw: DatabaseSync) =>
    (
      raw.prepare(`SELECT item_cost_satang AS c FROM pricing_profiles WHERE id='pp1'`).get() as {
        c: number;
      }
    ).c;

  it("given the super admin > the price change lands", async () => {
    const { env, token } = await seed("super_admin");
    expect((await putPricing(env, token)).status).toBe(200);
  });

  it("given an admin moving a SELLING price > 403, and nothing is written", async () => {
    // This body changes onlinePriceSatang as well as the cost, so it is refused as a whole — an
    // admin may set the cost, but not in the same save that moves what the shop charges.
    //
    // The rule was a flat "an admin cannot touch pricing" for part of 2026-08-24, before the owner
    // split it: cost is the admin's, selling price is the owner's. Hence the reason changed from
    // super_admin_only to price_is_owners.
    const { raw, env, token } = await seed("admin");
    const res = await putPricing(env, token);
    expect(res.status).toBe(403);
    expect((await res.json()) as { reason: string }).toMatchObject({ reason: "price_is_owners" });
    expect(cost(raw)).toBe(40000);
  });

  it("given a mechanic > 403 as well; they may not write products at all", async () => {
    const { raw, env, token } = await seed("mechanic");
    expect((await putPricing(env, token)).status).toBe(403);
    expect(cost(raw)).toBe(40000);
  });

  describe("cost is withheld from a mechanic, so margin cannot be worked out", () => {
    const listCost = async (env: Env, token: string) => {
      const res = await worker.fetch!(
        new Request("https://x/products", { headers: { "X-Staff-Session": token } }),
        env,
        ctx,
      );
      const body = (await res.json()) as { products: { itemCostSatang: number }[] };
      return body.products[0]!.itemCostSatang;
    };

    it("given the super admin > the real cost comes through", async () => {
      const { env, token } = await seed("super_admin");
      expect(await listCost(env, token)).toBe(40000);
    });

    it("given an admin > the real cost comes through; margin is their working information", async () => {
      const { env, token } = await seed("admin");
      expect(await listCost(env, token)).toBe(40000);
    });

    it("given a mechanic > cost is ZERO in the payload, not merely hidden in the page", async () => {
      // The page computes profit as price minus cost. Shipping the cost and hiding the answer
      // would be decoration — anyone reading the response could do the subtraction.
      const { env, token } = await seed("mechanic");
      expect(await listCost(env, token)).toBe(0);
    });

    it("given a mechanic > the SELLING prices still come through; they are not secret", async () => {
      const { env, token } = await seed("mechanic");
      const res = await worker.fetch!(
        new Request("https://x/products", { headers: { "X-Staff-Session": token } }),
        env,
        ctx,
      );
      const body = (await res.json()) as { products: { onlinePriceSatang: number }[] };
      expect(body.products[0]!.onlinePriceSatang).toBe(95000);
    });
  });
});

// ── An admin sets the COST; the owner sets what the shop CHARGES (owner, 2026-08-24) ─────────────
// Refines the earlier flat "an admin cannot change price". An admin buys the stock, so item cost
// and the VAT-on-cost switch are theirs; the selling tiers and the commission are not.
//
// Both save paths are covered on purpose. The edit page saves through POST /products/full, NOT
// PUT /products/:id/pricing — guarding only the latter left the actual door open.
describe("pricing: cost is the admin's, selling price is the owner's", () => {
  const NOW = 1_800_000_000_000;
  const STORED = {
    itemCostSatang: 40000,
    targetPriceSatang: 90000,
    onlinePriceSatang: 95000,
    b2bPriceSatang: 80000,
    onlineCommissionBp: 0,
    taxOnCost: false,
  };

  async function seed(role: string) {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at)
         VALUES ('u1','S','s@shop.test',?,'active',?)`,
      )
      .run(role, NOW);
    raw
      .prepare(
        `INSERT INTO products (id,name,product_ref,status,created_at,shopee_listed,weight_grams)
         VALUES ('p1','Compressor','REF-1','active',?,0,0)`,
      )
      .run(NOW);
    raw
      .prepare(`INSERT INTO product_variants (id,product_id,created_at) VALUES ('v1','p1',?)`)
      .run(NOW);
    raw
      .prepare(
        `INSERT INTO pricing_profiles
           (id, product_variant_id, item_cost_satang, target_price_satang, online_price_satang,
            b2b_price_satang, online_commission_bp, tax_on_cost, active_from)
         VALUES ('pp1','v1',40000,90000,95000,80000,0,0,?)`,
      )
      .run(NOW);
    const { token } = await createStaffSession(db, "u1", NOW);
    return { raw, env: { DB: db } as unknown as Env, token };
  }

  const putPricing = (env: Env, token: string, pricing: Record<string, unknown>) =>
    worker.fetch!(
      new Request("https://x/products/p1/pricing", {
        method: "PUT",
        headers: { "content-type": "application/json", "X-Staff-Session": token },
        body: JSON.stringify(pricing),
      }),
      env,
      ctx,
    );

  const saveFull = (env: Env, token: string, pricing: Record<string, unknown>) =>
    worker.fetch!(
      new Request("https://x/products/full", {
        method: "POST",
        headers: { "content-type": "application/json", "X-Staff-Session": token },
        body: JSON.stringify({
          id: "p1",
          productRef: "REF-1",
          name: "Compressor",
          status: "active",
          pricing,
        }),
      }),
      env,
      ctx,
    );

  const cost = (raw: DatabaseSync) =>
    (raw.prepare(`SELECT item_cost_satang AS c FROM pricing_profiles`).get() as { c: number }).c;
  const online = (raw: DatabaseSync) =>
    (raw.prepare(`SELECT online_price_satang AS p FROM pricing_profiles`).get() as { p: number }).p;

  describe("PUT /products/:id/pricing", () => {
    it("given an admin changing only the COST > allowed, and it lands", async () => {
      const { raw, env, token } = await seed("admin");
      const res = await putPricing(env, token, { ...STORED, itemCostSatang: 44000 });
      expect(res.status).toBe(200);
      expect(cost(raw)).toBe(44000);
    });

    it("given an admin changing a SELLING price > 403, and nothing moves", async () => {
      const { raw, env, token } = await seed("admin");
      const res = await putPricing(env, token, { ...STORED, onlinePriceSatang: 999999 });
      expect(res.status).toBe(403);
      expect((await res.json()) as { reason: string }).toMatchObject({ reason: "price_is_owners" });
      expect(online(raw)).toBe(95000);
    });

    it("given the owner changing a selling price > allowed", async () => {
      const { raw, env, token } = await seed("super_admin");
      expect((await putPricing(env, token, { ...STORED, onlinePriceSatang: 111111 })).status).toBe(
        200,
      );
      expect(online(raw)).toBe(111111);
    });

    it("given a mechanic > 403; they write no products at all", async () => {
      const { env, token } = await seed("mechanic");
      expect((await putPricing(env, token, { ...STORED, itemCostSatang: 1 })).status).toBe(403);
    });
  });

  describe("POST /products/full — the path the edit page actually uses", () => {
    it("given an admin changing only the COST > allowed", async () => {
      const { raw, env, token } = await seed("admin");
      const res = await saveFull(env, token, { ...STORED, itemCostSatang: 47000 });
      expect(res.status).toBe(200);
      expect(cost(raw)).toBe(47000);
    });

    it("given an admin changing a SELLING price here > 403, not a way around the rule", async () => {
      const { raw, env, token } = await seed("admin");
      expect((await saveFull(env, token, { ...STORED, b2bPriceSatang: 1 })).status).toBe(403);
      expect(online(raw)).toBe(95000);
    });

    it("given the owner > allowed", async () => {
      const { env, token } = await seed("super_admin");
      expect((await saveFull(env, token, { ...STORED, b2bPriceSatang: 1 })).status).toBe(200);
    });
  });
});

// ── /products/full is not a way around the channel gate either ───────────────────────────────────
// Pausing and Shopee-listing are super-admin only (canDeleteProduct), enforced on their own routes.
// The edit form saves through POST /products/full, so without a guard there an admin could take a
// live product off the storefront from the one screen built for it — exactly the shape already
// fixed for selling prices, which this repo learned the hard way an hour earlier.
describe("POST /products/full — channel changes are super-admin only", () => {
  const NOW = 1_800_000_000_000;

  async function seed(role: string, status = "active", shopeeListed = 0) {
    const raw = migratedDb();
    const db = asD1(raw);
    raw
      .prepare(
        `INSERT INTO users (id,name,email,role,status,created_at)
         VALUES ('u1','S','s@shop.test',?,'active',?)`,
      )
      .run(role, NOW);
    raw
      .prepare(
        `INSERT INTO products (id,name,product_ref,status,created_at,shopee_listed,weight_grams)
         VALUES ('p1','Compressor','REF-1',?,?,?,0)`,
      )
      .run(status, NOW, shopeeListed);
    const { token } = await createStaffSession(db, "u1", NOW);
    return { raw, env: { DB: db } as unknown as Env, token };
  }

  const save = (env: Env, token: string, body: Record<string, unknown>) =>
    worker.fetch!(
      new Request("https://x/products/full", {
        method: "POST",
        headers: { "content-type": "application/json", "X-Staff-Session": token },
        body: JSON.stringify({ id: "p1", productRef: "REF-1", name: "Compressor", ...body }),
      }),
      env,
      ctx,
    );

  const row = (raw: DatabaseSync) =>
    raw.prepare(`SELECT status, shopee_listed AS listed FROM products WHERE id='p1'`).get() as {
      status: string;
      listed: number;
    };

  it("given an admin taking a LIVE product off the storefront > 403, and it stays live", async () => {
    const { raw, env, token } = await seed("admin", "active");
    const res = await save(env, token, { status: "paused" });
    expect(res.status).toBe(403);
    expect((await res.json()) as { reason: string }).toMatchObject({ reason: "channel_is_owners" });
    expect(row(raw).status).toBe("active");
  });

  it("given an admin publishing a draft > 403 too; publishing is the same authority", async () => {
    const { raw, env, token } = await seed("admin", "draft");
    expect((await save(env, token, { status: "active" })).status).toBe(403);
    expect(row(raw).status).toBe("draft");
  });

  it("given an admin changing the Shopee listing > 403", async () => {
    const { raw, env, token } = await seed("admin", "active", 0);
    expect((await save(env, token, { status: "active", shopeeListed: true })).status).toBe(403);
    expect(row(raw).listed).toBe(0);
  });

  it("given an admin saving with the channels UNCHANGED > allowed; they still run the catalog", async () => {
    // The whole reason this compares rather than refuses outright: the edit form posts the entire
    // product every save, so an admin fixing a name must not be blocked for fields they never touched.
    const { raw, env, token } = await seed("admin", "active", 1);
    const res = await save(env, token, {
      status: "active",
      shopeeListed: true,
      name: "Renamed by an admin",
    });
    expect(res.status).toBe(200);
    expect(raw.prepare(`SELECT name FROM products WHERE id='p1'`).get()).toMatchObject({
      name: "Renamed by an admin",
    });
  });

  it("given the super admin > both channels move freely", async () => {
    const { raw, env, token } = await seed("super_admin", "active", 0);
    expect((await save(env, token, { status: "paused", shopeeListed: true })).status).toBe(200);
    expect(row(raw)).toMatchObject({ status: "paused", listed: 1 });
  });

  it("given a NEW product (no id) > an admin may set its channels; that is not a change", async () => {
    const { env, token } = await seed("admin");
    const res = await worker.fetch!(
      new Request("https://x/products/full", {
        method: "POST",
        headers: { "content-type": "application/json", "X-Staff-Session": token },
        body: JSON.stringify({ productRef: "REF-NEW", name: "Fresh", status: "active" }),
      }),
      env,
      ctx,
    );
    // 201 Created — a create, not a change. The point is that it is not refused.
    expect(res.status).toBe(201);
  });
});

/**
 * The practice copy's one-click sign-in.
 *
 * WHY IT EXISTS: the owner was locked out of their OWN practice copy twice on 2026-08-24 — the
 * local database carries its own staff rows and its own password for the same email address, so a
 * perfectly correct production password is rejected by an identical-looking screen. A password on a
 * throwaway database that only this machine can reach protects nothing and costs whole sessions.
 *
 * WHAT IT MUST NEVER DO is exist in production, where it would hand out a super-admin session for
 * free. `isPracticeCopy` is the gate (three conditions, all required); these tests cover the route
 * honouring it. A refusal is 404, not 403: outside a practice copy the route does not exist at all,
 * so nothing advertises that there is a door here to rattle.
 */
describe("POST /staff/login-practice", () => {
  const PRACTICE = { PRACTICE_COPY: "1" };
  const call = (env: Record<string, unknown>, origin = "http://localhost:8788") =>
    worker.fetch!(
      new Request(`${origin}/staff/login-practice`, { method: "POST" }),
      env as unknown as Env,
      ctx,
    );

  it("given a practice copy with an existing super admin > signs in as them", async () => {
    const db = migratedDb();
    db.exec(
      `INSERT INTO users (id, name, email, role, status, created_at, failed_attempts)
       VALUES ('u-owner', 'Lady Kirsah', 'lady@practice.local', 'super_admin', 'active', 1000, 0)`,
    );
    const res = await call({ ...PRACTICE, DB: asD1(db) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; staff: { role: string; email: string } };
    expect(body.staff.role).toBe("super_admin");
    expect(body.staff.email).toBe("lady@practice.local");
    expect(body.token).toMatch(/^[0-9a-f]{64}$/);
    // A real, usable session — not a token that looks right and resolves to nobody.
    const rows = db.prepare(`SELECT COUNT(*) AS n FROM staff_sessions`).get() as { n: number };
    expect(rows.n).toBe(1);
  });

  it("given a practice copy with an EMPTY database > creates the owner and signs in", async () => {
    // The documented state of a fresh practice copy: migrations applied, no seed script, no users.
    // Refusing here would leave the owner with no way in at all, which is the bug being fixed.
    const db = migratedDb();
    const res = await call({ ...PRACTICE, DB: asD1(db) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { staff: { role: string } };
    expect(body.staff.role).toBe("super_admin");
    const n = db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role='super_admin'`).get() as {
      n: number;
    };
    expect(n.n).toBe(1);
  });

  it("given two super admins > signs in as the earliest, deterministically", async () => {
    const db = migratedDb();
    db.exec(
      `INSERT INTO users (id, name, email, role, status, created_at, failed_attempts) VALUES
         ('u-second', 'Second', 'b@practice.local', 'super_admin', 'active', 2000, 0),
         ('u-first',  'First',  'a@practice.local', 'super_admin', 'active', 1000, 0)`,
    );
    const res = await call({ ...PRACTICE, DB: asD1(db) });
    expect(((await res.json()) as { staff: { email: string } }).staff.email).toBe(
      "a@practice.local",
    );
  });

  it("given a deactivated super admin > does not sign in as them", async () => {
    const db = migratedDb();
    db.exec(
      `INSERT INTO users (id, name, email, role, status, created_at, failed_attempts) VALUES
         ('u-off', 'Switched off', 'off@practice.local', 'super_admin', 'inactive', 1000, 0)`,
    );
    const res = await call({ ...PRACTICE, DB: asD1(db) });
    expect(res.status).toBe(200);
    // Falls through to creating a usable owner rather than handing back a dead account.
    expect(((await res.json()) as { staff: { email: string } }).staff.email).not.toBe(
      "off@practice.local",
    );
  });

  it("given NO opt-in > 404, the route does not exist", async () => {
    const db = migratedDb();
    const res = await call({ DB: asD1(db) });
    expect(res.status).toBe(404);
  });

  it("given production's explicit refusal > 404", async () => {
    // Production ships PRACTICE_COPY="0" in wrangler.jsonc's deployed vars, asserted by a test over
    // that file. There is no hostname condition — wrangler dev rewrites the Host header, so no such
    // check can be made correct. See isPracticeCopy.
    const db = migratedDb();
    const res = await call({ PRACTICE_COPY: "0", DB: asD1(db) });
    expect(res.status).toBe(404);
  });

  it("given Cloudflare Access configured > 404 even with the opt-in", async () => {
    const db = migratedDb();
    const res = await call(
      {
        ...PRACTICE,
        ACCESS_AUD: "aud",
        ACCESS_TEAM_DOMAIN: "x.cloudflareaccess.com",
        DB: asD1(db),
      },
      "http://localhost:8788",
    );
    expect(res.status).toBe(404);
  });

  it("given a refused request > writes no session and creates no user", async () => {
    const db = migratedDb();
    await call({ DB: asD1(db) });
    const s = db.prepare(`SELECT COUNT(*) AS n FROM staff_sessions`).get() as { n: number };
    const u = db.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number };
    expect(s.n).toBe(0);
    expect(u.n).toBe(0);
  });
});
