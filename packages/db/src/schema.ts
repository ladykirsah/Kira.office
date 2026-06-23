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
  productCode: text("product_code").notNull().unique(),
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
  // Manufacturer/catalog product id that ships with some parts (e.g. "DI446610-1710").
  productRef: text("product_ref"),
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
    barcodePrimary: text("barcode_primary"),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [index("variant_product_idx").on(t.productId)],
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
  inboundShippingSatang: integer("inbound_shipping_satang").notNull().default(0),
  packagingSatang: integer("packaging_satang").notNull().default(0),
  otherAllocatedSatang: integer("other_allocated_satang").notNull().default(0),
  targetPriceSatang: integer("target_price_satang").notNull().default(0), // on-site B2C price
  onlinePriceSatang: integer("online_price_satang").notNull().default(0), // online default price
  b2bPriceSatang: integer("b2b_price_satang").notNull().default(0), // on-site B2B price
  onlineCommissionBp: integer("online_commission_bp").notNull().default(0), // Shopee commission, basis points
  taxOnCost: integer("tax_on_cost", { mode: "boolean" }).notNull().default(false), // +7% VAT on cost base
  activeFrom: integer("active_from", { mode: "timestamp_ms" }).notNull(),
  activeTo: integer("active_to", { mode: "timestamp_ms" }),
});

export const commissionProfiles = sqliteTable("commission_profiles", {
  id: id(),
  name: text("name").notNull(),
  channel: text("channel", { enum: ["shopee"] })
    .notNull()
    .default("shopee"),
  commissionRateBp: integer("commission_rate_bp").notNull().default(0),
  transactionFeeRateBp: integer("transaction_fee_rate_bp").notNull().default(0),
  serviceFeeRateBp: integer("service_fee_rate_bp").notNull().default(0),
  fixedFeeSatang: integer("fixed_fee_satang").notNull().default(0),
  feeBase: text("fee_base", { enum: ["buyer_price", "ex_tax"] })
    .notNull()
    .default("buyer_price"),
});

export const costLayers = sqliteTable(
  "cost_layers",
  {
    id: id(),
    productVariantId: text("product_variant_id")
      .notNull()
      .references(() => productVariants.id),
    locationId: text("location_id"),
    receivedQty: integer("received_qty").notNull(),
    remainingQty: integer("remaining_qty").notNull(),
    unitCostSatang: integer("unit_cost_satang").notNull(),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("cost_layer_variant_idx").on(t.productVariantId)],
);

export const stockLedgerEntries = sqliteTable(
  "stock_ledger_entries",
  {
    id: id(),
    productVariantId: text("product_variant_id")
      .notNull()
      .references(() => productVariants.id),
    locationId: text("location_id"),
    movementType: text("movement_type", {
      enum: [
        "opening_balance",
        "purchase_receipt",
        "manual_adjustment",
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
  (t) => [index("ledger_variant_loc_idx").on(t.productVariantId, t.locationId)],
);

export const inventorySnapshots = sqliteTable(
  "inventory_snapshots",
  {
    id: id(),
    productVariantId: text("product_variant_id")
      .notNull()
      .references(() => productVariants.id),
    locationId: text("location_id"),
    stockOnHand: integer("stock_on_hand").notNull().default(0),
    reservedStock: integer("reserved_stock").notNull().default(0),
    availableStock: integer("available_stock").notNull().default(0),
    shopeePublishedStock: integer("shopee_published_stock"),
    reorderThreshold: integer("reorder_threshold"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("snapshot_variant_loc_uq").on(t.productVariantId, t.locationId)],
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
  subtotalSatang: integer("subtotal_satang").notNull().default(0),
  discountTotalSatang: integer("discount_total_satang").notNull().default(0),
  taxTotalSatang: integer("tax_total_satang").notNull().default(0),
  grandTotalSatang: integer("grand_total_satang").notNull().default(0),
  saleStatus: text("sale_status").notNull().default("completed"),
  createdAt: createdAt(),
});

export const onsiteSaleLines = sqliteTable("onsite_sale_lines", {
  id: id(),
  onsiteSaleId: text("onsite_sale_id")
    .notNull()
    .references(() => onsiteSales.id),
  productVariantId: text("product_variant_id").references(() => productVariants.id),
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
    channel: text("channel", { enum: ["shopee"] }).notNull(),
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
  },
  (t) => [uniqueIndex("order_channel_external_uq").on(t.channel, t.externalOrderId)],
);

export const financialRecords = sqliteTable(
  "financial_records",
  {
    id: id(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    recordType: text("record_type").notNull(),
    channel: text("channel", { enum: ["onsite", "shopee"] }).notNull(),
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

export const syncJobs = sqliteTable("sync_jobs", {
  id: id(),
  provider: text("provider").notNull(),
  jobType: text("job_type").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  nextRetryAt: integer("next_retry_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});
