# Data Import

The owner has product/order data in **Google Sheets**, but it does not yet cover all fields the
back office needs. Import is a first-class, repeatable, **idempotent** feature — not a one-off.

## Sources

- **Products** — from Google Sheets / CSV export. Partial today; importer must tolerate missing
  columns and let the admin map columns to fields.
- **Shopee orders** — from Shopee Seller Centre CSV export (the bridge before live API).

## Principles

- **Explicit column mapping** UI; never guess silently. Save mappings as reusable templates.
- **Idempotent:** re-running an import does not create duplicates. Match keys:
  - Products: `product_code` or primary `barcode`.
  - Orders: `channel + external_order_id`.
- **Dry-run first:** preview created / updated / skipped / invalid rows before committing.
- **Report** every skipped or invalid row with a reason; never fail the whole import on one bad row.
- THB amounts and dates parsed explicitly (Asia/Bangkok); reject ambiguous formats.

## Product Import — Suggested Columns

`product_code, name, description, type, brand, usage, sku, variant_name, barcode, item_cost,
inbound_shipping_cost, packaging_cost, other_allocated_cost, price, vat_rate, price_includes_vat,
opening_stock, location, notes`

Missing optional columns are allowed; required minimum: a name plus `product_code` **or** `barcode`.

## Order Import (CSV bridge) — Mapping Notes

Map Seller Centre columns to: `external_order_id, order_status, payment_status, order_created_at,
sku/item_id, model_id, quantity, unit_price, discount, shipping, commission/fees, tax`. Unmatched
SKUs/barcodes are queued for admin review rather than dropped.

## Migration Path

Once live API access is granted, order import switches from CSV to the v2 `order.*` endpoints
behind the same boundary; the dedupe key and review flow stay identical.
