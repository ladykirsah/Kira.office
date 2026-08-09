---
type: flow
title: Refunds (failed-delivery) & the parked returns branch
description: The ONE in-system money-refund path — delivery_failed + paid → full refund via bank form + super-admin transfer; plus the unmerged claude/airplus-returns branch and its migration collisions
tags: [refunds, returns, delivery-failed, bank-pii, parked-branch, migrations]
timestamp: 2026-08-09
status: live
sources: [kira-refund-failed-delivery.md, airplus-returns-branch-parked.md, kira-staff-mechanic-section-plan.md]
---

# Refunds (failed-delivery) & the parked returns branch

## The ONE in-system refund path — LIVE

Owner-narrowed scope (31 Jul 2026): the system tracks a money refund for **exactly one case** — a parcel that failed delivery (`order_status='delivery_failed'`, ตีกลับ "bounced back") on a **paid** order → **full refund** (= grand total). Every other return/claim was to be handled off-system via LINE OA. (The later defect-claim flow added its own refund path **reusing this machinery** — see [defect-claims](defect-claims.md).)

Flow:
1. Customer submits their receivable bank account on the storefront order page (`RefundRequest` component; `POST /api/orders/refund-bank`, ref+phone auth).
2. Surfaces in admin Zone A. Bank number/name = **financial PII → super-admin only, REDACTED from the read model for other admins**.
3. Super-admin transfers by hand within 2–3 business days, then records an outgoing refund slip (`POST /api/orders/refund-slip` — a POST so the phone stays out of the URL); the slip is shown to the customer as evidence.
4. Order lookup returns a `hasRefundBank` boolean — never the account itself.

Rules & quirks:
- Unclaimed >1 year → forfeited. The backend rule in `classifyRefundAction` still functions, but the text was REMOVED from the customer UI at the owner's request.
- **Money lands in the two-book `orderMoney` (`refundedSatang`), NEVER in `financial_records`** — that summary is on-site/POS-only; an AirPlus row would corrupt it. See [money-model-and-finance](money-model-and-finance.md).
- Full refund + restock → profit reads as the shipping loss (−carrier charge). Restock uses the existing `refund_return` movement.
- Deliberate: the operational pill STAYS "Return" after refund (operationalStatus wins); the refund state is driven by `classifyRefundAction` (needs_refund / refunded / none) + Zone A. Flag it if the owner ever wants the pill to flip.
- Customer timeline restructured: a bounce = one ตีกลับ stage whose subtitle progresses — red while money is owed, black once paid.

Shipped: backend + admin PR #93 (ed2dd6d; **migration 0076 = 7 refund columns, applied to prod FIRST**); storefront PR #94 (defbdee).

`classifyRefundAction` has a fixed gating bug worth knowing — it must check `orderStatus === 'delivery_failed'` FIRST so claim refunds don't render the failed-delivery Zone A. Details in [defect-claims](defect-claims.md).

## Parked branch: claude/airplus-returns (DRAFT PR #23) — unmerged, zero review

Holds the original cancel/return/claim + account-profile work. Commits 714959b → b517fb8 pushed; 3a61443 + 03c67f5 committed LOCALLY, not pushed as of 2026-07-17 (pushing updates the open DRAFT PR #23 — waits for owner). 28 files, +2,523/−224, 48 core tests (orderLifecycle 31 + orderTimeline 17).

Contents: storefront order cancel/return/claim (คืนสินค้า/เคลม) — `/api/orders/cancel`, `/api/orders/returns`, `/api/account/{phone,profile}`; core `orderLifecycle`, `orderTimeline`, `accountProfile`; OtpLogin name-capture; migrations `0048_campaign_kind` + `0049_order_returns` (+`0050_customer_dob`). Exists because the work was found UNCOMMITTED in the PR #20 worktree; the owner chose to keep it separate so PR #20 stayed reviewable.

Pre-merge adversarial bug hunt fixed in b517fb8: thaiGeo rejected-fetch cache poisoning, `order_returns`→BACKUP_TABLES, payments/slip missing guardMutation, cart setItem unguarded, Countdown flash-boundary hydration mismatch.

Tracked non-blocking follow-ups in the PR body: coupon usage-cap race (read-then-insert) [med], flash `sold_count` not released on cancel [med], guest ref+phone endpoints unthrottled [low], coupon not re-validated on cart shrink [low], edit-address ตำบล blank for non-dataset value [low], ProductCard `Date.now()`-in-render hydration [low].

**NOTE**: the defect-claim flow later shipped separately on main (PRs #95/#96/#97) — check what of this branch is still relevant before merging any of it.

## Return-window design decisions baked into migration 0049 (owner, 2026-07-16)

- `completed_at` was added because `ship_time_ms` records when a TRACKING NUMBER was attached (parcel left the shop), NOT when it landed; the 7-day return window measures from `completed_at`.
- Rows predating it keep NULL, and `returnEligibility` fails OPEN on NULL — acceptable because a mechanic approves every request anyway.
- คืน (return) and เคลม (claim) share **ONE table** — they differ only in wording and what the mechanic checks.
- A request NEVER moves stock or money on its own.

## Revival hazard: migration renumbering

The parked branch's migrations 0048/0049 COLLIDE with another branch's 0048 (=staff). At planning time prod D1 was at 0065; any revival must renumber the migrations to the current head and reconcile the migration ledger. Prod has since moved well past 0065 (0077/0078/0079 claim-flow migrations are live), so **the renumbering target must be re-checked at revival time**. The branch also carries known holds/returns bugs — review before merge, or rebuild returns fresh (open question). Migration discipline: [operations](../operations/index.md).

## References

- PR #93 (ed2dd6d), PR #94 (defbdee), migration 0076
- `packages/core/src/orderMoney.ts`
- https://github.com/ladykirsah/Kira.office/pull/23 (`claude/airplus-returns`)
- `0049_order_returns.sql`
- Related: [defect-claims](defect-claims.md), [order-lifecycle](order-lifecycle.md)
