---
type: plan
title: Shopee integration — SKU strategy, parked Phase 2, reusable assets
description: Channel-2 stock deduction is parked on the owner manually setting Shopee SKUs = Kira product codes; the matcher must be exact-match-or-skip; several finished building blocks already sit in the repo
tags: [shopee, channels, stock, sku, parked]
timestamp: 2026-08-09
status: parked
sources: [stock-full-track-roadmap.md, kira-audit-findings-2026-07.md, packages/core/src/shopee.ts, packages/core/src/orders.ts, apps/api/src/shopee.ts, docs/SHOPEE_INTEGRATION.md]
---

# Shopee integration strategy

## Phase 2 (stock deduction from order exports) — PARKED, and why

The Shopee `Order.completed` export HAS per-item line rows + Quantity, BUT the เลขอ้างอิง SKU (reference SKU) + Parent SKU columns are **empty** and there is no Product ID/GTIN column — lines are identified only by marketing Product Name + Variation, so there is **no stable key**. Text-matching would corrupt stock → **do NOT build guessy matching.**

**The clean key:** Kira sets each default variant's `sku = product_ref` (e.g. `88310-0K080`), and the owner sets Shopee listing SKUs to the Kira code — then order-export SKU === `variant.sku`, 1:1.

Shopee SKU-box rule (owner): a single-product post exposes only Parent SKU → the Kira code goes there; a multi-product post exposes per-variation SKU + Parent SKU → each variation gets its Kira code. That is why `matchLineVariant` tries variation SKU first, then Parent SKU (committed `694c64a` with `normalizeSku` trim+upper and `planOnlineDeductions` matched→deduct / unmatched→flag).

The owner **declined** auto-generating the filled-SKU file via GTIN↔barcode matching — SKUs will be set **manually**, keeping Kira's categorization as source of truth. Because entry is manual, the matcher must be **tolerant** (trim + case-insensitive) and **safe** (exact-match-or-skip; unmatched flagged, never guessed); a product only deducts if it exists in Kira with that code.

**Sequencing:** owner sets SKUs on a batch → sends a fresh export with SKUs populated → THEN build `sales_order_lines` + DO deduction as channel-tagged `online_sale` ledger rows (that movement type is defined but never produced today). Until then, the manual bridge is the [dashboard Shopee worklist](dashboard-shortcuts.md).

Phase 3 (AirPlus channel): `'airplus'` is not in the schema channel enum yet. Phase 4: reservations + Shopee push-back.

## Reusable assets already in the repo (from the July 2026 audit)

Don't rebuild these — they exist, tested, mostly just unwired:

1. **`computeShopeeStockUpdates`** (packages/core/src/shopee.ts:18) IS the Channel-2 push planner; it already takes `links: VariantModelLink[]` + `lastSyncedByModel` and waits only for a listing table.
2. **`shopeeSign` / `buildShopeeRequest`** (apps/api/src/shopee.ts) = correct Shopee v2 API signing, unreachable only because index.ts never imports `./shopee`. The owner chose API push → this goes live when Phase 2+ lands.
3. **`normalizeSku` / `matchLineVariant` / `planOnlineDeductions`** (packages/core/src/orders.ts:86,95,110) — pure, tested, orphaned; the ingest half of `sales_order_lines`.

(The same audit's fourth finding — Scan→POS wiring is ~20 lines because `reopenDraft`/`saveDraftToDb` already do the work — shipped as the /scan POS mode; the residual pos/page.tsx traps are recorded in [onsite-pos](onsite-pos.md).)

## References

- [stock-full-track](stock-full-track.md) — the ledger these deductions would write into
- [dashboard-shortcuts](dashboard-shortcuts.md) — interim manual sync surface
- Business context (fees, vs-Shopee case): [commerce](../commerce/index.md)
- Repo docs: docs/SHOPEE_INTEGRATION.md, docs/SHOPEE_PRODUCT_EDITOR.md
