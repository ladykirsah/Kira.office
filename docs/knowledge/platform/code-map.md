---
type: guide
title: Monorepo layout, code architecture, and locked platform decisions
description: Workspace map, the channel model as first-class code+DB constraint, the StockLedger-is-stateless truth (and the docs that lie about it), and the owner's 2026-07-16 locked decisions
tags: [monorepo, workspaces, channels, durable-objects, architecture, plans]
timestamp: 2026-08-09
status: live
sources: [package.json, "kira-office-architecture.md", "kira-audit-findings-2026-07.md", "kira-restructure-brief-2026-07.md"]
---

# Monorepo layout, code architecture, and locked platform decisions

## Workspace map

npm workspaces monorepo, root package `kira-office` (Node >= 22). Workspace package prefix is `@l-shopee/*` (historical name — the project began as a Shopee-seller back office).

```
apps/
  api/         → Worker `kiraoffice` (entry apps/api/src/index.ts; config = ROOT wrangler.jsonc)
  admin/       → Worker `kiraoffice-admin` (@l-shopee/admin, OpenNext)
  storefront/  → Worker `airplus-storefront` (@l-shopee/storefront, OpenNext)
packages/
  core/        → shared domain logic (e.g. src/channels.ts)
  db/          → migrations (packages/db/migrations = the real schema; the old schema.ts draft is deleted — see below)
docs/          → architecture docs, several known-stale (see below); staleness map in ../conventions/index.md (docs-map)
```

Root scripts: `test` (vitest run), `typecheck` (tsc per app), `lint` (**prettier --check** + eslint via `lint:es` — CI's "build" is the prettier check, so run `npm run lint` before pushing, not just tsc), `deploy` / `deploy:staging` / `deploy:dry` (wrangler). Engineering rules and the lint-before-push lesson: [conventions](../conventions/index.md); CI contract: [operations](../operations/index.md).

## The channel model is first-class (code + DB CHECKs)

Kira.office is the back office for a car air-conditioning parts + service business with 4 channels:

1. **onsite** = Den Air Service (B2C + B2B pricing).
2. **shopee** = shop "AC on Sales" (~30% commission; full conversion detail stays external in Shopee Seller Centre — Kira holds only the order summary, so Shopee profit stays "—" until SKU-linked).
3. **airplus** = the owner's OWN site, no commission, single-seller greenfield where Kira IS the backend — full conversion detail lives in Kira and AirPlus profit is REAL.
4. **affiliate** = income only, no stock; kept as its own labeled line OUT of product revenue/profit (it's commission — mixing would fake margins); may roll into a top total-income figure.

Canonical code: `CHANNELS = onsite | shopee | airplus | affiliate` in `packages/core/src/channels.ts` (+ `ORDER_CHANNELS = shopee | airplus`, `isChannel`). DB enforcement: migration 0025 hard CHECKs `sales_orders.channel ∈ {shopee, airplus}` and `financial_records.channel ∈ all 4`. The stock ledger stays **channel-free** — channel is encoded by `movement_type` (`onsite_sale` / `online_sale`); migration 0026 added a CHECK on `stock_ledger_entries.movement_type`.

UI conventions riding on this: AirPlus admin status badge colours are deliberately SWAPPED vs Shopee (Done=green / Shipping=yellow / Refund=GRAY / Cancelled=RED). Products carry ≤10 images, brand/system/name, car-fitment note, transport weight, Shopee+AirPlus IDs, Product ID + barcode (auto-generated from ID when absent), cost + per-channel selling prices (on-site B2C, on-site B2B, Shopee, AirPlus), per-online-channel commission-rate input, per-product 7% VAT toggle, and a campaign-price calculator. Product/catalog details: [back-office](../back-office/index.md); money semantics: [commerce](../commerce/index.md).

## The StockLedger DO: stateless facade at the July audit — a REAL single writer since d08c921

At the expensive 2026-07-16 six-reader audit (1.36M tokens — do not redo casually; verify claims before acting, the code moves) the `StockLedger` Durable Object was a stateless 3-method RPC facade — no storage, no `blockConcurrencyWhile` — so at that moment any "single-writer invariant" was an illusion. **That changed on 2026-07-26 (`d08c921`)**: every method (now five — `applySync`, `applyOnlineSale`, `applyAdjustment`, `applyHold`, `refundSale`) wraps its work in `this.ctx.blockConcurrencyWhile(...)` on the single `idFromName('default')` instance. The serialized single writer is now real, and designs may rely on it. It still holds no durable state — D1 stays the source of truth.

The audit's four "known-lying docs" have all since been corrected (`CLOUDFLARE_ARCHITECTURE.md`'s as-built DO section is now accurate; `MODULE_CORE_LOGIC.md`, `SCHEMA_AS_BUILT.md`, `DATA_MODEL.md` record the drops). The two that still carry the outdated **does-not-serialize** warning today are `docs/HARDENING.md` and `docs/MODULE_POS_AND_SYNC.md` — distrust those two lines, not the four fixed docs ([docs-map](../conventions/docs-map.md)).

Related: `packages/db/src/schema.ts` (a self-declared DRAFT that nothing imported) has been deleted — the migration files are the schema truth ([d1-and-migrations](d1-and-migrations.md)).

## The owner's locked decisions (2026-07-16 re-brief — supersedes older roadmaps)

Platform-shaping decisions locked by the owner; status = plan except where noted:

1. **Holds display:** a mechanic taking 2 of 5 shows "Stock 3 · On hold 2".
2. **Van stock is NOT sellable online** until returned → `available = on_hand − held` is what Shopee/AirPlus see; the owner accepted that a busy field day can drop online stock to 0 on hot parts.
3. **Shopee = real Open API push** (NOT a CSV bridge) → the owner must register a Shopee Open API partner account; keep `shop_connections` (do NOT cut); `apps/api/src/shopee.ts` v2 signing goes live; Env needs `PARTNER_ID` / `PARTNER_KEY` / `SHOP_ID` / `ACCESS_TOKEN` + OAuth refresh.
4. **AirPlus = Kira Live** — the storefront calls Kira directly; the `online_sale` movement type has a writer via `applyOnlineSale`; oversell is preventable. (Built — see [storefront-architecture](storefront-architecture.md).)
5. **Affiliate products = SEPARATE table** (tracking link + image only; no stock/cost/price); commission recording = super low priority.
6. **Staff = NO login**; a dropdown picks a person; staff is a personnel table SEPARATE from `users` (auth); 3 roles later (Super admin / Admin / Mechanic), planned LAST. — **HISTORICAL: superseded.** Real per-staff password/PIN logins were later built (see the Aug 2026 lockout work in [auth](../auth/index.md)); treat "no login" as a snapshot of July intent only.
7. **Purchase orders = just a number** ("20 on the way"); real PO (dealer/cost/dates/partials) + credit terms = version 2.
8. **AirPlus users and on-site plate-keyed customers stay SEPARATE** (AirPlus has no plates, no service).
9. **Marketing centre** must support: discount % AND THB, flash sale with time window, bundles, free shipping, coupon codes.

## References

- Worker configs: [three-workers](three-workers.md)
- Stock/holds work and the blocked reservation branch: [back-office](../back-office/index.md)
