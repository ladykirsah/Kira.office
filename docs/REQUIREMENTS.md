# Requirements

## Functional Requirements

### A. Admin Back Office

- A1. Admin can log in securely.
- A2. Admin can invite or create staff users.
- A3. Admin can assign roles such as owner, manager, stock operator, and finance viewer.
- A4. Admin can view audit logs for product, stock, pricing, and sales changes.

### B. Product Management

- P1. Admin can add a new product.
- P2. Admin can edit product name, description, SKU, barcode, brand, type, usage, status, and notes.
- P3. Admin can create product variants, such as size, color, bundle, or package quantity.
- P4. Admin can upload product pictures.
- P5. Admin can reorder, remove, and replace product pictures.
- P6. Admin can categorize each product by type, brand, and usage.
- P7. Admin can search and filter products by SKU, barcode, Shopee item id, type, brand, usage, stock status, and listing status.
- P8. Admin can map a local product or variant to a Shopee item/model.

### C. Terms And Conditions

- T1. Admin can create reusable terms patterns.
- T2. Admin can generate product terms from a selected pattern and product fields.
- T3. Admin can preview and edit generated terms before saving.
- T4. Admin can store terms version history per product.
- T5. Admin can mark terms as approved for publishing.

### D. Inventory And Barcode

- I1. Admin can assign one or more barcodes to a product variant.
- I2. System can scan barcode input from a USB scanner.
- I3. System can scan barcode input from a device camera where browser support allows it.
- I4. Admin can view stock on hand, reserved stock, available stock, and Shopee published stock.
- I5. Admin can record stock adjustments with reason, user, time, and reference.
- I6. Admin can record on-site sales by barcode scan.
- I7. On-site sale completion reduces stock through a stock ledger entry.
- I8. Stock changes can queue a Shopee stock update for linked listings/models.
- I9. System prevents stock from going negative unless an owner explicitly allows override.

### E. Pricing Management

- R1. Admin can enter item cost, landed cost components, packaging cost, and other allocated cost.
- R2. Admin can define tax settings per product or sale channel.
- R3. Admin can define Shopee commission, transaction fee, service fee, and other e-commerce fees.
- R4. System calculates expected profit and margin before publishing price.
- R5. System stores pricing history by product and variant.
- R6. System calculates actual profit per completed sale.

### F. Sales And Financial Records

- S1. System stores online sales imported from Shopee.
- S2. System stores manual/on-site sales.
- S3. Sales table includes order number, channel, customer reference, product, quantity, price, discount, tax, fees, cost, profit, payment method, and status.
- S4. Admin can filter sales by channel, date range, product, status, and payment method.
- S5. System records refunds, cancellations, and stock returns.
- S6. Finance view summarizes revenue, cost, fees, tax, gross profit, and margin.
- S7. Admin can export sales and finance records to CSV or spreadsheet format.

### G. Shopee Integration

- H1. Admin can authorize a Shopee seller shop.
- H2. System stores Shopee shop id and token metadata securely.
- H3. System can refresh Shopee access tokens.
- H4. System can import Shopee product list and item details.
- H5. System can map Shopee item/model ids to local products/variants.
- H6. System can upload product images to Shopee when supported by the selected API path.
- H7. System can create or update Shopee item/listing data when approved by admin.
- H8. System can update Shopee stock for linked items/models.
- H9. System can import Shopee orders and order details.
- H10. System can receive or poll Shopee updates depending on approved app configuration.

## Non-Functional Requirements

- N1. All stock, sale, and finance changes must be auditable.
- N2. Secrets must be encrypted or stored in a managed secret store.
- N3. Pricing and finance formulas must have automated tests.
- N4. Stock ledger behavior must have automated tests.
- N5. Shopee API integration must support sandbox or test mode before production use.
- N6. UI should work well on desktop and tablet; mobile support is useful for barcode scanning.
- N7. CSV/spreadsheet import/export should use explicit column names and date/currency formats.
- N8. System should show sync errors clearly and allow retry.
- N9. System should avoid duplicate sales/order import by enforcing channel order ids.
- N10. System should record timezone for all financial dates.

## MVP Acceptance Criteria

- Create product with images, category, barcode, stock, pricing, and terms.
- Scan barcode to find product and create an on-site sale.
- Import Shopee order list and order details into a sales table.
- Link a local variant to a Shopee item/model.
- Calculate profit for online and on-site sales.
- Export sales and finance records.
