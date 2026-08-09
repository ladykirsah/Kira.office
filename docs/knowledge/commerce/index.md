---
type: guide
title: Commerce — index
description: Order lifecycle, payments, refunds, claims, customer credit, customers, coupons, shipping fees, the money model, and the vs-Shopee business case
tags: [commerce, index]
timestamp: 2026-08-09
status: live
sources: [session-memory corpus]
---

# Commerce

Money-touching and order-touching knowledge for Kira.office (admin/API) and the AirPlus storefront. Start here, open only what you need.

- [order-lifecycle](order-lifecycle.md) — two-axis status (order_status × payment_status), the derived `operationalStatus`/`to_ship` layer, summary cards, cancel/restock asymmetry, failed-delivery semantics, punch list.
- [payments-promptpay](payments-promptpay.md) — ONE shared KV+core PromptPay QR system for storefront + POS; **BLOCKER: `shop:airplus:paymentMethods` unset in prod (owner-only fix)**; Den Air money-stream separation; POS payments anti-cheat trail.
- [slip-verification](slip-verification.md) — SlipOK auto-verify built + dormant behind `SLIPOK_*` secrets, owner-parked; activation runbook; slip-image viewing is super-admin only; vendor research (stale?).
- [refunds-and-returns](refunds-and-returns.md) — the ONE in-system refund path (delivery_failed + paid → full refund, super-admin money, orderMoney not financial_records); the parked `claude/airplus-returns` branch and its 0048/0049 migration collisions.
- [defect-claims](defect-claims.md) — customer-only claim flow (refund/exchange chosen at submit), mechanic verdict + super-admin money, claimState machine + migration-0071 CHECK trap, return-address KV vs SEO-address trap.
- [customer-credit](customer-credit.md) — demerit counter (complete=0, incomplete=−1, forward recovery), pure tier function, admin-internal privacy invariant with CI guard, pending backfill click.
- [customers-directory](customers-directory.md) — plate-keyed customer model, legacy history = memory-not-money, Excel importer with NULL-safe atomic upserts.
- [coupons](coupons.md) — real typed-code coupons vs the hardcoded storefront wallet MOCK; latent max_uses_per_customer bug (migration 0052 unique index).
- [shipping-fees](shipping-fees.md) — Flash local rate-card engine + server-side checkout fee; **rate numbers PLACEHOLDER and volumetricDivisor:5000 likely wrong — quotes not trustworthy yet**.
- [money-model-and-finance](money-model-and-finance.md) — two books (charged vs kept), profit is DERIVED never `profit_satang`, shipping columns 0073, on-site product-vs-service profit formulas, Finance filter + TEMP mock-seed cleanup.
- [vs-shopee-business-case](vs-shopee-business-case.md) — July 2026 actuals (≈4.2× net, ≈฿268/order yardstick) + Shopee import money semantics (Total = NET payout, never จำนวนเงินทั้งหมด).

Adjacent areas: [platform](../platform/index.md) · [operations](../operations/index.md) · [auth](../auth/index.md) · [back-office](../back-office/index.md) · [storefront](../storefront/index.md) · [conventions](../conventions/index.md)
