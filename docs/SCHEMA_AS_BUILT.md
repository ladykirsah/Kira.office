# Schema — As Built

The actual D1 (SQLite) schema, derived from the applied migrations `0000`–`0016` in
[`packages/db/migrations/`](../packages/db/migrations/) and mirrored in
[`packages/db/src/schema.ts`](../packages/db/src/schema.ts) (Drizzle, the shape source of truth).

This complements — and where they differ, supersedes — the original plan in
[DATA_MODEL.md](DATA_MODEL.md). The Worker runs **raw `db.prepare(...)` SQL**, not the Drizzle query
builder, so `schema.ts` is for shape/typing, not runtime queries.

## Conventions

- Money columns end `_satang` (integer satang). Rate columns end `_bp` (basis points). Timestamps
  are integer epoch ms (UTC). IDs are app-generated `TEXT` primary keys.
- Booleans are `INTEGER` 0/1. Case-insensitive uniqueness uses `COLLATE NOCASE`.
- Additive, nullable migrations are preferred so a previously-deployed Worker keeps working during
  rollout (e.g. migration `0010` added `oring_usage` and intentionally **left `oring_size` in place,
  now unused**).

## Tables (24)

### Catalog & attributes
| Table | Key columns |
| --- | --- |
| `products` | `id`, `product_code` (uq), `name`, `description`, `type_id`, `brand_id`, `usage_id`, `tax_profile_id`, `status` (`draft`), `image_key`, `shopee_listed`, `shopee_item_id`, `category`, `weight_grams`, `product_ref`, `created_at`, `updated_at` |
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
| `commission_profiles` | `id`, `name`, `channel` (`shopee`), `commission_rate_bp`, `transaction_fee_rate_bp`, `service_fee_rate_bp`, `fixed_fee_satang`, `fee_base` (`buyer_price`) |
| `cost_layers` | `id`, `product_variant_id`→variants, `location_id`, `received_qty`, `remaining_qty`, `unit_cost_satang`, `received_at` (supports moving-average + FIFO) |
| `financial_records` | `id`, `source_type`, `source_id`, `record_type`, `channel`, `amount_satang`, `tax_satang`, `fee_satang`, `cost_satang`, `profit_satang`, `occurred_at`, `notes` — stores both inputs and outputs so history is immutable |

### Inventory
| Table | Key columns |
| --- | --- |
| `stock_ledger_entries` | `id`, `product_variant_id`→variants, `location_id`, `movement_type`, `quantity_delta`, `quantity_after`, `source_type`, `source_id`, `reason`, `user_id`, `created_at`. **On-hand = `SUM(quantity_delta)`.** |
| `inventory_snapshots` | `id`, `product_variant_id`+`location_id` (uq), `stock_on_hand`, `reserved_stock`, `available_stock`, `shopee_published_stock`, `reorder_threshold`, `updated_at` |

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
| `sync_jobs` | `id`, `provider`, `job_type`, `entity_type`, `entity_id`, `status` (`pending`), `attempts`, `last_error`, `next_retry_at`, `created_at` — for the (gated) Shopee queue |

Shopee mapping tables (`shop_connections`, `shopee_listings`, `shopee_listing_models`) and
`terms_patterns`/`product_terms` are **created by migration `0017`** (empty until Phase 5 / T&C UI).
`product_variants` has nullable `option_1_*` / `option_2_*` columns for a future multi-variant editor.
See [NEXT_PHASE_PREP.md](NEXT_PHASE_PREP.md).

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

## Migration workflow (do this exactly)

1. Add the next numbered `NNNN_name.sql` to `packages/db/migrations/` (additive + nullable when a
   live Worker may still run the old code).
2. Apply to **both** D1 databases — prod `2e88a362-ffd7-4255-b178-e511d475f687` and staging
   `85f22f44-063d-424e-91ef-39e1fa1fef24` (`kira-office-staging`) — via the Cloudflare D1 MCP
   `d1_database_query` or `wrangler d1 migrations apply`.
3. Mirror the change in `schema.ts` (keep typing accurate; attribute tables use the
   `attributeTable()` helper).
4. Add/adjust tests in `apps/api/src/index.test.ts` for any new behavior, then deploy.
