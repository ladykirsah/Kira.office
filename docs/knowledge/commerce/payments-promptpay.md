---
type: feature
title: Payments — PromptPay shared billing & the cannot-take-payment blocker
description: One KV+core QR system serves storefront checkout and POS billing; AirPlus's own PromptPay account is unset in prod (owner-only fix), so prepaid customers get no QR
tags: [payments, promptpay, kv, pos, checkout, blocker]
timestamp: 2026-08-09
status: blocked
sources: [airplus-cannot-take-payment.md, airplus-promptpay-shared-billing.md, onsite-pos-customer-roadmap.md]
---

# Payments — PromptPay shared billing

## What it is

Storefront PromptPay QR and Kira.office POS/billing QR are **ONE shared system** (verified 2026-07-17):

- **One account source**: KV key `shop:paymentMethods` (per-shop: `shop:<shop>:paymentMethods`) in the SHARED KV namespace — the storefront Worker and the API Worker bind the **identical** namespace id (prod `a64f57510fcf491695b1170bf5057a6d`, staging `c876509fba5c40608e1c0f1abf5d4502`). Configured in admin → Settings → Shop info → "Payment — PromptPay accounts" (`apps/admin/src/app/settings/shop/page.tsx`), written via the `shop:*` settings PUT (`SHOP_TEXT_FIELDS` in `apps/api/src/index.ts`). Shop info holds MULTIPLE PromptPay accounts (paymentMethods JSON; core `parsePaymentMethods`/`serializePaymentMethods`/`defaultPaymentMethod`, one default enforced; accounts carry a Position/role field).
- **One QR builder**: `apps/admin/src/app/pos/PromptPayQr.tsx` and `apps/storefront/src/components/PromptPayQr.tsx` both call the TDD'd `@l-shopee/core` `buildPromptPayPayload`. The builder (`packages/core/src/promptpay.ts`) implements crc16ccitt 0x29B1, `formatPromptPayTarget` (phone / 13-digit ID / 15-digit e-wallet), EMVCo TLV byte-identical to the reference promptpay-qr lib; owner scan-tested with a real banking app (right name, right amount).
- Checkout (`apps/storefront/src/app/api/checkout/route.ts` ~372) reads the default method from KV **at order time** and stamps `promptpay_id` on the payment row.

Because KV is read live, setting an account in admin makes the real QR appear with **no code change and no deploy**. The storefront's "ร้านยังไม่ได้ตั้งค่า PromptPay" warning simply means the KV key is empty.

## BLOCKER: shop:airplus:paymentMethods unset in prod

Verified against production KV 2026-07-21: `checkout/route.ts:423` reads `shopKey("airplus","paymentMethods")`; that key **does not exist** in prod KV (namespace `a64f5751…`), so `defaultPaymentMethod(methods)?.promptpayId ?? null` → `null`. The order is still created — there is just **no QR to pay it with**. COD is unaffected (`body.paymentMethod !== "cod"` guards the whole block).

This is **correct behaviour, not a bug**: the code deliberately refuses to fall back to the Den Air profile. In-code comment: "AirPlus's OWN account — Den Air Service takes money into a different one, so this must never fall back to the workshop's profile."

**Fix = owner action** in admin → Shop info → AirPlus → payment method. Do NOT set it for them — choosing which account receives customer money is the owner's financial decision. Afterwards, confirm a real QR renders at checkout.

## Invariant: Den Air ≠ AirPlus money streams

`shop:denair:paymentMethods` IS set in prod KV (PromptPay `<in KV, not in repo>`, `<account holder name in KV>`) — that is the on-site workshop's receiving account, a **different money stream** from AirPlus. The storefront checkout intentionally has no fallback to it. Keep that separation in any future payment work.

## Demo mock fallback — deliberate, keep it

Owner decision 2026-07-17: the labelled demo mock (`MOCK_PROMPTPAY_ID` `'0812345678'` in `apps/storefront/src/app/checkout/done/page.tsx`, labelled "ตัวอย่าง (เดโม) — ยังไม่ใช่บัญชีรับเงินจริง" / "example (demo) — not a real receiving account") is the not-configured fallback; a configured account overrides it. Never enter the owner's **real** PromptPay number yourself — financial detail, owner enters it in admin. Cosmetic note: the success-check badge on checkout/done was recoloured green→blue (`--brand-blue`) 2026-07-17 because the owner found green unfriendly.

## POS Payment page & the payments table (anti-cheat trail)

Why it is this way: the owner works OFF-SITE with staff at the counter; one official pay flow with a record per payment lets them reconcile approvals against the receiving bank account remotely.

- Payment page (Sell nav): account dropdown → amount → live QR (**QR snapshotted on Create** so an input edit cannot desync the amount) → staff taps Approve → row in `payments` table (migration 0031: `method_label` + `promptpay_id` snapshot + `amount_satang` + status CHECK pending/approved/confirmed/void). The status field IS the PaymentConfirmer seam — auto-confirm later flips pending→confirmed.
- **Cash bills NEVER print a payment QR** (owner decision) — nothing may bypass the record.
- Recent-payments has a Clear button = owner reconciliation (marks `cleared_at`, migration 0032; **NEVER deletes** — records survive as the anti-cheat trail; `listPayments` shows only uncleared rows).
- Guardrail: the OWNER enters any merchant/gateway credentials themselves, never the assistant.

## Current state (2026-08-09)

- Shared QR system live on both apps; POS payment trail live.
- AirPlus prod account still unset → storefront prepaid customers cannot pay (COD works). Owner-only fix.
- Slip verification is a separate, parked layer: see [slip-verification](slip-verification.md).

## References

- `apps/storefront/src/app/api/checkout/route.ts:423`
- `apps/storefront/src/components/PromptPayQr.tsx`, `apps/admin/src/app/pos/PromptPayQr.tsx`
- `packages/core/src/promptpay.ts`
- `apps/admin/src/app/settings/shop/page.tsx`; `SHOP_TEXT_FIELDS` in `apps/api/src/index.ts`
- migrations 0031, 0032
- KV binding details: [platform](../platform/index.md)
