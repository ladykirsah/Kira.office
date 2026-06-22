# Roadmap

Strategy: build the **local-first** back office (catalog, barcode, inventory, pricing, offline POS,
finance) before any live Shopee writes, then connect Shopee as a gated phase. See
[DECISIONS.md](DECISIONS.md).

## Phase 0 — Requirement Lock ✅ (done)

- Open questions answered; stack confirmed (Next.js/TS).
- TH region, THB, VAT 7%, cost methods, offline-first, Thai T&Cs, private repo confirmed.
- Shopee approach set (local-first + CSV bridge; API gated on managed-seller eligibility).
- _Remaining:_ resolve GitHub push target (account mismatch — see GITHUB_CHECKLIST.md).

> **Production launch plan:** [PRODUCTION_LAUNCH.md](PRODUCTION_LAUNCH.md). API is **live** at
> `https://api.homeseeker.me` (D1-backed), auto-deployed from `main`.

## Phase 1 — Foundation ✅ (mostly done)

- Monorepo scaffold (npm workspaces) ✅
- `packages/core` — full domain logic, test-first (100+ tests) ✅
- `apps/api` Cloudflare Worker live (`/health`, `/pricing/preview`, `/products`, `/sync`) ✅
- `packages/db` Drizzle schema → D1 migration applied (16 tables) ✅
- Stock-ledger **Durable Object** + idempotent `/sync` ✅
- Bindings provisioned: D1 + KV ✅ · custom domain `api.homeseeker.me` ✅ · CI + auto-deploy ✅
- _Remaining:_ `apps/admin` (Next.js UI), **Cloudflare Access** auth + audit log, R2 (images), Queues.

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
