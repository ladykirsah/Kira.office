/**
 * L Shopee Back Office — Drizzle schema for Cloudflare D1 (SQLite). DRAFT.
 *
 * Conventions (see docs/DATA_MODEL.md):
 *  - Money is INTEGER minor units (satang). Never floats.
 *  - Rates are INTEGER basis points (7% -> 700).
 *  - Enums are TEXT with a fixed value set.
 *  - Timestamps are INTEGER epoch ms (UTC).
 *  - IDs are app-generated TEXT (UUID/ULID).
 *
 * This is a representative subset covering money, stock-ledger, and the offline-sync invariant.
 * The complete entity set is documented in docs/DATA_MODEL.md and is added in Phase 1.
 * Not yet compiled (drizzle-orm is installed in Phase 1); migrations are generated with
 * `drizzle-kit generate` and applied with `wrangler d1 migrations apply`.
 */
import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

const id = () => text("id").primaryKey();
const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull();

export const shopSettings = sqliteTable("shop_settings", {
  id: id(),
  baseCurrency: text("base_currency").notNull().default("THB"),
  timezone: text("timezone").notNull().default("Asia/Bangkok"),
  costMethod: text("cost_method", {
    enum: ["moving_average", "latest", "manual", "fifo"],
  })
    .notNull()
    .default("moving_average"),
  defaultVatRateBp: integer("default_vat_rate_bp").notNull().default(700), // 7.00%
  vatRegistered: integer("vat_registered", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", {
    enum: ["owner", "manager", "stock_operator", "finance_viewer"],
  }).notNull(),
  status: text("status").notNull().default("active"),
  createdAt: createdAt(),
});

export const taxProfiles = sqliteTable("tax_profiles", {
  id: id(),
  name: text("name").notNull(),
  vatRateBp: integer("vat_rate_bp").notNull().default(700),
  priceIncludesVat: integer("price_includes_vat", { mode: "boolean" }).notNull().default(true),
  isTaxable: integer("is_taxable", { mode: "boolean" }).notNull().default(true),
});

export const products = sqliteTable("products", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  typeId: text("type_id"),
  brandId: text("brand_id"),
  usageId: text("usage_id"),
  taxProfileId: text("tax_profile_id").references(() => taxProfiles.id),
  status: text("status").notNull().default("draft"),
  imageKey: text("image_key"),
  shopeeListed: integer("shopee_listed", { mode: "boolean" }).notNull().default(false),
  // Shopee item id for linking this product to its Shopee listing (own category is separate).
  shopeeItemId: text("shopee_item_id"),
  defaultTermsPatternId: text("default_terms_pattern_id"),
  // The Product ID: the manufacturer/catalog part no. (e.g. "DI446610-1710"). The SOLE product
  // identifier (the old internal product_code was removed in migration 0018) and the barcode source.
  // App-enforced required; unique via products_product_ref_unique.
  productRef: text("product_ref").notNull().unique(),
  category: text("category"),
  weightGrams: integer("weight_grams").notNull().default(0),
  createdAt: createdAt(),
  // Bumped whenever the product is saved; backfilled from created_at (migration 0012).
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
});

// Managed attribute lists behind the product dropdowns (creatable). products reference these by id
// via brand_id (part brand) / type_id (part name) / usage_id (car system).
const attributeTable = (name: string) =>
  sqliteTable(name, {
    id: id(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  });

export const brands = attributeTable("brands");
export const productTypes = attributeTable("product_types");
export const usageCategories = attributeTable("usage_categories");
export const carBrands = attributeTable("car_brands");

// Repair/labour services for the POS (name + base price; base price prefills, editable per sale).
export const services = sqliteTable(
  "services",
  {
    id: id(),
    name: text("name").notNull(),
    nameEn: text("name_en").notNull().default(""),
    basePriceSatang: integer("base_price_satang").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => ({ nameUq: uniqueIndex("services_name_uq").on(t.name) }),
);
export const carModels = sqliteTable(
  "car_models",
  {
    id: id(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    carBrandId: text("car_brand_id").references(() => carBrands.id),
    // Per-model service notes — a customer-service cheat sheet for this model.
    generationCode: text("generation_code"),
    yearFrom: integer("year_from"),
    yearTo: integer("year_to"),
    refrigerant: text("refrigerant"),
    // `oring_size` (single value) is superseded by `oring_usage` (JSON: amount per size); kept unused.
    oringSize: text("oring_size"),
    oringUsage: text("oring_usage"),
    coolantLiters: text("coolant_liters"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [
    index("car_models_brand_idx").on(t.carBrandId),
    // A model is a generation: unique per (brand, name, era).
    uniqueIndex("car_models_brand_name_era_uq").on(t.carBrandId, t.name, t.yearFrom, t.yearTo),
  ],
);

// Vehicle fitment — one row per car a product fits (one part → many cars).
export const productFitments = sqliteTable(
  "product_fitments",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    carBrand: text("car_brand"),
    carModel: text("car_model"),
    yearFrom: integer("year_from"),
    yearTo: integer("year_to"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("product_fitments_product_idx").on(t.productId)],
);

export const productImages = sqliteTable(
  "product_images",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    imageKey: text("image_key").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isCover: integer("is_cover", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const productVariants = sqliteTable(
  "product_variants",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    sku: text("sku"),
    variantName: text("variant_name"),
    option1Name: text("option_1_name"),
    option1Value: text("option_1_value"),
    option2Name: text("option_2_name"),
    option2Value: text("option_2_value"),
    barcodePrimary: text("barcode_primary"),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [index("variant_product_idx").on(t.productId)],
);

export const shopConnections = sqliteTable("shop_connections", {
  id: id(),
  provider: text("provider").notNull().default("shopee"),
  shopId: text("shop_id"),
  shopName: text("shop_name"),
  region: text("region").notNull().default("TH"),
  partnerIdReference: text("partner_id_reference"),
  accessTokenSecretReference: text("access_token_secret_reference"),
  refreshTokenSecretReference: text("refresh_token_secret_reference"),
  tokenExpiresAt: integer("token_expires_at", { mode: "timestamp_ms" }),
  status: text("status").notNull().default("disconnected"),
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const termsPatterns = sqliteTable("terms_patterns", {
  id: id(),
  name: text("name").notNull(),
  language: text("language").notNull().default("th"),
  bodyTemplate: text("body_template").notNull(),
  requiredFieldsJson: text("required_fields_json"),
  status: text("status").notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const productTerms = sqliteTable(
  "product_terms",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id),
    termsPatternId: text("terms_pattern_id").references(() => termsPatterns.id),
    generatedBody: text("generated_body").notNull(),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("draft"),
    approvedByUserId: text("approved_by_user_id").references(() => users.id),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("product_terms_product_idx").on(t.productId)],
);

export const barcodes = sqliteTable("barcodes", {
  id: id(),
  productVariantId: text("product_variant_id")
    .notNull()
    .references(() => productVariants.id),
  barcodeValue: text("barcode_value").notNull().unique(),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  isInternalGenerated: integer("is_internal_generated", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: createdAt(),
});

export const pricingProfiles = sqliteTable("pricing_profiles", {
  id: id(),
  productVariantId: text("product_variant_id")
    .notNull()
    .references(() => productVariants.id),
  // all *_satang are integer THB minor units
  itemCostSatang: integer("item_cost_satang").notNull().default(0),
  targetPriceSatang: integer("target_price_satang").notNull().default(0), // on-site B2C price
  onlinePriceSatang: integer("online_price_satang").notNull().default(0), // online default price
  b2bPriceSatang: integer("b2b_price_satang").notNull().default(0), // on-site B2B price
  onlineCommissionBp: integer("online_commission_bp").notNull().default(0), // Shopee commission, basis points
  taxOnCost: integer("tax_on_cost", { mode: "boolean" }).notNull().default(false), // +7% VAT on cost base
  activeFrom: integer("active_from", { mode: "timestamp_ms" }).notNull(),
  activeTo: integer("active_to", { mode: "timestamp_ms" }),
});

export const stockLedgerEntries = sqliteTable(
  "stock_ledger_entries",
  {
    id: id(),
    productVariantId: text("product_variant_id")
      .notNull()
      .references(() => productVariants.id),
    // DB-enforced via CHECK (migration 0026). Includes the descriptive manual sub-types the
    // Stock-movements adjust bar writes (receive / write_off / correction) alongside the base enum.
    movementType: text("movement_type", {
      enum: [
        "opening_balance",
        "purchase_receipt",
        "manual_adjustment",
        "receive",
        "write_off",
        "correction",
        "onsite_sale",
        "online_sale",
        "refund_return",
        "damaged_lost",
        "transfer",
        "reconciliation",
      ],
    }).notNull(),
    quantityDelta: integer("quantity_delta").notNull(),
    quantityAfter: integer("quantity_after").notNull(),
    sourceType: text("source_type"),
    sourceId: text("source_id"),
    reason: text("reason"),
    userId: text("user_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("ledger_variant_idx").on(t.productVariantId)],
);

export const onsiteSales = sqliteTable("onsite_sales", {
  id: id(),
  // idempotent offline sync: a replayed offline sale is a no-op
  clientUuid: text("client_uuid").notNull().unique(),
  deviceId: text("device_id"),
  syncStatus: text("sync_status", { enum: ["local", "queued", "synced"] })
    .notNull()
    .default("local"),
  syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
  saleNumber: text("sale_number"),
  cashierUserId: text("cashier_user_id").references(() => users.id),
  paymentMethod: text("payment_method"),
  // parts = walk-in part sale; repair = labour job (carries a car plate + notes + service lines)
  saleType: text("sale_type", { enum: ["parts", "repair"] })
    .notNull()
    .default("parts"),
  licensePlate: text("license_plate"),
  vehicle: text("vehicle"),
  notes: text("notes"),
  subtotalSatang: integer("subtotal_satang").notNull().default(0),
  discountTotalSatang: integer("discount_total_satang").notNull().default(0),
  taxTotalSatang: integer("tax_total_satang").notNull().default(0),
  grandTotalSatang: integer("grand_total_satang").notNull().default(0),
  saleStatus: text("sale_status").notNull().default("completed"),
  // Document lifecycle (see @l-shopee/core onsiteDoc): draft/quotation = WIP (no revenue, no stock);
  // bill = finalized. Revenue/stock/list queries filter stage = 'bill'.
  stage: text("stage", { enum: ["draft", "quotation", "bill"] })
    .notNull()
    .default("bill"),
  createdAt: createdAt(),
});

export const onsiteSaleLines = sqliteTable("onsite_sale_lines", {
  id: id(),
  onsiteSaleId: text("onsite_sale_id")
    .notNull()
    .references(() => onsiteSales.id),
  productVariantId: text("product_variant_id").references(() => productVariants.id),
  // part = stock item; service = labour/service line (no variant, no stock movement)
  lineType: text("line_type", { enum: ["part", "service"] })
    .notNull()
    .default("part"),
  description: text("description"),
  barcodeValue: text("barcode_value"),
  quantity: integer("quantity").notNull(),
  unitPriceSatang: integer("unit_price_satang").notNull(),
  discountSatang: integer("discount_satang").notNull().default(0),
  taxSatang: integer("tax_satang").notNull().default(0),
  unitCostSatang: integer("unit_cost_satang").notNull().default(0),
  costMethodUsed: text("cost_method_used"),
  grossProfitSatang: integer("gross_profit_satang").notNull().default(0),
});

export const salesOrders = sqliteTable(
  "sales_orders",
  {
    id: id(),
    // Marketplace orders only (ORDER_CHANNELS in @l-shopee/core). onsite uses onsite_sales;
    // affiliate is money-only (no order).
    channel: text("channel", { enum: ["shopee", "airplus"] }).notNull(),
    externalOrderId: text("external_order_id").notNull(),
    orderStatus: text("order_status"),
    paymentStatus: text("payment_status"),
    subtotalSatang: integer("subtotal_satang").notNull().default(0),
    discountTotalSatang: integer("discount_total_satang").notNull().default(0),
    taxTotalSatang: integer("tax_total_satang").notNull().default(0),
    feeTotalSatang: integer("fee_total_satang").notNull().default(0),
    grandTotalSatang: integer("grand_total_satang").notNull().default(0),
    orderCreatedAt: integer("order_created_at", { mode: "timestamp_ms" }),
    importedAt: integer("imported_at", { mode: "timestamp_ms" }).notNull(),
    importSource: text("import_source", { enum: ["csv", "api"] })
      .notNull()
      .default("csv"),
    // Shopee order-export enrichment (migration 0029). grand_total = NET payout = sales − fees.
    buyerUsername: text("buyer_username"),
    salesSatang: integer("sales_satang").notNull().default(0), // NOT NULL: importers must bind 0, never null
    feeBp: integer("fee_bp").notNull().default(0), // fee % as basis points (3.21% = 321)
    shipTimeMs: integer("ship_time_ms", { mode: "timestamp_ms" }),
    // Fulfillment + profit (migration 0030) — populated for AirPlus; Shopee profit awaits SKU links.
    carrier: text("carrier"),
    trackingNo: text("tracking_no"),
    profitSatang: integer("profit_satang"),
    // AirPlus storefront checkout (migration 0039) — null for CSV-imported Shopee orders.
    storefrontCustomerId: text("storefront_customer_id").references(() => storefrontCustomers.id),
    shippingAddressId: text("shipping_address_id").references(() => addresses.id),
    /** When the order reached 'สำเร็จ' (migration 0049) — the anchor for the 7-day return window.
     *  Distinct from shipTimeMs, which is when the parcel LEFT the shop. Null on pre-0049 rows. */
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("order_channel_external_uq").on(t.channel, t.externalOrderId)],
);

/**
 * คืนสินค้า / เคลม requests (migration 0049). One row per customer request; the shop's mechanic
 * approves or rejects. Deliberately holds NO money column — a request never moves stock or funds by
 * itself, so refunds stay in sales_orders/payments where they can be audited.
 */
export const orderReturns = sqliteTable(
  "order_returns",
  {
    id: id(),
    salesOrderId: text("sales_order_id")
      .notNull()
      .references(() => salesOrders.id),
    kind: text("kind", { enum: ["return", "claim"] }).notNull(),
    reason: text("reason").notNull(),
    note: text("note"),
    status: text("status", { enum: ["รอตรวจสอบ", "อนุมัติ", "ปฏิเสธ", "เสร็จสิ้น"] })
      .notNull()
      .default("รอตรวจสอบ"),
    /** The shop's answer, shown to the customer verbatim so a rejection is never silent. */
    decisionNote: text("decision_note"),
    decidedAt: integer("decided_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("idx_order_returns_order").on(t.salesOrderId, t.status)],
);

export const salesOrderLines = sqliteTable(
  "sales_order_lines",
  {
    id: id(),
    salesOrderId: text("sales_order_id")
      .notNull()
      .references(() => salesOrders.id),
    productVariantId: text("product_variant_id")
      .notNull()
      .references(() => productVariants.id),
    quantity: integer("quantity").notNull(),
    unitPriceSatang: integer("unit_price_satang").notNull(),
    unitCostSatang: integer("unit_cost_satang").notNull().default(0), // cost snapshot at sale time
    lineTotalSatang: integer("line_total_satang").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sales_order_lines_order_idx").on(t.salesOrderId)],
);

export const financialRecords = sqliteTable(
  "financial_records",
  {
    id: id(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    recordType: text("record_type").notNull(),
    // All money sources (CHANNELS in @l-shopee/core) — including affiliate commission.
    channel: text("channel", { enum: ["onsite", "shopee", "airplus", "affiliate"] }).notNull(),
    amountSatang: integer("amount_satang").notNull(),
    taxSatang: integer("tax_satang").notNull().default(0),
    feeSatang: integer("fee_satang").notNull().default(0),
    costSatang: integer("cost_satang").notNull().default(0),
    profitSatang: integer("profit_satang").notNull().default(0),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
    notes: text("notes"),
  },
  (t) => [index("finance_channel_time_idx").on(t.channel, t.occurredAt)],
);

/** Append-only mutation audit (actor email from Access JWT; user_id wired when RBAC lands). */
export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: id(),
    actorEmail: text("actor_email"),
    userId: text("user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("audit_logs_created_at_idx").on(t.createdAt),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
  ],
);

/**
 * Customer directory keyed by car plate — ONE record per car. Auto-created from plated on-site
 * sales; the owner fills/edits name + phone. Phone is the grouping key (a family shares a phone
 * across plates → search-by-phone finds all their cars). Sales link by the plate string (no FK).
 */
export const customers = sqliteTable(
  "customers",
  {
    id: id(),
    licensePlate: text("license_plate").notNull().unique(),
    plateProvince: text("plate_province"),
    customerName: text("customer_name"),
    phone: text("phone"),
    carModel: text("car_model"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("customers_phone_idx").on(t.phone)],
);

/**
 * AirPlus storefront customer ACCOUNTS, keyed by phone (migrations 0037 + 0041). Deliberately a
 * NEW table, not a change to the plate-keyed `customers` table above (that one is NOT NULL UNIQUE
 * on license_plate, built for on-site walk-ins). A future pass can link the two by phone.
 * name '' = "not captured yet" sentinel (accounts are created at OTP-verify, before checkout).
 * PDPA: a row must never be created without pdpa_consent_at set on the same statement.
 */
export const storefrontCustomers = sqliteTable(
  "storefront_customers",
  {
    id: id(),
    phone: text("phone").notNull().unique(),
    name: text("name").notNull(),
    email: text("email"),
    // ISO "YYYY-MM-DD"; collected at registration for the 20+ age gate (migration 0050).
    dateOfBirth: text("date_of_birth"),
    phoneVerifiedAt: integer("phone_verified_at", { mode: "timestamp_ms" }),
    pdpaConsentAt: integer("pdpa_consent_at", { mode: "timestamp_ms" }),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
    lineUserId: text("line_user_id"),
    facebookId: text("facebook_id"),
    passwordHash: text("password_hash"),
    status: text("status", { enum: ["active", "disabled"] })
      .notNull()
      .default("active"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    // Partial UNIQUE in the real DDL (WHERE ... IS NOT NULL) — SQLite treats NULLs as distinct.
    uniqueIndex("storefront_customers_line_uq").on(t.lineUserId),
    uniqueIndex("storefront_customers_fb_uq").on(t.facebookId),
  ],
);

/** DB-backed storefront sessions (migration 0042): cookie holds the raw token, D1 the SHA-256. */
export const storefrontSessions = sqliteTable(
  "storefront_sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(),
    customerId: text("customer_id")
      .notNull()
      .references(() => storefrontCustomers.id),
    createdAt: createdAt(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("storefront_sessions_customer_idx").on(t.customerId),
    index("storefront_sessions_expires_idx").on(t.expiresAt),
  ],
);

/** Phone-OTP login codes (migration 0043): salted SHA-256, 5-min TTL, 5 attempts, single-use. */
export const authOtpCodes = sqliteTable(
  "auth_otp_codes",
  {
    id: id(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    salt: text("salt").notNull(),
    purpose: text("purpose").notNull().default("login"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("auth_otp_phone_idx").on(t.phone)],
);

/** Fixed-window rate-limit counters (migration 0043), incremented via single-statement upsert. */
export const authThrottle = sqliteTable("auth_throttle", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStartedAt: integer("window_started_at", { mode: "timestamp_ms" }).notNull(),
});

/** Member-only coupon codes (migration 0044). fixed → satang off; percent → basis points. */
export const coupons = sqliteTable("coupons", {
  id: id(),
  code: text("code").notNull().unique(),
  type: text("type", { enum: ["fixed", "percent"] }).notNull(),
  value: integer("value").notNull(),
  minSubtotalSatang: integer("min_subtotal_satang").notNull().default(0),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }),
  maxUses: integer("max_uses"),
  maxUsesPerCustomer: integer("max_uses_per_customer").notNull().default(1),
  status: text("status", { enum: ["active", "disabled"] })
    .notNull()
    .default("active"),
  createdAt: createdAt(),
});

export const couponRedemptions = sqliteTable(
  "coupon_redemptions",
  {
    id: id(),
    couponId: text("coupon_id")
      .notNull()
      .references(() => coupons.id),
    customerId: text("customer_id")
      .notNull()
      .references(() => storefrontCustomers.id),
    salesOrderId: text("sales_order_id")
      .notNull()
      .references(() => salesOrders.id),
    amountDiscountedSatang: integer("amount_discounted_satang").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("coupon_redemptions_order_uq").on(t.couponId, t.salesOrderId),
    index("coupon_redemptions_customer_idx").on(t.customerId, t.couponId),
  ],
);

/** Discount campaigns (migration 0045): timed price windows, resolved in code (no cron). */
export const campaigns = sqliteTable("campaigns", {
  id: id(),
  name: text("name").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  status: text("status", { enum: ["active", "disabled"] })
    .notNull()
    .default("active"),
  /** which storefront surface shows it (migration 0048) — display grouping only, never the price:
   *  flash = the home countdown rail, promo = the "สินค้าลดราคา" collection. */
  kind: text("kind", { enum: ["flash", "promo"] })
    .notNull()
    .default("flash"),
  createdAt: createdAt(),
});

export const campaignPrices = sqliteTable(
  "campaign_prices",
  {
    id: id(),
    campaignId: text("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    productVariantId: text("product_variant_id")
      .notNull()
      .references(() => productVariants.id),
    campaignPriceSatang: integer("campaign_price_satang").notNull(),
    stockCap: integer("stock_cap"),
    soldCount: integer("sold_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("campaign_prices_variant_uq").on(t.campaignId, t.productVariantId),
    index("campaign_prices_variant_idx").on(t.productVariantId),
  ],
);

/** Home-page banners (migration 0046): hero carousel + promo strip, admin-managed. */
export const banners = sqliteTable("banners", {
  id: id(),
  slot: text("slot", { enum: ["hero", "promo"] }).notNull(),
  imageKey: text("image_key"),
  linkUrl: text("link_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }),
  status: text("status", { enum: ["active", "disabled"] })
    .notNull()
    .default("active"),
  createdAt: createdAt(),
});

/** Mechanic-tools affiliate cards (migration 0047). price_text is display-only, never math. */
export const affiliateItems = sqliteTable("affiliate_items", {
  id: id(),
  title: text("title").notNull(),
  imageKey: text("image_key"),
  priceText: text("price_text"),
  source: text("source", { enum: ["shopee", "lazada", "other"] })
    .notNull()
    .default("other"),
  targetUrl: text("target_url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status", { enum: ["active", "disabled"] })
    .notNull()
    .default("active"),
  createdAt: createdAt(),
});

export const affiliateClicks = sqliteTable(
  "affiliate_clicks",
  {
    id: id(),
    itemId: text("item_id")
      .notNull()
      .references(() => affiliateItems.id),
    createdAt: createdAt(),
  },
  (t) => [index("affiliate_clicks_item_idx").on(t.itemId)],
);

/** Shipping addresses for storefront customers (migration 0038). */
export const addresses = sqliteTable(
  "addresses",
  {
    id: id(),
    storefrontCustomerId: text("storefront_customer_id")
      .notNull()
      .references(() => storefrontCustomers.id),
    recipientName: text("recipient_name").notNull(),
    phone: text("phone").notNull(),
    addressLine1: text("address_line1").notNull(),
    subdistrict: text("subdistrict").notNull(),
    district: text("district").notNull(),
    province: text("province").notNull(),
    postalCode: text("postal_code").notNull(),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("addresses_customer_idx").on(t.storefrontCustomerId)],
);

/**
 * Payment approvals — the anti-cheat trail (migration 0031). Staff take payment on the Payment
 * page: pick a PromptPay method, enter the amount, show the QR, then approve once the customer's
 * banking app confirms. status is future-proofed for auto-confirmation via SlipOK
 * (@l-shopee/core payments.ts): pending -> approved -> confirmed. sales_order_id (migration 0040)
 * links a storefront-checkout payment to its order; null for POS-recorded on-site payments.
 */
export const payments = sqliteTable(
  "payments",
  {
    id: id(),
    methodLabel: text("method_label").notNull(),
    promptpayId: text("promptpay_id").notNull(),
    amountSatang: integer("amount_satang").notNull(),
    status: text("status", { enum: ["pending", "approved", "confirmed", "void"] })
      .notNull()
      .default("approved"),
    note: text("note"),
    createdAt: createdAt(),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    clearedAt: integer("cleared_at", { mode: "timestamp_ms" }),
    slipRef: text("slip_ref"),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    verifyNote: text("verify_note"),
    salesOrderId: text("sales_order_id").references(() => salesOrders.id),
  },
  (t) => [
    index("payments_created_idx").on(t.createdAt),
    // SQLite treats NULLs as distinct in a UNIQUE index, so this is equivalent to the migration's
    // explicit `WHERE slip_ref IS NOT NULL` partial index — multiple NULL slip_ref rows are fine.
    uniqueIndex("payments_slip_ref_unique").on(t.slipRef),
  ],
);
