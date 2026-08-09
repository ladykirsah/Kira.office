---
type: invariant
title: Products — soft delete and atomic save
description: Delete = archived (every list must filter it); Add/Edit product saves atomically via one D1 batch with recover-on-existing-ref
tags: [products, soft-delete, atomic-save, d1, admin]
timestamp: 2026-08-09
status: live
sources: [kira-soft-delete-invariant.md, kira-product-save-atomic.md, apps/api/src/index.ts, apps/admin/src/lib/newProduct.ts]
---

# Products — soft delete and atomic save

## Soft-delete invariant

Product delete is a soft delete: `archiveProduct` only runs `UPDATE products SET status='archived'` (apps/api/src/index.ts). Variants, barcodes, and ledger rows all survive.

**Invariant: every admin list/lookup query MUST filter `status <> 'archived'`** or deleted products reappear — and on scan/stock paths they can be **re-sold**. `lookupBarcode` was the HIGH/money instance: scanning a deleted part added it to a POS bill at ฿0 and decremented stock on sync.

Fixed on branch `claude/kira-office-deletion-bugs-ab6da3` (26 Jul 2026), each TDD'd:

- `listProducts` (`GET /products` — also feeds the POS picker and the Barcodes page)
- `lookupBarcode` (`GET /products/by-barcode/:code`)
- `listStock` + `listStockMovements` (`GET /stock`, `/stock/movements`)

**Deliberate exceptions — do NOT add the filter:**

- `checkIdentifier` (`GET /products/identifier-check`) intentionally matches ANY status for duplicate detection; a test asserts this.
- `getProductDetail` returns archived rows because the edit page is the only latent restore path.

### No restore UI (open)

Archived products are hidden from every list and there is **no restore UI**: `productStatusTag` has no `archived` case, and ActionsMenu's disabled "Archived" branch is dead code. DeleteProductCard copy was corrected to drop the false "restore from the products list" promise. Current behaviour is hide-forever except via direct edit-page access; a restore feature must be built deliberately if ever wanted.

## Atomic save — `saveFullProduct` / `POST /products/full`

Root cause of the "filled everything → couldn't save → data gone" bug: the Add-product page saved via a chain of SEPARATE requests (`createProduct` → `updateProduct` → `setProductPricing` → `adjustStock`), each committing independently. A transient R2/KV 500 mid-chain left a bare skeleton and lost the rich form data; retry dead-ended because `ensureProduct` saw the Product ID already existed → permanent "Could not create" loop.

Fix (26 Jul 2026; owner chose "atomic + recover"):

- `saveFullProduct(db, input)` writes product row + variant + barcode + pricing + fitments in **ONE `db.batch`** — D1 rolls back the whole batch on failure.
- **Idempotent on `product_ref`**: an existing Product ID is filled via UPDATE, not rejected (the recovery path).
- Exposed at `POST /products/full` (201 created / 200 recovered), registered **BEFORE** the `/products/:id` matcher so `full` isn't parsed as an id.
- Serves BOTH pages: no id = Add (create-or-recover by product_ref); with id = Edit (updates that row, can rename the Product ID — a taken ref hits UNIQUE → the whole batch rolls back, no partial write).
- **Stock is NOT in the batch** — it is serialized through the StockLedger Durable Object and applied AFTER the atomic save, so a stock hiccup can't lose product data. Photos also upload after (R2). See [stock-full-track](stock-full-track.md).

Add-page UX: auto-saves a draft in the background (debounced 1.5 s, `status:'draft'`). `shouldAutosaveDraft` (apps/admin/src/lib/newProduct.ts) gates it — required fields present, changed since last save, and the first save won't clobber an in-use Product ID; after the first save it saves by captured id (rename-safe). Buttons = Close + Publish. The **Edit** page keeps its explicit manual Save — auto-saving a live product per keystroke is riskier.

## References

- Parked content features shaping `products.name`/`description`: [product-content-patterns](product-content-patterns.md)
- Deletion-audit siblings (POS ghost draft, attribute delete): [onsite-pos](onsite-pos.md), [taxonomy-and-attributes](taxonomy-and-attributes.md)
- D1/DO platform details: [platform](../platform/index.md)
