# Roadmap

Strategy: build the **local-first** back office (catalog, barcode, inventory, pricing, offline POS,
finance) before any live Shopee writes, then connect Shopee as a gated phase. See
[DECISIONS.md](DECISIONS.md).

> **Where we actually are (2026-06-24):** Phases 0–1 done; Phases 2 & 4 (catalog + pricing/finance)
> largely built in the admin app; Phase 3 (POS/inventory) partial; Phase 5 (Shopee) still gated.
> The authoritative as-built status + next steps is [STATE_OF_THE_BUILD.md](STATE_OF_THE_BUILD.md).

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
- `packages/db` D1 schema via hand-written SQL migrations ✅
- Stock-ledger **Durable Object** + idempotent `/sync` ✅
- Bindings provisioned: D1 + KV ✅ · custom domain `api.homeseeker.me` ✅ · CI + auto-deploy ✅
- _Remaining:_ **Cloudflare Access** secrets + staff RBAC wiring (stubs in `apps/api/src/auth.ts`);
  Queues for Shopee (commented in `wrangler.jsonc`).

## Phase 2 — Product Catalog MVP ✅ (largely built)

Product list; add/edit; type/brand/usage; image upload; barcode management (existing-first);
Google Sheets/CSV product import — **built**. Vehicle fitment (brand→model/era) + per-model service
notes added on top. _Remaining:_ real product **variants** (one implicit variant today); Thai terms
**generation + approval** flow (template endpoint exists, per-product generate not built).

## Phase 3 — Inventory & Offline POS 🚧 (partial)

Stock ledger (Durable Object) + barcode lookup + idempotent `/sync` + a POS screen + stock/sales
pages — **built**. _Remaining:_ harden the offline outbox/PWA reliability; wire RBAC on routes;
  multi-location. (`audit_logs` table + mutation writes — migration `0016`.)

## Phase 4 — Pricing & Finance ✅ (largely built)

Pricing profiles (cost, B2B/B2C/online prices, commission, tax-on-cost); per-product VAT; profit
math; campaign what-if workspace; sales table + refunds; finance summary; CSV export — **built**.
_Remaining:_ surface all four cost methods in the UI; richer accountant export.

## Phase 5 — Shopee Integration (gated)

_Unlocks once Open API access is confirmed._ Authorization + token refresh; shop info import;
product/listing import; local↔Shopee item/model mapping; order import (CSV → API); stock update
queue. CSV bridge serves order import/stock export until then.

## Phase 6 — Production Hardening

Error monitoring; backups (private R2 `BACKUPS` binding prepared); access-control review; data
export/import; sync retry dashboard; deployment automation; PWA/offline reliability testing.

**Gated-phase prep index:** [NEXT_PHASE_PREP.md](NEXT_PHASE_PREP.md).

## Suggested First Development Slice

Local product → barcode → inventory → pricing core → offline on-site sale, all before live Shopee
writes. This lets the business logic be tested safely, then Shopee connects via controlled jobs.
