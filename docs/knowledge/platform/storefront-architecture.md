---
type: app
title: Storefront architecture and rendering rules
description: The AirPlus storefront Worker's design (direct D1/KV/DO bindings, zero admin routes), the force-dynamic rendering invariants, and the anti-dead-end product thesis
tags: [storefront, nextjs, opennext, rendering, force-dynamic, airplus]
timestamp: 2026-08-09
status: live
sources: ["airplus-storefront-built.md", "airplus-client-page-dynamic-rendering.md", "airplus-staging-preview.md", apps/storefront/wrangler.jsonc]
---

# Storefront architecture and rendering rules

## What it is

`apps/storefront` = Next 15 / React 19 / OpenNext on its **own** Worker (`airplus-storefront`) with **zero admin routes**, on the GoGoCash account — same account as `apps/api`, because bindings don't cross accounts (the admin's error-1003 lesson). Built on branch `claude/airplus-car-parts-site-7ef223`; live on `airplusauto.com`.

- Binds the **same** D1 + KV as the API directly (raw-SQL convention, no ORM). KV use is read-only here (`shop:paymentMethods` → PromptPay target for checkout).
- Cross-binds the `StockLedger` DO via `script_name: "kiraoffice"` — a named env (staging) must repeat `script_name` explicitly; it is NOT inherited. See [three-workers](three-workers.md).
- R2 `IMAGES` is used only to store uploaded bank slips under `slip/`, which the back office reads (super-admin-only) via the api Worker's private `/file` route.
- Migrations 0036–0040 created `sales_order_lines`, `storefront_customers` (PHONE-keyed, deliberately separate from the plate-keyed on-site `customers`), `addresses`, and nullable FK links on `sales_orders` + `payments`; they also backfilled the missing `payments` table into schema.ts.
- Checkout stock deduction: `applyOnlineSaleToDb` + DO method `applyOnlineSale` (TDD-built; idempotent on order id, all-or-nothing, `movement_type 'online_sale'`, `source_type 'sales_order'`). Checkout calls it **FAIL-OPEN** so an unpaid order survives infra blips (conflicts logged). Verified at build: checkout idempotency, oversell fail-closed with Thai product-named errors, real profit recorded.
- Slip upload: jsQR decodes the slip QR **client-side**; `POST /api/payments/slip` (auth = ref + phone).

Storefront features, checkout UX, LINE wiring, SEO surfaces: [storefront](../storefront/index.md). Order/payment semantics: [commerce](../commerce/index.md).

## INVARIANT: rendering rules (the 1-year-cache ghost-bundle trap)

**Every D1-reading page MUST `export const dynamic = "force-dynamic"`.** Otherwise `next build` statically prerenders it and dies with `D1_ERROR: no such table` — and `next dev` hides this; only a clean build catches it.

**`"use client"` pages IGNORE `export const dynamic`.** In a client module every export becomes a client reference, not route-segment config, so the directive is silently dropped. Such pages get statically prerendered and served with `cache-control: s-maxage=31536000` (1 year), pinning the build's JS chunk hashes — a returning device can keep running an OLD bundle after redeploy. This caused the "why is unregistered showing a connection error?" ghost bug. Server pages (first line an import, not `"use client"`) DO honour it and serve no-store.

**Fix for a client page** — add a tiny server `layout.tsx` in that segment folder:

```ts
export const dynamic = "force-dynamic";
export default ({ children }) => children;
```

Verified 2026-07-13: this flips `/login`, `/cart`, `/checkout` (cascading to `/checkout/done`) from ○ static to ƒ dynamic.

**Verification rule:** confirm render mode via the `npm run build:check` route table (○ = static, ƒ = dynamic), never by eyeballing the page.

Related build gotchas (clean-build isolation, baked `NEXT_PUBLIC_*` vars): [staging-stack](staging-stack.md) and [operations](../operations/index.md).

## The product thesis: the anti-dead-end checkout

Owner brief 2026-07-10, from a 5-site competitor teardown: every Thai competitor's checkout dead-ends (forced Facebook login, re-entered data, bank account hidden until after commit, payment to a personal account, COD penalised ฿100, tracking via save-this-link). AirPlus is the deliberate opposite:

- Guest checkout (phone + name)
- Payment methods shown BEFORE commit
- COD equal + free
- Tracking by phone + order number

Naming settled: the website = **AirPlus** (brand); **Den Air Service** = legal entity / on-site business; cross-linked in the footer for trust. MVP priority: parts first, affiliate+SEO second, video last. Payment: PromptPay QR + bank transfer + COD.

## References

- Worker config + staging env: [three-workers](three-workers.md), [staging-stack](staging-stack.md)
- Local dev caveats (DO binding unresolvable, empty local D1): [local-dev](local-dev.md)
