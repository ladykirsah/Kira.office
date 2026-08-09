---
type: feature
title: Customer credit — demerit counter & tier
description: Rebuilt PR #99 — complete=0, incomplete=−1, forward recovery, loyalty folded in, tier = pure f(credit); credit/tier are admin-internal with a CI guard
tags: [customers, credit, tier, cod, privacy, invariant]
timestamp: 2026-08-09
status: live
sources: [kira-customer-credit-model.md, kira-returns-mechanic-approval.md]
---

# Customer credit — demerit counter & tier

## What it is

Rebuilt 2 Aug 2026 (PR #99, squash 4900ebe, LIVE). The old model scored +1 per completed order — meaningless as a risk signal. New spec:

- **complete = 0, incomplete = −1**. Incomplete = "expired", or "cancelled" while pending/cod_denied (`creditEventFromOrder` unchanged).
- **Order credit capped at 0**, walked CHRONOLOGICALLY oldest-first — order matters; the API recalc SELECT is `ORDER BY COALESCE(order_created_at, imported_at) ASC`. A −1 is repaid **FORWARD**: every 2 completes while in debt = +1, and past completes never pre-absorb a later mistake ("earn it forward" — owner's choice).
- **Loyalty** = `loyaltyCredit(earn, hold)`: +1 if `meetsBestEarn` (10 completed OR ฿15k/90d) + +1 if `meetsBestHold` (3 completed OR ฿5k/60d), max +2, FOLDED into the stored `credit_score` — the only way above 0.
- **Tier = pure `tierFromCredit`**: ≥1 best · 0 good · −1..−2 watch · −3..−5 bad · ≤−6 block; plus manual admin block via `tier_override='block'`.
- **REMOVED**: +1-per-complete inflation, the 5-incompletes/month velocity block (`isVelocityBlock`), and the bad-recovery shortcut (`isBadRecovered`/`tier_locked_until`/prepaid).
- `codApproval` unchanged: best/good auto-approve, watch → staff review, bad/block → blocked.
- `recalculateCustomerCredit(db, customerId)` runs on every terminal order event + the recalc routes.

**Credit rule from returns**: product-failure returns/claims do NOT count as −1 — the demerit counter only penalizes expired / cancelled-while-pending orders ([defect-claims](defect-claims.md)).

⚠️ **Stale-docs trap**: migration 0068's header comment still says "+1 per completed order" — STALE; the code (`packages/core/src/customerTier.ts`) is the source of truth.

## INVARIANT: credit/tier are admin-INTERNAL — customer must NEVER see them

Owner rule (2 Aug 2026): credit + tier are internal to Kira.office (behind Cloudflare Access); the customer must NEVER see their own credit/tier on AirPlus. Verified true in code: `getSession`/`/api/auth/me` returns only id/phone/name/email/phoneVerifiedAt/pdpaConsentAt; `/api/orders/lookup` returns none; COD gating runs server-side only.

A **CI guard enforces it** (PR #100): `apps/storefront/src/lib/creditPrivacy.test.ts` source-scans the entire storefront and FAILS if `credit_score`/`creditScore` or `\btier\b` appears anywhere. Adjust the guard's PATTERNS only if a genuinely unrelated "tier" is ever introduced.

## Backfill — open item (as of 2 Aug 2026, status open?)

`POST /storefront-customers/recalculate-credit-all` (behind Access) + an "อัปเดตเครดิตทั้งหมด" ("update all credit") button on the AirPlus customers page recompute every customer's credit under the demerit model. **The owner must click it once** after the PR #99 deploy — the agent cannot (Access-gated, see [auth](../auth/index.md)). Until clicked, stale scores are all inflated-HIGH, so nobody is wrongly blocked in the meantime. Still pending as of 2 Aug; verify before assuming done.

## References

- PR #99 (4900ebe), PR #100
- `packages/core/src/customerTier.ts`
- `apps/storefront/src/lib/creditPrivacy.test.ts`
- migration 0068 (stale comment)
- Related: [customers-directory](customers-directory.md), [order-lifecycle](order-lifecycle.md)
