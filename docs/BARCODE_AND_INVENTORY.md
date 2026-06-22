# Barcode And Inventory

## Goal

Use barcode scanning to make stock lookup, stock movement, and on-site selling fast and reliable.

## Barcode Input Types

### USB Scanner

Most USB barcode scanners behave like a keyboard. The admin UI should support a focused scan field that accepts barcode input and submits on Enter.

### Camera Scanner

The web app can support camera scanning on compatible devices. Browser support varies, so USB scanner support should remain the reliable baseline.

### Manual Entry

Manual barcode entry should exist as a fallback for damaged labels or scanner failure.

## Barcode Rules

- Each sellable product variant should have one primary barcode.
- Additional barcodes can be added for supplier codes, old labels, or alternate packaging.
- Internal barcodes can be generated if products do not already have EAN/UPC codes.
- Barcode changes should be audit logged.

## Stock Concepts

- Stock on hand: physical units owned.
- Reserved stock: units reserved for pending orders or holds.
- Available stock: stock on hand minus reserved stock.
- Shopee published stock: quantity currently shown/sent to Shopee.
- Reorder threshold: optional alert level for low stock.

## Stock Ledger Movement Types

- Opening balance.
- Purchase receipt.
- Manual adjustment.
- On-site sale.
- Shopee sale.
- Refund return.
- Damaged/lost stock.
- Transfer between locations.
- Reconciliation correction.

## On-Site Sale Flow

1. Staff opens on-site sale screen.
2. Staff scans barcode.
3. System finds product variant and shows price/stock.
4. Staff confirms quantity.
5. System calculates subtotal, discount, tax, and total.
6. Staff selects payment method.
7. System completes sale.
8. System creates sale record, financial record, and stock ledger entry.
9. If linked to Shopee, system queues Shopee stock sync.

## Stock Sync Rules

- Never update Shopee stock directly without a local stock ledger entry.
- Queue sync jobs so failed Shopee calls can be retried.
- Show local stock, available stock, and last synced Shopee stock separately.
- Prevent negative available stock by default.
- Owner can approve negative-stock override only if the business wants oversell behavior.

## Reports Needed

- Current stock by product and location.
- Low-stock products.
- Stock movement history.
- On-site sale stock deductions.
- Shopee sale stock deductions.
- Unsynced or failed Shopee stock updates.
