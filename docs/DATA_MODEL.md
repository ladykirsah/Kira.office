# Data Model Draft

This is an initial schema plan. Field names can change once the stack is confirmed.

## Identity And Access

### users

- id
- name
- email
- role
- status
- created_at
- updated_at

### audit_logs

- id
- user_id
- action
- entity_type
- entity_id
- before_json
- after_json
- created_at

## Shopee Connection

### shop_connections

- id
- provider: `shopee`
- shop_id
- shop_name
- region
- partner_id_reference
- access_token_secret_reference
- refresh_token_secret_reference
- token_expires_at
- status
- created_at
- updated_at

## Product Catalog

### products

- id
- product_code
- name
- description
- type_id
- brand_id
- usage_id
- status
- default_terms_pattern_id
- notes
- created_at
- updated_at

### product_variants

- id
- product_id
- sku
- variant_name
- option_1_name
- option_1_value
- option_2_name
- option_2_value
- barcode_primary
- status
- created_at
- updated_at

### product_images

- id
- product_id
- variant_id nullable
- storage_url
- shopee_image_id nullable
- sort_order
- alt_text
- created_at

### product_types

- id
- name
- description

### brands

- id
- name
- description

### usage_categories

- id
- name
- description

### barcodes

- id
- product_variant_id
- barcode_value
- barcode_type
- source
- is_primary
- created_at

## Shopee Listing Mapping

### shopee_listings

- id
- shop_connection_id
- product_id
- shopee_item_id
- listing_status
- last_synced_at
- sync_status
- created_at
- updated_at

### shopee_listing_models

- id
- shopee_listing_id
- product_variant_id
- shopee_model_id
- shopee_model_sku
- shopee_stock
- last_synced_at

## Inventory

### inventory_locations

- id
- name
- type
- status

### stock_ledger_entries

- id
- product_variant_id
- location_id
- movement_type
- quantity_delta
- quantity_after
- source_type
- source_id
- reason
- user_id
- created_at

### inventory_snapshots

- id
- product_variant_id
- location_id
- stock_on_hand
- reserved_stock
- available_stock
- updated_at

## Pricing

### pricing_profiles

- id
- product_variant_id
- currency
- item_cost
- inbound_shipping_cost
- packaging_cost
- other_allocated_cost
- tax_profile_id
- commission_profile_id
- target_selling_price
- active_from
- active_to

### tax_profiles

- id
- name
- tax_rate
- tax_inclusive
- applies_to_channel
- notes

### commission_profiles

- id
- name
- channel
- commission_rate
- transaction_fee_rate
- fixed_fee
- service_fee_rate
- notes

## Terms And Conditions

### terms_patterns

- id
- name
- body_template
- required_fields_json
- status
- created_at
- updated_at

### product_terms

- id
- product_id
- terms_pattern_id
- generated_body
- version
- status
- approved_by_user_id
- approved_at
- created_at

## Sales And Finance

### sales_orders

- id
- channel
- external_order_id
- customer_reference
- order_status
- payment_status
- currency
- subtotal
- discount_total
- tax_total
- fee_total
- shipping_total
- grand_total
- order_created_at
- imported_at

### sales_order_lines

- id
- sales_order_id
- product_variant_id
- external_item_id
- external_model_id
- quantity
- unit_price
- discount_amount
- tax_amount
- fee_amount
- unit_cost
- gross_profit

### onsite_sales

- id
- sale_number
- cashier_user_id
- payment_method
- currency
- subtotal
- discount_total
- tax_total
- grand_total
- sale_status
- created_at

### onsite_sale_lines

- id
- onsite_sale_id
- product_variant_id
- barcode_value
- quantity
- unit_price
- discount_amount
- tax_amount
- unit_cost
- gross_profit

### financial_records

- id
- source_type
- source_id
- record_type
- channel
- amount
- currency
- tax_amount
- fee_amount
- cost_amount
- profit_amount
- occurred_at
- notes

## Sync And Jobs

### sync_jobs

- id
- provider
- job_type
- entity_type
- entity_id
- status
- attempts
- last_error
- next_retry_at
- created_at
- updated_at

## Key Constraints

- `sales_orders.channel + external_order_id` should be unique for imported online sales.
- `barcodes.barcode_value` should be unique unless multi-pack/shared barcode behavior is explicitly approved.
- Stock should be derived from ledger entries or reconciled against snapshots with audit logs.
- Financial calculations should store both inputs and outputs so historical records do not change when fee rules change later.
