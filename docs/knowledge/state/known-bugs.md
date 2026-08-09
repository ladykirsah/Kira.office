---
type: invariant
title: Known bugs and live traps
description: Verified, unfixed bugs and code traps as of 2026-08-09. Re-verify locations before fixing — code moves; several audit-era bugs turned out already fixed.
tags: [state, bugs, traps]
timestamp: 2026-08-09
status: open
sources: [kira-audit-findings-2026-07.md, session 2026-08-09 adversarial re-verification, kira-coupon-wallet-is-a-mock.md]
---

# Known bugs and live traps

Originally from the 2026-07-16 six-reader audit; **re-verified against the code on
2026-08-09** by an adversarial review pass. That pass matters: three of the audit's five
"live bugs" had in fact been fixed the same day (PR
[#21](https://github.com/ladykirsah/Kira.office/pull/21), `0a103ea`) — the lesson stands:
**re-verify before fixing; file:line references drift and so do the bugs themselves.**

## Live bugs (re-verified still present, 2026-08-09)

1. **Plate-normalization asymmetry.** `getCustomerDetail` binds `normalizePlate(plate)` in
   two of three places, the raw plate in the third — odd whitespace returns directory +
   history but an empty bill list. `searchCustomers` has the same asymmetry.
2. **Silent LIMIT cliffs.** `listOrders` LIMIT 200 across all channels with the channel
   split client-side (`sales/page.tsx`) — Shopee volume starves AirPlus rows out of the
   payload. Also `listOpenDrafts` LIMIT 100, `listStock` LIMIT 200.
3. **Email uniqueness is case-sensitive while every lookup lowercases** (found 2026-08-09
   during the login bug-hunt). `users_email_unique` indexes raw `email`, but all lookups
   are `WHERE lower(email) = ?` with `.first()`. Two rows differing only in case can
   coexist; login would pick one arbitrarily. `createStaff` lowercases before insert, so
   only hand-written SQL can create the collision — and `reset-staff-password.mjs`'s
   `ON CONFLICT(email)` would then insert a duplicate instead of updating. Fix shape:
   unique index on `lower(email)`.

## Traps (not bugs — yet)

- **Storefront coupon wallet is a mock** — six hardcoded coupons + localStorage. Real
  coupons only work by typed code ([storefront](../storefront/index.md)).
- **Migration 0068's comment describes the credit model wrongly** — the model was rebuilt
  in [#99](https://github.com/ladykirsah/Kira.office/pull/99); trust
  [commerce](../commerce/index.md), not that comment.
- **`docs/HARDENING.md` and `docs/MODULE_POS_AND_SYNC.md` still claim the StockLedger DO
  does not serialize** — false since `d08c921` (2026-07-26) wrapped every DO method in
  `blockConcurrencyWhile` ([platform code-map](../platform/code-map.md)).

## Structural gaps (known, accepted for now)

- `xlsx.ts` ingest collapses multi-item orders to one row — line data destroyed at ingest.
- `products.shopee_item_id` is item-level but Shopee stock updates address a *model* id —
  the current link structurally cannot carry stock sync; needs a listing/model table.
- One `online_price_satang` is shared by Shopee and AirPlus (`SaleChannel` is only
  `onsite | online`) — per-channel pricing is impossible today.

## Fixed history (do not re-fix)

Fixed in [PR #21](https://github.com/ladykirsah/Kira.office/pull/21) (`0a103ea`,
2026-07-16 — the same day the audit recorded them):

- Lost-update on stock correction — `planAdjustment('correction')` now sends the counted
  **absolute** number (`countedOnHand`); the server computes the delta.
- `/stock/adjust` unguarded — now validates `movementType` against
  `MANUAL_MOVEMENT_TYPES` (400, not a DB-CHECK 500) and routes through the serialized
  StockLedger DO.
- `refundSaleToDb` `quantity_after` loop — now reads on-hand once per variant and threads
  a running total (the code comment cites the bug's own "7, 10 not 7, 8" example).
- The orphaned reserve/release model in `packages/core/src/stock.ts` — the whole file was
  **deleted** in the same PR; the trap no longer exists.

The 2026-07-26 adversarial hunt's six findings are also all fixed and deployed
([#74](https://github.com/ladykirsah/Kira.office/pull/74),
[#75](https://github.com/ladykirsah/Kira.office/pull/75), migration 0063) — details and the
**rejected** findings (do not re-chase: RBAC "not enforced", `requireAccess` fail-open,
plate normalization on `onsite_sales`, `updateProduct` full-row null) live under
[operations](../operations/index.md).
