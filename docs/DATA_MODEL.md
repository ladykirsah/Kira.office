# Data Model Draft

> ⚠️ **This is the original plan and lags the implementation badly.** For the schema as actually
> built (migrations `0000`–`0035`, table by table), see **[SCHEMA_AS_BUILT.md](SCHEMA_AS_BUILT.md)**,
> which **supersedes this file wherever they differ**. Kept for design rationale only.
>
> Several entities below were **built differently, dropped, or never built at all** — notably
> `inventory_snapshots` and `cost_layers` (dropped `0024`), `commission_profiles` (dropped `0022`),
> Shopee listing mapping (dropped `0023`), and `sales_order_lines` (never created). Sections carry
> inline warnings. **Verify against the migrations before designing against anything here.**

Initial schema plan for **Cloudflare D1** (SQLite). Field names can change during implementation;
the applied DDL in `packages/db/migrations/*.sql` is the source of truth.
Reflects [DECISIONS.md](DECISIONS.md): per-product VAT, four cost methods, offline-first sales,
online-only marketplace fees.

**D1 / SQLite type conventions:**

- **Money → `INTEGER` minor units (satang).** Never floats. `satang = Math.round(thb * 100)`;
  convert back at the read boundary. (`packages/core` computes in THB decimals; persistence is satang.)
- **Rates → `INTEGER` basis points** (7% → `700`) or text; never binary floats.
- **Enums → `TEXT`** with a fixed value set (e.g. `cost_method`, `channel`, `sync_status`,
  `movement_type`), enforced with an explicit SQLite `CHECK` constraint in the migration (see
  `0025_channel_check_constraints.sql`, `0026_movement_type_check.sql`).
- **Timestamps → `INTEGER` epoch milliseconds (UTC)**, rendered in **Asia/Bangkok** at the edges.
- IDs are app-generated (UUID/ULID) `TEXT` primary keys.

> Entity listings below use conceptual field names; **storage follows the conventions above** —
> money columns are `*_satang` integers and rate columns are `*_bp` integers.

## Settings

### shop_settings
- id
- base_currency (default `THB`)
- timezone (default `Asia/Bangkok`)
- cost_method: `moving_average` | `latest` | `manual` | `fifo` (default `moving_average`)
- default_vat_rate_bp (default `700` = 7%)
- vat_registered (bool)
- updated_at

## Identity And Access

### users
- id, name, email, role, status, created_at, updated_at

### audit_logs
- id, user_id, action, entity_type, entity_id, before_json, after_json, created_at  _(append-only)_

## Shopee Connection (gated later phase)

### shop_connections
- id, provider (`shopee`), shop_id, shop_name, region (`TH`), partner_id_reference,
  access_token_secret_reference, refresh_token_secret_reference, token_expires_at, status,
  created_at, updated_at

## Product Catalog

### products
- id, product_code, name, description, type_id, brand_id, usage_id, status,
  tax_profile_id  _(per-product VAT: rate + inclusive/exclusive + taxable)_,
  default_terms_pattern_id, notes, created_at, updated_at

### product_variants
- id, product_id, sku, variant_name, option_1_name, option_1_value, option_2_name, option_2_value,
  barcode_primary, status, created_at, updated_at

### product_images
- id, product_id, variant_id (nullable), storage_url, shopee_image_id (nullable), sort_order,
  alt_text, created_at

### product_types / brands / usage_categories
- id, name, description

### barcodes
- id, product_variant_id, barcode_value (unique unless shared-barcode approved), barcode_type,
  source, is_primary, is_internal_generated (bool), created_at

## Tax And Pricing

### tax_profiles
- id, name, vat_rate_bp, price_includes_vat (bool), is_taxable (bool), applies_to_channel, notes
- _Assigned per product via `products.tax_profile_id`._

### pricing_profiles
- id, product_variant_id, currency (`THB`), item_cost, inbound_shipping_cost, packaging_cost,
  other_allocated_cost, commission_profile_id, target_selling_price, active_from, active_to

### commission_profiles  _(online channels only)_ — **dropped in `0022`**
- id, name, channel (`shopee`), commission_rate_bp, transaction_fee_rate_bp, service_fee_rate_bp,
  fixed_fee_satang, fee_base (`buyer_price` | `ex_tax`), notes

### cost_layers  _(supports moving_average + fifo)_ — **dropped in `0024`, never wired**
FIFO/moving-average layering was never implemented: the POS passes `unitCost` from the client, and
`packages/core/src/cost.ts` is not imported by any production code.
- id, product_variant_id, location_id, received_qty, remaining_qty, unit_cost, received_at,
  source_type, source_id

## Inventory

> ⚠️ **Only `stock_ledger_entries` was built, and without `location_id`.** The rest of this section
> is an unbuilt plan. See [SCHEMA_AS_BUILT.md](SCHEMA_AS_BUILT.md) for the real shape.

### inventory_locations — **never built**
There is no locations table; the shop is single-location. `location_id` was dropped from the ledger
in migration `0024`. Do not model multi-location.
- id, name, type, status

### stock_ledger_entries — **built** (without `location_id`)
As built: id, product_variant_id, movement_type (**CHECK-constrained**, see `0026`), quantity_delta,
quantity_after, source_type, source_id, reason, user_id, created_at. On-hand = `SUM(quantity_delta)`;
never read `quantity_after` for math.

### inventory_snapshots — **dropped in `0024`, never populated**
This table is the reason people think reserved/available stock already exists. **It does not.**
There is no `reserved_stock`, no `available_stock`, no `reorder_threshold` anywhere in D1 today.
Holds and available-vs-on-hand are **net-new schema**.
- id, product_variant_id, location_id, stock_on_hand, reserved_stock, available_stock,
  shopee_published_stock, reorder_threshold, updated_at

## Shopee Listing Mapping (gated later phase)

### shopee_listings
- id, shop_connection_id, product_id, shopee_item_id, listing_status, last_synced_at, sync_status,
  created_at, updated_at

### shopee_listing_models
- id, shopee_listing_id, product_variant_id, shopee_model_id, shopee_model_sku, shopee_stock,
  last_synced_at

## Terms And Conditions (Thai)

### terms_patterns
- id, name, language (`th`), body_template, required_fields_json, status, created_at, updated_at

### product_terms
- id, product_id, terms_pattern_id, generated_body, version, status, approved_by_user_id,
  approved_at, created_at

## Sales And Finance

### sales_orders  _(online / imported)_ — **built, but not as specced below**

> ⚠️ **As built** (`0000`, rebuilt with a channel CHECK in `0025`, extended by `0029`/`0030`):
> id, channel (**CHECK: `shopee` | `airplus`**), external_order_id, order_status, payment_status,
> subtotal_satang, discount_total_satang, tax_total_satang, fee_total_satang, grand_total_satang,
> order_created_at, imported_at, import_source, buyer_username, sales_satang, fee_bp, ship_time_ms,
> carrier, tracking_no, profit_satang. Unique on `(channel, external_order_id)`.
>
> **`customer_reference`, `shipping_total` and `currency` were never built** — do not assume them.
> Shipping is not modelled on the order at all; `currency` is implied THB shop-wide
> (`shop_settings.base_currency`).

Original plan (kept for rationale only):
- id, channel, external_order_id, customer_reference, order_status, payment_status, currency,
  subtotal, discount_total, tax_total, fee_total, shipping_total, grand_total, order_created_at,
  imported_at, import_source (`api` | `csv`)

### sales_order_lines — ⚠️ **does not exist**

There is **no `sales_order_lines` table** in D1 and no migration creating one. Imported online orders
are **header-only**: totals live on `sales_orders`, with no per-line rows. Anything needing online
line detail is net-new schema.

Original plan (unbuilt):
- id, sales_order_id, product_variant_id, external_item_id, external_model_id, quantity,
  unit_price, discount_amount, tax_amount, fee_amount (marketplace), unit_cost (snapshot),
  ~~cost_method_used~~, gross_profit

> **Do not copy `cost_method_used` if you do build this.** The existing
> `onsite_sale_lines.cost_method_used` column is **dead**: nothing in the codebase ever writes or
> reads it, and the cost-method engine that would populate it (`packages/core/src/cost.ts` —
> `resolveUnitCost`, `fifoConsume`, `movingAverageUnitCost`) is **not imported by any production
> code**. The POS sends `unitCost` from the client instead. Replicating the column would spread a
> dead field, not preserve a behaviour.

### onsite_sales  _(offline-first)_
- id, client_uuid (unique, client-generated), device_id, sync_status (`local`|`queued`|`synced`),
  synced_at, sale_number, cashier_user_id, payment_method, currency, subtotal, discount_total,
  tax_total, grand_total, sale_status, created_at

### onsite_sale_lines
- id, onsite_sale_id, product_variant_id, barcode_value, quantity, unit_price, discount_amount,
  tax_amount, unit_cost (snapshot), cost_method_used, gross_profit

### financial_records
- id, source_type, source_id, record_type, channel, amount, currency, tax_amount, fee_amount,
  cost_amount, profit_amount, occurred_at, notes

## Sync And Jobs

### sync_jobs
- id, provider, job_type, entity_type, entity_id, status, attempts, last_error, next_retry_at,
  created_at, updated_at

## Key Constraints

- `sales_orders.channel + external_order_id` unique (no duplicate online import).
- `onsite_sales.client_uuid` unique (idempotent offline sync — never double-count a sale).
- `barcodes.barcode_value` unique unless multi-pack/shared barcode is explicitly approved.
- Stock is derived from `stock_ledger_entries` (deltas) with audit logs. Concurrent on-site/online
  movements **add**, never overwrite. (The planned reconciliation against `inventory_snapshots`
  never happened — that table was dropped in `0024`.)
- Financial calculations store **both inputs and outputs** (cost/tax/fee/profit snapshots) so
  historical records do not change when fee/tax/cost rules change later.
- `products.tax_profile_id` drives per-product VAT inclusive/exclusive behavior.
