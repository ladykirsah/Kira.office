# Roadmap

## Phase 0 - Requirement Lock

- Answer open questions.
- Confirm tech stack.
- Confirm Shopee seller region and account status.
- Confirm GitHub repo name and visibility.
- Confirm tax, currency, fee, and profit formula rules.
- Confirm T&C language and patterns.

## Phase 1 - Foundation

- Create application repo structure.
- Add database schema and migrations.
- Add authentication and roles.
- Add audit log.
- Add test framework and CI.

## Phase 2 - Product Catalog MVP

- Product list.
- Add/edit product.
- Type, brand, and usage categories.
- Product variants.
- Product image upload.
- Barcode management.
- Terms pattern generation and approval.

## Phase 3 - Inventory And On-Site Sales

- Stock ledger.
- Inventory snapshots.
- Barcode lookup.
- On-site sale screen.
- Payment method capture.
- Stock deduction and audit logs.

## Phase 4 - Pricing And Finance

- Cost and pricing profiles.
- Tax and commission profiles.
- Profit preview.
- Sales table.
- Finance summary.
- CSV/spreadsheet export.

## Phase 5 - Shopee Integration MVP

- Shopee app authorization.
- Token refresh.
- Shop info import.
- Product/listing import.
- Local-to-Shopee item/model mapping.
- Order import.
- Stock update queue.

## Phase 6 - Production Hardening

- Error monitoring.
- Backups.
- Access control review.
- Data export/import.
- Sync retry dashboard.
- Deployment automation.

## Suggested First Development Slice

Build the local product, barcode, inventory, and pricing core before live Shopee writes. This allows testing the business logic safely, then connecting Shopee with controlled sync jobs.
