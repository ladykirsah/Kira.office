# Barcode And Inventory

## Goal

Use barcode scanning to make stock lookup, stock movement, and **offline-first** on-site selling
fast and reliable. Most products already carry EAN/UPC barcodes.

## Barcode Input

- **USB scanner** (keyboard emulation): reliable baseline; a focused scan field submits on Enter.
- **Camera**: supported where the browser allows; not the baseline.
- **Manual entry**: fallback for damaged labels or scanner failure.

## Barcode Rules

- Each sellable variant has **one primary barcode**.
- Use the product's **existing EAN/UPC**; generate an **internal barcode only when none exists**
  (`barcodes.is_internal_generated = true`).
- Extra barcodes allowed for supplier codes, old labels, alternate packaging.
- Barcode changes are audit-logged.

## Stock Concepts

- **Stock on hand** — physical units owned.
- **Reserved** — units held for pending orders/holds.
- **Available** — on hand − reserved.
- **Shopee published** — quantity sent to Shopee (later phase).
- **Reorder threshold** — optional low-stock alert level.

## Stock Ledger Movement Types

Opening balance · purchase receipt · manual adjustment · on-site sale · online (Shopee) sale ·
refund return · damaged/lost · transfer between locations · reconciliation correction.

Stock is the **sum of ledger deltas** (never an overwritten number), so concurrent on-site and
online sales add up correctly.

## Offline-First On-Site Sale Flow

1. POS loads catalog + price + stock snapshot from the **local on-device store**.
2. Staff scans a barcode (USB / camera / manual).
3. System finds the variant, shows price and local stock.
4. Staff confirms quantity; system computes subtotal, discount, VAT, total (THB).
5. Staff selects payment method (Cash / PromptPay).
6. Sale completes **offline** with a **client-generated id**; recorded locally + queued.
7. On reconnect, the sync engine upserts the sale (idempotent), appends the stock ledger delta,
   and posts the financial record.
8. If linked to Shopee (later), a stock-sync job is queued.

## Stock Sync Rules

- Never update Shopee stock without a local **stock ledger entry** first.
- Queue sync jobs so failed Shopee calls retry.
- Show local stock, available stock, and last-synced Shopee stock separately.
- Block negative available stock by default; **owner** can approve an oversell override (recorded).
- On sync, surface conflicts (oversell, externally-changed stock) for review.

## Reports

Current stock by product/location · low-stock · stock movement history · on-site deductions ·
online (Shopee) deductions · unsynced/failed Shopee stock updates · unsynced offline sales.
