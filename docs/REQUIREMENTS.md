# Requirements

Authoritative decisions live in [DECISIONS.md](DECISIONS.md). This file expands them into
testable requirements. Region: **Shopee Thailand**. Currency: **THB**. VAT: **7%**, per-product
inclusive/exclusive.

## Functional Requirements

### A. Admin Back Office

- A1. Admin can log in securely.
- A2. Admin can invite/create staff users.
- A3. Admin can assign roles: owner, manager, stock operator, finance viewer.
- A4. Admin can view append-only audit logs for product, stock, pricing, and sales changes.
- A5. Owner-only actions: delete product, override negative stock, override on-site price,
  change tax settings, change fee profiles, publish Shopee sync changes.

### B. Product Management

- P1. Add a new product.
- P2. Edit name, description, SKU, barcode, brand, type, usage, status, notes.
- P3. Create variants (size, color, scent, bundle, pack quantity).
- P4. Upload product pictures; P5. reorder, remove, replace pictures.
- P6. Categorize each product by type, brand, and usage.
- P7. Search/filter by SKU, barcode, Shopee item id, type, brand, usage, stock status, listing status.
- P8. Map a local product/variant to a Shopee item/model (available once Shopee linkage is on).

### C. Terms And Conditions (Thai)

- T1. Create reusable Thai terms patterns.
- T2. Generate product terms from a pattern + product fields.
- T3. Preview and edit generated terms before saving.
- T4. Store terms version history per product.
- T5. Mark terms approved for publishing. Changing a pattern does **not** rewrite approved terms.

### D. Inventory And Barcode

- I1. Assign one or more barcodes to a variant; one is primary.
- I2. Scan from a USB scanner (keyboard input, submit on Enter).
- I3. Scan from a device camera where supported (USB remains the baseline).
- I4. Manual barcode entry fallback.
- I5. Use existing EAN/UPC barcodes; generate an internal barcode only when a product has none.
- I6. View stock on hand, reserved, available, and (later) Shopee-published stock.
- I7. Record stock adjustments with reason, user, time, and reference.
- I8. Record on-site sales by barcode scan; completion posts a stock ledger entry.
- I9. Prevent stock from going negative unless an owner explicitly allows override.
- I10. Stock changes can queue a Shopee stock update for linked listings/models (later phase).

### E. Offline-First On-Site Selling

- O1. The POS sale screen loads products, prices, and current stock from a **local on-device store**.
- O2. Staff can complete a sale with **no internet connection**.
- O3. Offline sales use **client-generated ids** and are queued for sync.
- O4. On reconnect, queued sales sync **idempotently** — never duplicated, never lost.
- O5. Sync reconciles stock; conflicts (e.g., a Shopee sale reduced the same stock) are surfaced
  for review rather than silently overwritten.
- O6. The UI clearly shows online/offline state and unsynced sale count.

### F. Pricing Management

- R1. Enter item cost and landed-cost components (inbound shipping, packaging, other allocated).
- R2. Choose the shop **cost method**: moving average, latest, manual, or FIFO.
- R3. Set tax per product: VAT rate and **inclusive vs exclusive**; allow a non-taxed product.
- R4. Define Shopee commission, transaction fee, service fee, and fixed fee as **adjustable %/amounts**.
- R5. System shows expected profit and margin before publishing a price.
- R6. Store pricing history by product and variant (effective dating).
- R7. Compute actual profit per completed sale using the cost snapshot at sale time:
  - **On-site:** `(price − discount) − tax − cost` (no marketplace fee).
  - **Online (Shopee):** the above **minus** Shopee commission/transaction/service/fixed fees.
  - The `− tax` term only applies to VAT-**inclusive** prices (tax is embedded in the price). For
    VAT-exclusive prices tax is added on top and is not subtracted from profit. The authoritative
    per-case formulas are in [PRICING_AND_FINANCE.md](PRICING_AND_FINANCE.md).

### G. Sales And Financial Records

- S1. Store online sales (Shopee) and S2. on-site sales.
- S3. Sales records include order number, channel, customer reference, product, quantity, price,
  discount, tax, fees, cost, profit, payment method, status.
- S4. Filter sales by channel, date range, product, status, payment method.
- S5. Record refunds, cancellations, and stock returns.
- S6. Finance view summarizes revenue, cost, fees, tax (VAT collected), gross profit, margin.
- S7. Export sales and finance records to CSV/spreadsheet for an accountant.

### H. Data Import

- D1. Import products from Google Sheets / CSV with explicit column mapping (data is partial today).
- D2. Import Shopee orders from Seller Centre CSV (bridge before live API).
- D3. Imports are idempotent and report skipped/duplicate/invalid rows.

### J. Shopee Integration (gated later phase — see SHOPEE_INTEGRATION.md)

- H1–H10 (authorize shop, store tokens securely, refresh tokens, import products/orders, map
  item/model ids, upload images, update listings/stock, poll/push) apply **once Open API access
  is confirmed**. Until then, CSV bridge (D2) covers order import and stock export.

## Non-Functional Requirements

- N1. All stock, sale, and finance changes are auditable (append-only).
- N2. Secrets are encrypted or in a managed secret store; never in source.
- N3. Pricing, tax, fee, profit, and **cost-method** logic have automated tests.
- N4. Stock ledger behavior has automated tests.
- N5. Shopee integration supports sandbox/test mode before production.
- N6. UI works on desktop and tablet; mobile useful for barcode scanning.
- N7. Offline-first POS: local persistence survives reload/crash; sync is idempotent.
- N8. CSV import/export uses explicit column names and THB/date formats.
- N9. Sync errors are visible and retryable.
- N10. Duplicate online orders are prevented via unique `channel + external_order_id`.
- N11. Record timezone (**Asia/Bangkok**) for all financial dates.

## MVP Acceptance Criteria

- Create a product with images, category, barcode, stock, pricing (THB + VAT), and Thai terms.
- Scan a barcode to find a product and create an on-site sale **offline**, then sync it.
- Import Shopee orders (CSV) into the sales table without duplicates.
- Compute profit for on-site and online sales (online includes Shopee fees).
- Export sales and finance records.
