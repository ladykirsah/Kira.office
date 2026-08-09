---
type: feature
title: Slip verification (SlipOK) — built, dormant, owner-parked
description: Bank-slip auto-verify is fully built on both workers with DB-level one-slip-one-payment anti-cheat; dormant behind SLIPOK_* secrets; slip image viewing is super-admin only
tags: [payments, slip, slipok, secrets, super-admin, parked]
timestamp: 2026-08-09
status: parked
sources: [airplus-slip-autoverify-parked.md, airplus-promptpay-shared-billing.md, onsite-pos-customer-roadmap.md, kira-slip-super-admin-gating.md]
---

# Slip verification (SlipOK)

## What it is

Automatic verification of Thai bank-transfer slips against the SlipOK API, upgrading a payment from manual review to confirmed with the bank `transRef` stored.

- **Back-office side** (PR #12, 2026-07-07; migration 0034 applied to prod): a verified slip QR upgrades a payment approved→confirmed. The SlipOK adapter is isolated in **one function**: `verifySlipWithSlipOk` in `apps/api/src/index.ts`. The wire format was verified against the live API's error path (dummy branch → structured "ไม่พบข้อมูลสาขา"); the success shape is unit-tested per docs — final confirmation happens when real keys arrive. Config-gated: the flag is exposed as `slipVerifyEnabled` on `GET /payments`; documented in `.dev.vars.example` + `wrangler.jsonc`. With verification ON, an approved payment renders a warn (awaiting slip) + a per-row "Verify slip" scan input; OFF = unchanged look.
- **Storefront side**: slip route `apps/storefront/src/app/api/payments/slip/route.ts` and back-office `confirmPaymentWithSlip` both call the shared `@l-shopee/core` `verifySlipWithSlipOk` + `slipVerificationConfigured`.
- **Anti-cheat**: a **partial UNIQUE index on `payments.slip_ref`** — one slip confirms exactly one payment; slip reuse is rejected at the DB level.

## Why it is dormant

Cloudflare secrets are **per-worker**. `SLIPOK_API_KEY` + `SLIPOK_BRANCH_ID` are unset (on the storefront worker in particular), so everything runs in manual-review mode. The storefront needs its own copy of the SAME SlipOK account via `wrangler secret put`. Once set, slips auto-confirm and mark the order paid instantly — no code change.

**Owner parked it** (19 Jul 2026): "pause SlipOK" — do NOT push activation.

## Activation runbook (when the owner says go)

1. Owner registers SlipOK — free tier ฿0 = 100 slips/mo (covers ~25–50 orders), overage ฿1/slip, paid ฿350/500. Signup via LINE OA. The owner enters the API key themselves (never enter API keys for them).
2. `wrangler secret put SLIPOK_API_KEY` + `SLIPOK_BRANCH_ID` on **BOTH** workers (storefront + kira-office API).
3. One real ฿1 transfer end-to-end test.

Activation gotchas:
- Some banks (KTB/BBL) have a verify-lag of 5–10 min after transfer → needs retry logic.
- Test whether invalid slips consume SlipOK quota.
- PDPA: SlipOK becomes a data processor — must be added to the privacy notice (see [storefront](../storefront/index.md) policy docs).

## Super-admin gating on slip review (memory-index summary)

Per the session-memory index (kira-slip-super-admin-gating): **approve/reject a payment = any admin; VIEWING the slip image = super-admin only** (Documents section + the review block); a reject puts the order into a hold state (awaiting customer). Verify against current code before extending — this file carries the index-level summary, not a line-by-line code verification.

## Vendor research (Jul 2026 — likely stale, re-verify prices before deciding)

Verified on official pages at the time: **SlipOK free tier wins** at this volume. Thunder free 150/mo but newer/thin reputation; EasySlip ฿99/250 (no free tier, strong API docs, individuals OK); RDCW prepaid (prices JS-hidden, charges valid slips only); openslipverify is dead. Payment gateways are worse at this volume: Opn 1.65%; Beam ฿0 PromptPay but business-only + T+3 settlement; **GB Prime Pay no longer exists** (absorbed into Xendit, 2.5% + ฿7).

## References

- PR #12; migration 0034
- `apps/api/src/index.ts` (`verifySlipWithSlipOk`, `confirmPaymentWithSlip`)
- `apps/storefront/src/app/api/payments/slip/route.ts`
- `.dev.vars.example`
- Secret names only, never values: `SLIPOK_API_KEY`, `SLIPOK_BRANCH_ID`
- Related: [payments-promptpay](payments-promptpay.md); roles/access model in [auth](../auth/index.md)
