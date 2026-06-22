# Roadmap

Strategy: build the **local-first** back office (catalog, barcode, inventory, pricing, offline POS,
finance) before any live Shopee writes, then connect Shopee as a gated phase. See
[DECISIONS.md](DECISIONS.md).

## Phase 0 — Requirement Lock ✅ (done)

- Open questions answered; stack confirmed (Next.js/TS).
- TH region, THB, VAT 7%, cost methods, offline-first, Thai T&Cs, private repo confirmed.
- Shopee approach set (local-first + CSV bridge; API gated on managed-seller eligibility).
- _Remaining:_ resolve GitHub push target (account mismatch — see GITHUB_CHECKLIST.md).

## Phase 1 — Foundation (in progress)

- Monorepo scaffold (npm workspaces) ✅
- `packages/core` pricing/profit/tax/cost engine, test-first ✅ (grow coverage next)
- Initialize `apps/admin` (Next.js on Workers via OpenNext) and `apps/api` (Worker) with `create-cloudflare`.
- `packages/db` Drizzle schema → first D1 migration (`wrangler d1 migrations apply`); `wrangler dev` local.
- Stock-ledger **Durable Object** + idempotent `/sync` endpoint.
- Auth via **Cloudflare Access** + app roles + append-only audit log.
- Provision bindings (D1, R2, KV, Queues) per environment; CI (typecheck, lint, test) ✅ + `wrangler deploy`.

## Phase 2 — Product Catalog MVP

Product list; add/edit; type/brand/usage; variants; image upload; barcode management
(existing-first); Thai terms pattern generation + approval; Google Sheets/CSV product import.

## Phase 3 — Inventory & Offline POS

Stock ledger; inventory snapshots; barcode lookup; **offline-first** on-site sale screen with
local store + sync engine; payment capture (Cash/PromptPay); stock deduction + audit logs.

## Phase 4 — Pricing & Finance

Cost/pricing profiles (all four cost methods); tax (per-product incl/excl) and Shopee fee profiles;
profit preview; sales table; finance summary (incl. VAT); CSV/spreadsheet export for accountant.

## Phase 5 — Shopee Integration (gated)

_Unlocks once Open API access is confirmed._ Authorization + token refresh; shop info import;
product/listing import; local↔Shopee item/model mapping; order import (CSV → API); stock update
queue. CSV bridge serves order import/stock export until then.

## Phase 6 — Production Hardening

Error monitoring; backups; access-control review; data export/import; sync retry dashboard;
deployment automation; PWA/offline reliability testing.

## Suggested First Development Slice

Local product → barcode → inventory → pricing core → offline on-site sale, all before live Shopee
writes. This lets the business logic be tested safely, then Shopee connects via controlled jobs.
