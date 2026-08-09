---
type: app
title: AirPlus storefront architecture
description: Own Worker, shared D1/KV, StockLedger DO cross-bind, force-dynamic rendering, and bundled image assets
tags: [storefront, workers, d1, kv, durable-objects, opennext, rendering]
timestamp: 2026-08-09
status: live
sources: [airplus-storefront-built.md, apps/storefront]
---

# AirPlus storefront architecture

## What it is

`apps/storefront` is the customer-facing shop at airplusauto.com — Next 15 / React 19 built with OpenNext onto its OWN Cloudflare Worker, containing zero admin routes. It runs on the GoGoCash Cloudflare account, the same account as `apps/api` — this matters because **bindings do not cross accounts** (the admin app learned this as an error-1003 lesson). See [platform](../platform/index.md) for the full deployable/account layout and [operations](../operations/index.md) for the deploy job history (the storefront famously had NO deploy job until 4 Aug 2026).

## How it works

- **Data**: binds the SAME D1 + KV as the API directly, using the repo's raw-SQL convention. Cross-binds the **StockLedger Durable Object via `script_name`**. Trap: a named env (`staging`) must repeat `script_name` explicitly — it is NOT inherited from the top level.
- **Schema**: migrations 0036–0040 created `sales_order_lines`, `storefront_customers` (PHONE-keyed, deliberately separate from the plate-keyed `customers` table used by the workshop side), `addresses`, and nullable FK links on `sales_orders` + `payments`; the same pass backfilled the missing `payments` table into `schema.ts` (which, per the audit, is NOT the source of truth — see [operations](../operations/index.md)).
- **Rendering**: `force-dynamic` on all D1-reading pages. A known platform trap applies: `"use client"` pages ignore `export const dynamic` — force it via a server `layout.tsx` (see [platform](../platform/index.md)).
- **Checkout stock deduction**: `applyOnlineSaleToDb` + DO method `applyOnlineSale` (TDD): idempotent on order id, all-or-nothing, `movement_type 'online_sale'`, `source_type 'sales_order'`. Checkout calls it **FAIL-OPEN** so an unpaid order survives infra blips (conflicts are logged). Oversell is fail-closed with Thai product-named error messages. Verified at build time: checkout idempotency, oversell handling, real profit recorded. Order lifecycle and money model live in [commerce](../commerce/index.md).
- **Slip upload**: jsQR decodes the payment-slip QR CLIENT-side; `POST /api/payments/slip` authenticates by ref+phone. Slip review/approval gating is admin-side, see [commerce](../commerce/index.md).

## Image assets: bundled, not R2

The demo R2 image objects never existed (they caused console 404s + hydration issues). The accepted convention:

- `imgUrl()` passes **leading-slash keys straight through**, so `banners.image_key` values like `/banners/hero-1.png` resolve to `apps/storefront/public/banners/*` — deployed WITH the worker, not fetched from R2.
- Car-brand tiles likewise use bundled `public/brands/{toyota,honda,isuzu}.png` keyed by `CAR_BRAND_LOGO` in code (no D1/R2 involvement).
- Products and affiliate tools without images render the ✦ placeholder star (see [brand-ci-design-system](brand-ci-design-system.md)).

## Invariants & traps

- Never add admin routes here; the storefront Worker is public.
- `script_name` for the StockLedger DO must be repeated in every named env.
- Keep `force-dynamic` on D1-reading pages; there is no cache to bust by design (the affiliate /tools page and others rely on this).

## References

- `apps/storefront/` (branch of origin: `claude/airplus-car-parts-site-7ef223`)
- Related: [checkout-and-addresses](checkout-and-addresses.md), [seo-and-agent-discovery](seo-and-agent-discovery.md)
