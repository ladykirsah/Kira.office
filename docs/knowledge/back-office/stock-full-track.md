---
type: invariant
title: Stock full-track — ledger, holds model, DO serialization, /scan
description: on_hand = SUM(quantity_delta) over stock_ledger_entries via a single-writer DO; holds are negative-delta ledger movements (the design that avoids the reservation trap); /scan 5 modes live; one branch remains BLOCKED
tags: [stock, ledger, holds, durable-object, scan, invariants]
timestamp: 2026-08-09
status: live
sources: [stock-full-track-roadmap.md, scan-here-flow-spec.md, kira-restructure-brief-2026-07.md, docs/SCAN_HERE_SPEC.md, packages/core/src/stockHold.ts]
---

# Stock full-track

## Foundation

- **On-hand = `SUM(quantity_delta)` over `stock_ledger_entries` — never `quantity_after`.** The ledger + a single-writer **StockLedger Durable Object** is the "full-track" foundation. Ledger write template: `applyAdjustmentToDb` (apps/api/src/index.ts ~1514: read SUM → guard → INSERT with quantity_after); DO methods delegate to `apply*ToDb(env.DB, …)`.
- Only on-site POS deducts stock today (the Shopee `online_sale` movement type is defined but never produced — see [shopee-integration-strategy](shopee-integration-strategy.md)).
- Phase 1 (`9e07802`): /stock admin page with global `LOW_STOCK_THRESHOLD = 3` in apps/admin/src/lib/stock.ts (owner declined per-product thresholds); fixed refund restock writing off-enum `"refund"` → schema `"refund_return"` — `movementLabel()` maps BOTH so old rows still read.
- Phase 1.5 (`8c7af78`): adjust bar Receive(+)/Write-off(−)/Correct-to via pure `planAdjustment(action, amount, current)`.
- Phase 1.6 IA split (`eecae12`, owner-approved "state vs flow"): **Products page owns STATE** (browse/current stock — Stock column, Out-of-stock tab, Low-stock tab); **/stock, renamed "Stock movements", owns FLOW** (adjust bar + movement-history log only). Rule for the future: current on-hand per product = Products page; stock operations + audit trail = Stock movements page — do NOT reintroduce a per-variant on-hand table on the movements page.
- Cleanup verified: dead tables `inventory_snapshots`/`cost_layers`/`sync_jobs` dropped (migration 0024); `stock_ledger_entries.movement_type` CHECK exists (migration 0026, includes receive/write_off/correction).

### PR #21 stock-write-path hardening (main)

- Stocktake lost-update fixed: the client now sends the **absolute counted number** and the server derives the delta inside the write path (receive/write_off stay deltas).
- The products/new `initial_stock` movement type that no CHECK vocabulary allowed (it silently wrote no ledger row) is now `opening_balance`.
- `packages/db/src/schema.ts` + drizzle-orm were **deleted** — nothing imports `@l-shopee/db`; **the migration files are the schema source of truth** (verified: packages/db/src no longer exists).
- `/stock/adjust` has **NO idempotency key** — flagged, deliberately not fixed: a retried re-fill on shop wifi double-counts. The `countedOnHand` stocktake path is naturally idempotent; `quantityDelta` is not.
- `BACKUP_TABLES` (apps/api/src/index.ts) has bidirectional drift tests derived from the **migration files**; `runDailyBackup` has no try/catch, so one bad table name kills the whole dump.

## Holds = negative-delta ledger movements (the design that avoids the reservation trap)

The availability audit (2026-07-24) found **no shared choke point**: availability is inline `SUM(quantity_delta)` in ~18 places (~10 storefront in-stock/onHand, ~8 API oversell guards + products list/detail + stock adjust), none filtering by movement_type.

**Decision:** a take-away = a `hold` ledger entry with delta **−qty**; bring-back = `unhold` with **+qty**. Then `SUM(quantity_delta)` in all 18 queries — unchanged — automatically equals **sellable** stock (held excluded): no query edits, no oversell trap. Held quantity is a display-only query: `−SUM(delta WHERE movement_type IN ('hold','unhold'))`.

**"On hold" is a stock BUCKET, not a reservation** — the reservation model is the trap that sank the abandoned branch (below). Migration `0062_stock_hold_movement_types.sql` rebuilt the movement_type CHECK to allow hold/unhold (9 existing ledger rows preserved). Spec: docs/SCAN_HERE_SPEC.md.

### The blocked branch: `claude/kira-office-tasks-b9b9c5` — must NOT merge

That branch built the other model: a holds table where holds write **no** ledger row and never call the DO, with `stockAvailableSql(alias)` (`available = on_hand − held(open holds)`) as a shared SQL fragment wired into all 9 storefront stock reads in apps/storefront/src/lib/db.ts, the checkout gate, and the DO deduction `applyOnlineSaleToDb` (oversell guard on available; quantity_after stays on_hand-based). Its one deliberate asymmetry was sound: onsite `applySyncToDb` still sells on on_hand — a mechanic sells what they carried to the job (the "used" flow) — correct for on-site, wrong only for online.

The branch carries **3 critical holds bugs** and is BLOCKED from merging (see the memory `kira-onsite-branch-holds-bugs.md`). The shipped negative-delta design auto-fixes those bug classes by construction. **Verified 2026-08-09: `stockAvailableSql` exists ONLY on that branch (commits `837408e`, `961e129`) — it is NOT in main.** Anyone reading the restructure-brief memory should treat its stockAvailableSql description as the blocked branch's design, not current behaviour.

## StockLedger DO — TOCTOU fixed with `blockConcurrencyWhile`

A 12-agent adversarial review of the On-hold work found and fixed (commit `d08c921`):

1. The StockLedger DO **never actually serialized** its D1 read-then-write — a documented TOCTOU (docs/CLOUDFLARE_ARCHITECTURE.md) that also affected sales/adjustments. Fixed with `blockConcurrencyWhile` on **all 5 mutating DO methods**. **Anyone touching the DO's mutation path must preserve this serialization.**
2. A physical stocktake typed into "Stock on hand" (= sellable) could re-inflate sellable → oversell, because held stock was invisible on stock-editing screens — held is now shown there and the field is labelled sellable.
3. Raw hold/unhold movement labels were exposed — now humanized.

## /scan "Scan here" — all 5 modes + camera LIVE since 2026-07-26

(The old spec frontmatter said "NOT deployed"; the body supersedes it.) PR #61 merged (main @ `b9dd364`), migration 0062 applied to prod, API (`kiraoffice`) + admin (`kiraoffice-admin` @ `e1c05c21`) redeployed 2026-07-26 — live behind Access at admin.airplusauto.com; storefront untouched.

- /scan sidebar page (Catalog › Scan here); input = handheld keyboard-wedge + camera on every mode.
- **Add** → `/products/new?ref=CODE`.
- **View** → `lookupBarcode` → `/products/[id]` (read-only product view extracted into shared products/ProductView.tsx so the edit-page view mode never drifts).
- **On hold** via `planHoldMovement` (packages/core/src/stockHold.ts) + `applyHoldToDb` / DO `applyHold` / `POST /stock/hold`; held shown on ProductView + products table + inline StockCell + edit page; takeAway defaults to 1 per spec.
- **Fill stock** = `adjustStock({movementType:"receive"})` per line.
- **POS mode** = priced list → Create bill parks a draft + opens `/pos?draft=<id>` (mount effect reuses `reopenDraft`, no cart clobber) — see [onsite-pos](onsite-pos.md).
- **Camera** = scan/CameraScanner.tsx via `@zxing/browser` (dynamic import, back camera, debounced), 📷 toggle on shared ScanInput — the only new dependency.
- Known dead code: a parallel session's uncommitted RED-phase `finalizeParkedDraft` stub in apps/admin/src/lib/checkout.ts shipped as harmless dead code (exported, never called).

## References

- [onsite-pos](onsite-pos.md) — the only stock-deducting sale path today
- [shopee-integration-strategy](shopee-integration-strategy.md) — parked Channel-2 deduction
- [dashboard-shortcuts](dashboard-shortcuts.md) — the Shopee stock worklist that bridges the gap manually
- Platform (D1, Durable Objects, backups): [platform](../platform/index.md)
