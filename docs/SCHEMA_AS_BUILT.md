# Schema — As Built

The actual D1 (SQLite) schema, derived from the applied migrations `0000`–`0047` in
[`packages/db/migrations/`](../packages/db/migrations/) — **the SQL files are the only source of
truth**. (A `packages/db/src/schema.ts` Drizzle draft used to be cited here as "the shape source of
truth"; it was never compiled, never imported, had drifted from the applied DDL, and has been
removed. The `BACKUP_TABLES` drift test in `apps/api/src/index.test.ts` derives its table list from
the migration files for the same reason.)

This doc details the base back-office schema (migrations `0000`–`0018`) plus the AirPlus storefront
additions (migrations `0036`–`0047`, in their own section below).

> **Two staleness warnings.** (1) Migrations `0019`–`0035` have since altered the base tables — some
> added, some dropped (`0022`–`0026` in particular dropped tables and columns) — and are **not fully
> reflected in the base-tables section**. (2) The *Migration history* section at the bottom is only
> itemised through `0018`. Trust the migration files over both.

This complements — and where they differ, supersedes — the original plan in
[DATA_MODEL.md](DATA_MODEL.md). The Worker runs **raw `db.prepare(...)` SQL** against D1; there is no
ORM and no generated types in the query path.

## Conventions

- Money columns end `_satang` (integer satang). Rate columns end `_bp` (basis points). Timestamps
  are integer epoch ms (UTC). IDs are app-generated `TEXT` primary keys.
- Booleans are `INTEGER` 0/1. Case-insensitive uniqueness uses `COLLATE NOCASE`.
- Additive, nullable migrations are preferred so a previously-deployed Worker keeps working during
  rollout (e.g. migration `0010` added `oring_usage` and intentionally **left `oring_size` in place,
  now unused**).

## Base tables (24, migrations `0000`–`0018`)

### Catalog & attributes
| Table | Key columns |
| --- | --- |
| `products` | `id`, `name`, `description`, `type_id`, `brand_id`, `usage_id`, `tax_profile_id`, `status` (`draft`), `image_key`, `shopee_listed`, `shopee_item_id`, `category`, `weight_grams`, `product_ref` (**uq — the Product ID, sole identifier + barcode source**), `default_terms_pattern_id`, `created_at`, `updated_at` |
| `product_variants` | `id`, `product_id`→products, `sku`, `variant_name`, `barcode_primary`, `status` (`active`), `created_at` |
| `product_images` | `id`, `product_id`→products, `image_key` (R2), `sort_order`, `is_cover`, `created_at` |
| `brands` | `id`, `name` (uq nocase), `sort_order`, `created_at` — seeded (DENSO, Mitsubishi, Sanden, Valeo, Mahle) |
| `product_types` | `id`, `name` (uq nocase), `sort_order`, `created_at` — seeded (Evaporator, Condenser, Compressor, …) |
| `usage_categories` | `id`, `name` (uq nocase), `sort_order`, `created_at` — seeded (A/C, Engine, Cooling, Electrical) |
| `barcodes` | `id`, `product_variant_id`→variants, `barcode_value` (uq), `is_primary`, `is_internal_generated`, `created_at` |
| `tax_profiles` | `id`, `name`, `vat_rate_bp` (700), `price_includes_vat` (1), `is_taxable` (1) |

`products.brand_id`/`type_id`/`usage_id` reference the managed attribute lists above. On `PATCH
/products/:id`, the Worker resolves `brandName`/`typeName`/`usageName` to ids, creating the row if new.

### Vehicle fitment
| Table | Key columns |
| --- | --- |
| `car_brands` | `id`, `name` (uq nocase), `sort_order`, `created_at` — seeded (Toyota, Honda, Mitsubishi, Isuzu, Nissan) |
| `car_models` | `id`, `car_brand_id`→car_brands, `name`, `sort_order`, era `year_from`/`year_to`, `generation_code`, `refrigerant`, `oring_usage` (JSON), `coolant_liters`, `notes`, `created_at`, ~~`oring_size`~~ (dead). **Uniqueness: `(car_brand_id, name NOCASE, year_from, year_to)`** — a model is a generation; the same name repeats once per era. |
| `product_fitments` | `id`, `product_id`→products, `car_brand` (text/denormalized), `car_model` (text), `year_from`, `year_to`, `sort_order`, `created_at` |

`car_models.oring_usage` JSON shape: `[{"size":"3/8\"","qty":3},{"size":"1/2\"","qty":2}]`
(basics 3/8"/1/2"/5/8" + special sizes). Parsed/validated by `parseOringUsage` in the Worker.

### Pricing & finance
| Table | Key columns |
| --- | --- |
| `pricing_profiles` | `id`, `product_variant_id`→variants, `item_cost_satang`, `inbound_shipping_satang`, `packaging_satang`, `other_allocated_satang`, `target_price_satang`, `online_price_satang`, `b2b_price_satang`, `online_commission_bp`, `tax_on_cost`, `active_from`, `active_to` |
| `financial_records` | `id`, `source_type`, `source_id`, `record_type`, `channel` (CHECK: `onsite`\|`shopee`\|`airplus`\|`affiliate`), `amount_satang`, `tax_satang`, `fee_satang`, `cost_satang`, `profit_satang`, `occurred_at`, `notes` — stores both inputs and outputs so history is immutable |

**Dropped, do not design against:** `commission_profiles` (dropped `0022`) and `cost_layers`
(dropped `0024` — FIFO layering was never wired; the POS passes `unitCost` from the client).

### Inventory
| Table | Key columns |
| --- | --- |
| `stock_ledger_entries` | `id`, `product_variant_id`→variants, `movement_type`, `quantity_delta`, `quantity_after`, `source_type`, `source_id`, `reason`, `user_id`→users, `created_at`. **On-hand = `SUM(quantity_delta)`.** |

`stock_ledger_entries` is the **only** inventory table. Notes for anyone designing holds / scanning:

- **No `location_id`** — dropped in `0024` (no `locations` table ever existed; the shop is
  single-location). On-hand is derived per variant only.
- **No reserved / available / reorder storage exists.** `inventory_snapshots` (which held
  `reserved_stock`, `available_stock`, `reorder_threshold`) was **dropped in `0024`** — it was never
  populated. There is nothing in D1 today that can express "on hold" or "available vs on-hand";
  that is net-new schema.
- `quantity_after` is an audit snapshot written at insert time. **Never read it for math** — it is
  wrong the moment two writes race (and they can; see
  [CLOUDFLARE_ARCHITECTURE.md](CLOUDFLARE_ARCHITECTURE.md)). On-hand is always `SUM(quantity_delta)`.
- `movement_type` is **CHECK-constrained** (`0026`) to exactly: `opening_balance`,
  `purchase_receipt`, `manual_adjustment`, `receive`, `write_off`, `correction`, `onsite_sale`,
  `online_sale`, `refund_return`, `damaged_lost`, `transfer`, `reconciliation`. A new hold-style
  movement type **requires a migration to rebuild the table with an extended CHECK** — SQLite cannot
  `ALTER` a CHECK. Inserting an unlisted value fails at the DB.

### Sales
| Table | Key columns |
| --- | --- |
| `onsite_sales` | `id`, `client_uuid` (uq — idempotent offline sync), `device_id`, `sync_status` (`local`), `synced_at`, `sale_number`, `cashier_user_id`→users, `payment_method`, `subtotal_satang`, `discount_total_satang`, `tax_total_satang`, `grand_total_satang`, `sale_status` (`completed`), `created_at` |
| `onsite_sale_lines` | `id`, `onsite_sale_id`→onsite_sales, `product_variant_id`, `barcode_value`, `quantity`, `unit_price_satang`, `discount_satang`, `tax_satang`, `unit_cost_satang`, `cost_method_used`, `gross_profit_satang` |
| `sales_orders` | `id`, `channel`+`external_order_id` (uq — no duplicate import), `order_status`, `payment_status`, `*_satang` totals, `order_created_at`, `imported_at`, `import_source` (`csv`) |

### Settings, identity, jobs
| Table | Key columns |
| --- | --- |
| `shop_settings` | `id`, `base_currency` (THB), `timezone` (Asia/Bangkok), `cost_method` (`moving_average`), `default_vat_rate_bp` (700), `vat_registered` (1), `updated_at` |
| `users` | `id`, `name`, `email` (uq), `role`, `status` (`active`), `created_at` — **no user-management UI / auth wiring yet** |
| `audit_logs` | `id`, `actor_email`, `user_id`→users (nullable), `action`, `entity_type`, `entity_id`, `before_json`, `after_json`, `created_at` — append-only mutation audit |

**Dropped, do not design against:** `sync_jobs` (dropped `0024` — the Shopee retry queue was never
used) and `shopee_listings` / `shopee_listing_models` (dropped `0023`).

`shop_connections` and `terms_patterns`/`product_terms` are **created by migration `0017`** (empty
until Phase 5 / T&C UI). The sibling `shopee_listings` / `shopee_listing_models` tables `0017` also
created were **dropped again in `0023`**.
`product_variants` has nullable `option_1_*` / `option_2_*` columns for a future multi-variant editor.
See [NEXT_PHASE_PREP.md](NEXT_PHASE_PREP.md).

## Storefront tables (AirPlus, migrations `0036`–`0047`)

The customer-facing storefront (`apps/storefront`, a separate Cloudflare Worker binding the same D1
database) added these tables. All are additive and are mirrored in `schema.ts`.

| Table | Key columns |
| --- | --- |
| `sales_order_lines` | `id`, `sales_order_id`→sales_orders, `product_variant_id`→variants, `quantity`, `unit_price_satang`, `unit_cost_satang` (cost snapshot at sale time), `line_total_satang`, `created_at` — real line items for storefront-checkout orders (CSV-imported Shopee orders stay header-only). |
| `storefront_customers` | `id`, `phone` (uq), `name`, `email`, `created_at`, `updated_at`; `0041` adds account fields — `phone_verified_at`, `pdpa_consent_at`, `last_login_at`, `line_user_id`/`facebook_id` (partial-unique), `password_hash`, `status` (`active`). Phone-keyed guest-checkout customers, **distinct from the plate-keyed `customers` table**. |
| `addresses` | `id`, `storefront_customer_id`→storefront_customers, `recipient_name`, `phone`, `address_line1`, `subdistrict`, `district`, `province`, `postal_code`, `is_default`, `created_at`. |
| `storefront_sessions` | `id`, `token_hash` (uq — SHA-256 of the raw cookie token), `customer_id`→storefront_customers, `created_at`, `expires_at`, `last_seen_at`, `revoked_at` — DB-backed, revocable sessions. |
| `auth_otp_codes` | `id`, `phone`, `code_hash`, `salt`, `purpose` (`login`), `expires_at`, `attempts`, `consumed_at`, `created_at` — 6-digit, 5-min-TTL, single-use phone-OTP codes (hash only). |
| `auth_throttle` | `key` (pk), `count`, `window_started_at` — fixed-window request counters (`otp:phone:*`, `otp:ip:*`, `coupon:ip:*`), single-statement upsert. |
| `coupons` | `id`, `code` (uq), `type` (`fixed`/`percent`), `value`, `min_subtotal_satang`, `starts_at`/`ends_at`, `max_uses`, `max_uses_per_customer`, `status` (`active`/`disabled`), `created_at` — member-only codes. |
| `coupon_redemptions` | `id`, `coupon_id`→coupons, `customer_id`→storefront_customers, `sales_order_id`→sales_orders, `amount_discounted_satang`, `created_at`. **Uq `(coupon_id, sales_order_id)`.** |
| `campaigns` | `id`, `name`, `starts_at`, `ends_at`, `status` (`active`/`disabled`), `created_at` — flash-sale windows. |
| `campaign_prices` | `id`, `campaign_id`→campaigns, `product_variant_id`→variants, `campaign_price_satang`, `stock_cap`, `sold_count`, `created_at`. **Uq `(campaign_id, product_variant_id)`.** Price resolved in code (`resolveEffectivePrice`), no cron. |
| `banners` | `id`, `slot` (`hero`/`promo`), `image_key` (R2 `banners/`), `link_url`, `sort_order`, `starts_at`/`ends_at`, `status`, `created_at` — home-page banners, admin-managed. |
| `affiliate_items` | `id`, `title`, `image_key`, `price_text` (freeform display, never used in math), `source` (`shopee`/`lazada`/`other`), `target_url`, `sort_order`, `status`, `created_at` — mechanic-tools affiliate cards. |
| `affiliate_clicks` | `id`, `item_id`→affiliate_items, `created_at` — per-item click tracking (correlated with `channel = 'affiliate'` finance rows). |

Column additions to existing tables: `0039` adds `sales_orders.storefront_customer_id` +
`shipping_address_id` (both nullable — only storefront-checkout orders set them); `0040` adds
`payments.sales_order_id` (nullable — links a payment approval to its storefront order).

## Migration history

| File | Adds |
| --- | --- |
| `0000_init` | Base 17 tables (catalog, variants, barcodes, pricing/commission/cost, inventory ledger + snapshots, on-site sales, sales orders, finance, settings, users, sync_jobs, tax_profiles). |
| `0001_product_image_key` | `products.image_key` (R2 cover). |
| `0002_shopee_listing` | `products.shopee_listed`, `pricing_profiles.online_price_satang`. |
| `0003_product_editor` | `product_images` table; `products.shopee_item_id`/`category`/`weight_grams`. |
| `0004_pricing_model` | `pricing_profiles.b2b_price_satang`/`online_commission_bp`/`tax_on_cost`. |
| `0005_part_attributes` | `brands`, `product_types`, `usage_categories` + seeds. |
| `0006_product_ref` | `products.product_ref` (manufacturer/catalog ref). |
| `0007_fitments` | `car_brands`, `car_models`, `product_fitments` + seeds. |
| `0008_models_under_brands` | `car_models.car_brand_id`; uniqueness per brand. |
| `0009_car_model_info` | Per-model service-note columns (era, refrigerant, oring_size, coolant, notes). |
| `0010_oring_usage` | `car_models.oring_usage` JSON (supersedes `oring_size`). |
| `0011_model_era` | Uniqueness → `(brand, name, year_from, year_to)` (model = generation). |
| `0012_product_updated_at` | `products.updated_at` (+ backfill from `created_at`). |
| `0013_services` | `services` catalogue table. |
| `0014_repair_orders` | On-site sale repair fields (`sale_type`, service lines). |
| `0015_sale_vehicle` | `license_plate`, `vehicle`, `notes` on onsite sales. |
| `0016_audit_logs` | Append-only `audit_logs` table + indexes. |
| `0017_gated_phase_prep` | Shopee mapping + T&C tables; variant option columns; `products.default_terms_pattern_id`. |
| `0018_remove_product_code` | Product ID (`product_ref`) becomes the sole identifier: backfill from `product_code`, add unique index `products_product_ref_unique`, then **drop `product_code`** and its unique index. |
| `0019`–`0035` | Interim back-office migrations (service naming, dead-table drops, channel/movement CHECK constraints, on-site staging, customers, Shopee order/fulfillment fields, payments + slip, customer history) — **not individually detailed in this doc**. |
| `0036_sales_order_lines` | `sales_order_lines` (real line items for storefront-checkout orders). |
| `0037_storefront_customers` | `storefront_customers` (phone-keyed guest-checkout customers; distinct from plate-keyed `customers`). |
| `0038_addresses` | `addresses` (shipping addresses for storefront customers). |
| `0039_sales_orders_customer_address` | `sales_orders.storefront_customer_id` + `shipping_address_id` (nullable). |
| `0040_payments_order_link` | `payments.sales_order_id` (nullable — links a payment to its storefront order). |
| `0041_customer_accounts` | Storefront customers become accounts: phone-verify, PDPA consent, login bookkeeping, provider slots (LINE/Facebook/email), `status`. |
| `0042_storefront_sessions` | `storefront_sessions` (DB-backed, revocable sessions; stores the token hash only). |
| `0043_auth_otp` | `auth_otp_codes` + `auth_throttle` (phone-OTP login codes + fixed-window throttling). |
| `0044_coupons` | `coupons` + `coupon_redemptions` (member-only codes). |
| `0045_campaigns` | `campaigns` + `campaign_prices` (flash-sale windows; price resolved in code). |
| `0046_banners` | `banners` (home-page hero/promo banners). |
| `0047_affiliate_items` | `affiliate_items` + `affiliate_clicks` (mechanic-tools affiliate). |

## Migration workflow (do this exactly)

1. Add the next numbered `NNNN_name.sql` to `packages/db/migrations/` (additive + nullable when a
   live Worker may still run the old code).
2. Apply to **both** D1 databases — prod `2e88a362-ffd7-4255-b178-e511d475f687` and staging
   `85f22f44-063d-424e-91ef-39e1fa1fef24` (`kira-office-staging`) — via the Cloudflare D1 MCP
   `d1_database_query` or `wrangler d1 migrations apply`.
3. Update the table listings above so this doc stays as-built (there is no `schema.ts` to mirror any
   more — the migration *is* the schema).
4. Add/adjust tests in `apps/api/src/index.test.ts` for any new behavior, then deploy.

**SQLite gotcha:** you cannot `ALTER` a `CHECK` constraint. Changing an enum vocabulary (e.g. adding
a hold movement type to `stock_ledger_entries.movement_type`) means rebuilding the table —
`CREATE … _new` with the new CHECK, copy rows explicitly, `DROP`, `RENAME`, recreate indexes. See
`0025` and `0026` for the exact pattern.
