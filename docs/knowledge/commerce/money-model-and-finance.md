---
type: invariant
title: Two-book money model & Finance
description: 'Charged vs kept — profit is DERIVED, never read from profit_satang; shipping never counted twice; on-site profit has two formulas; Finance shows only money-settled orders'
tags: [money, finance, profit, shipping, invariant, orderMoney]
timestamp: 2026-08-09
status: live
sources: [kira-financial-part-progress.md, kira-onsite-profit-two-ways.md, finance-page-mock-seed.md]
---

# Two-book money model & Finance

## The two books (owner's own correction — do not break)

1. **What the customer was charged**: subtotal − discount + shipping = Customer paid.
2. **What we kept**: goods after discount − item cost − shipping-on-us = Profit.

**The trap**: a base that already contains the customer's shipping fee deducts the FULL carrier charge; a base that excludes it (goods after discount) deducts only the SHORTFALL (real − charged). Both reach the same profit; **mixing pairings is wrong by exactly the fee**. `packages/core/src/orderMoney.ts` + tests hold this (9/9 mutants killed). `docs/ORDERS_UX_SPEC.md` §3.2 was rewritten to match.

**Profit is DERIVED — never read `profit_satang`.** The `profit_satang` column is written once at checkout, deliberately excludes shipping, and nothing recomputes it — reading it overstated profit on every order where we absorbed the carrier charge (a live wrong number). Shipped in the financial part (PRs #86/#87, live 30 Jul 2026).

Refunds and claim shipping also flow through `orderMoney` (`refundedSatang`, `claimShippingSatang`) and **never** through `financial_records` — that summary is on-site/POS-only; an AirPlus row would corrupt it. See [refunds-and-returns](refunds-and-returns.md) and [defect-claims](defect-claims.md).

## Shipping columns (migration 0073) — invariants

- `shipping_auto_satang` = the Flash quote and **MUST be persisted**: `sales_order_lines` carries no weight/dimensions so it cannot be recomputed, and joining live `product_dimensions` would drift.
- `shipping_offer_satang` nullable — **non-null IS the shared-fee marker**; deliberately NO separate boolean that could disagree with the amount.
- `shipping_real_satang` nullable — **NULL ≠ 0**.
- `carrier`/`tracking_no` already existed from migration 0030 — do not re-add.
- Backfill set auto = charged, because every past order was charged what we quoted.
- The shared-fee AUTO-APPLY rule is deliberately unbuilt — criteria come later based on order weight and total.

## On-site profit is computed TWO ways — invariant

Den Air Service (POS) makes money two ways with DIFFERENT profit formulas:

- **Product** profit = price − cost (COGS).
- **Service/labour** profit = price − staff salary (the technician's pay). A service carries no inventory cost — folding it into a COGS model would misstate profit.

Finance summaries, the dashboard money view, and any on-site refund/reversal must keep the two formulas separate. **AirPlus (shipped products) uses the product model ONLY** — a failed-delivery refund reverses goods (restock) and eats shipping; no labour term. Staff salary belongs to the future payroll work (staff/mechanic plan, see [back-office](../back-office/index.md)).

## Finance page semantics + TEMP mock seed (open cleanup)

Domain fact: **Finance shows only money-settled orders** — the `isFinanceOrder` filter in `apps/admin/src/app/sales/page.tsx` passes complete / refunded / claimed / claim_rejected; `in_transit` is EXCLUDED.

**TEMP seed to remove before PR #115 finishes** (seeded 2 Aug 2026 into LOCAL D1 only — not committed, not prod — so the Finance rework could be designed against realistic content): 4 onsite bills `mk-os-1..4` (+ profit lines `mk-l1..4`, Den Air Service, `sale_status='completed'`, `stage='bill'`) and 5 AirPlus orders `mk-ap-1..5` spanning delivered(complete) / shipped(in_transit, excluded from Finance) / claimed+refunded (NEGATIVE `profit_satang` = money out) / claimed / claim_rejected. Plus ONE test expense row (airplus / "AI package" / ฿1,200) created while verifying the expenses feature (migration 0081, feat(finance): channel-tagged expenses).

Cleanup command:

```sh
npx wrangler d1 execute kira-office --local --command \
  "DELETE FROM onsite_sale_lines WHERE id LIKE 'mk-l%'; \
   DELETE FROM onsite_sales WHERE id LIKE 'mk-os-%'; \
   DELETE FROM sales_orders WHERE id LIKE 'mk-ap-%'; \
   DELETE FROM expenses;"
```

## References

- `packages/core/src/orderMoney.ts`; `docs/ORDERS_UX_SPEC.md` §3.2
- PRs #86, #87, #115; migrations 0030, 0073, 0081
- `apps/admin/src/app/sales/page.tsx` (`isFinanceOrder`)
- Related: [shipping-fees](shipping-fees.md), [vs-shopee-business-case](vs-shopee-business-case.md)
