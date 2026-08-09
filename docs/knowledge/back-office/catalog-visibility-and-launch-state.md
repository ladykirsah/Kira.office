---
type: trap
title: Catalog — storefront visibility gate and the demo-data launch blocker
description: Storefront shows status='active' AND ledger sum > 0; price does NOT gate (unpriced lists at ฿0); prod catalog was 6 demo rows — real catalog load is the longest-lead owner blocker
tags: [catalog, storefront, visibility, pricing, launch-blocker]
timestamp: 2026-08-09
status: open
sources: [airplus-prod-catalog-is-demo-data.md, apps/storefront/src/lib/db.ts]
---

# Catalog — visibility gate and launch state

## The visibility gate (invariant + trap)

The gate in apps/storefront/src/lib/db.ts `CATALOG_SELECT` is:

```
p.status = 'active' AND (stock ledger SUM) > 0
```

**Price does NOT gate visibility.** Price is `COALESCE(..., 0)`, so a product without `online_price_satang` set **lists at ฿0** to customers. When loading the real catalog, `PUT /products/:id/pricing` (sets `online_price_satang`) is REQUIRED for every product, or it shows ฿0.

## Prod catalog is demo/seed data — the longest-lead owner blocker

Verified against prod D1 `kira-office` on 2026-07-17 via wrangler (status may have moved since — re-verify before relying on it):

- `d1_migrations` latest was `0047_affiliate_items.sql` at that date; `sales_orders` = 0, `onsite_sales` = 0, `storefront_customers` = 0 — genuinely pre-launch; D1 Time Travel (30 d) covers rollback.
- `products` = 6 demo rows: Vios compressor ฿2,890, Honda City blower ฿1,190, Mazda 2 radiator fan ฿1,590, Isuzu D-Max evaporator ฿2,490 @ 0 stock, a Nissan Almera cabin filter draft, and a demo skincare cream. **Corrected 2026-07-21:** the cream is `status='draft'` and does NOT render — 4 active products, all genuinely car-A/C, nothing embarrassing on display.

Loading the real catalog (product data + photos + online prices + opening stock) is an **owner** blocker with the longest lead time of any launch item — code audits cannot see this.

Existing tooling for the load:

- admin `/import` (XLSX/CSV)
- `/products/new` (atomic save — see [products](products.md))
- the gallery uploader (photos → R2)
- `PUT /products/:id/pricing` (mandatory per the gate above)
- `/stock` receive for opening counts (see [stock-full-track](stock-full-track.md))

## References

- [products](products.md), [taxonomy-and-attributes](taxonomy-and-attributes.md)
- Storefront rendering details: [storefront](../storefront/index.md)
- Prod D1 access paths: [operations](../operations/index.md)
