---
type: feature
title: Dashboard — order summary frame + Shopee stock worklist
description: First slice of the dashboard-notifications plan (PRs #111/#113, migration 0080): four order cards with live counts, and a manual Shopee restock worklist
tags: [dashboard, orders, shopee, worklist, admin]
timestamp: 2026-08-09
status: live
sources: [kira-dashboard-notifications-plan.md, apps/admin/src/lib/orderSummaryCards.ts, packages/db/migrations/0080_shopee_synced_at.sql]
---

# Dashboard — order frame + Shopee worklist

Both halves went live on prod 2 Aug 2026 as the first slice of the dashboard notifications + shortcuts plan (surface action stages on the dashboard with brief, reusable building blocks).

## Order frame (PR #111, squash `cbefc5d`)

The four `ORDER_SUMMARY_CARDS` (Pending · To ship · In transit · Refund) duplicated onto the dashboard above the nav grid, with live AirPlus counts, linking to filtered /orders via `?card=`.

- The server passes `initialCardKey` from Next 15 `searchParams` — **no `useSearchParams`; repo convention.**
- Helpers in apps/admin/src/lib/orderSummaryCards.ts (`summaryCardCounts` / `summaryCardHref` / `summaryCardFromKey`); shared `summaryCardStyles.ts` so the two frames (dashboard + /orders) can't drift.
- The dashboard is force-dynamic and degrades to a quiet line on API error.

## Shopee stock worklist (PR #113, squash `5741e9a`; migration 0080)

**Why it exists:** Shopee stock is NOT auto-linked (Phase 2 parked — [shopee-integration-strategy](shopee-integration-strategy.md)), so Kira stock changes leave Shopee listings stale. The worklist tells the owner WHICH products to fix by hand.

- Design A table: Product · Product ID (= Kira `product_ref`; owner: "SKU = Product ID") + CopyButton · Reduce red −N · coral checkbox `accent-color: var(--primary)`. Footer "N of M marked done" + Clear done.
- Persistence: migration 0080 adds `products.shopee_synced_at` (epoch ms).
- `GET /stock/shopee-worklist` = shopee_listed products with a stock movement newer than `shopee_synced_at`, net non-zero, **`online_sale` excluded** (Shopee already decremented itself), on-hand = ledger SUM.
- `POST /stock/shopee-synced` = Clear stamps synced_at so cleared rows drop AND stay dropped.
- First run: existing listed products with history show until Clear-baselined once.
- Limitation: per-PRODUCT (variants summed, not split per Shopee variation).

Deploy sequence used (migrations-before-merge discipline — [operations](../operations/index.md)): merge #111 → apply migration 0080 to prod → rebase #113 onto main → merge #113.

## References

- [stock-full-track](stock-full-track.md) — the ledger the worklist reads
- [airplus-insight](airplus-insight.md) — the analytics half of admin visibility
- Order lifecycle and card semantics: [commerce](../commerce/index.md)
