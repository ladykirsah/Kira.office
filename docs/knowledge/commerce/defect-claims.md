---
type: flow
title: Defect-claim flow & resolution
description: Customer self-submitted claims with refund/exchange chosen at submit; mechanic verdict, super-admin money; no pre-approve gate; state machine in claimState.ts
tags: [claims, refunds, exchange, mechanic, super-admin, r2, state-machine]
timestamp: 2026-08-09
status: live
sources: [kira-defect-claim-flow.md, kira-returns-mechanic-approval.md]
---

# Defect-claim flow & resolution

## What it is — LIVE end-to-end (PRs #95/#96/#97/#98; migrations 0077/0078/0079)

The customer self-submits a claim on the AirPlus order page (`ClaimRequest`): free-form reason + up to 5 photos (downscaled) + 1 video → `POST /api/orders/claim`, ref+phone auth, whole-order claim, one active claim at a time, evidence stored in the `claim/` R2 namespace.

**Customer picks the resolution AT SUBMIT**: รับเงินคืน (refund → bank form) or เปลี่ยนสินค้าใหม่ (exchange → same or new address).

**Admin flow has NO pre-approve gate** (owner: "it's messy"): requested→received ONLY — the customer ships the item back on filing.
- Step 1 สินค้าเคลมมาถึง ("claimed item arrived") = ONE button "ได้รับสินค้าแล้ว" (received), no assignee.
- Step 2 ผลการตรวจสอบ ("inspection result", at received): assignee dropdown + อนุมัติเคลม (approve) / ปฏิเสธ (reject) → resolve.

State notes:
- `approved` kept only as a legacy escape-hatch; `cancelled` legacy-only.
- `shipped` is now TERMINAL (PR #98 dropped shipped→done) — submitting the replacement drop-off form FINISHES the claim. PR #98 also added a Zone B read-only summary of resolved claims.
- Admin "+ Raise a claim" was REMOVED (claims are customer-only). The `createClaim` route still exists dormant; admin-raised claims don't set `resolution` ⇒ null ⇒ the admin UI defaults to the exchange path — known limitation.
- State machine: `packages/core/src/claimState.ts`. **Trap**: the state CHECK constraint from migration 0071 makes adding a NEW state a risky SQLite table-recreate — the return-shipment feature was deliberately built WITHOUT a new state for this reason.

Migrations: 0077 `order_claims.assignee_name`; 0078 `replacement_address_id` (nullable FK→addresses; null = the order's own address); 0079 `shipping_fee_satang`. PRs: #95 (9b9a58f, roles + admin Zone A), #96 (8b5f241, customer submit), #97 (1247961, resolution), #98 (4067d52, finish-on-submit + Zone B summary).

## Mechanic approval — invariant

Return/claim orders need mechanic sign-off before processing: the mechanic verifies whether the product is actually defective — prevents fraudulent returns. This drove the mechanic role (`canReviewClaim`) and the received→mechanic_approved/mechanic_rejected states. The UI should distinguish "awaiting mechanic approval" from "approved, processing refund".

**Credit rule**: product-failure returns do NOT count as −1 against the customer's credit — the demerit counter only penalizes expired / cancelled-while-pending orders. See [customer-credit](customer-credit.md). Roles model: [auth](../auth/index.md).

## Money rules

**Refund path** — reuses the failed-delivery machinery fully ([refunds-and-returns](refunds-and-returns.md)):
- `recordClaimRefund(db, claimId, slip, actor)` writes the order's SAME `refund_*` columns (`refund_satang` = grand total, `refunded_at`, actor, slip under `refund-slip/{claimId}/`, `payment_status='refunded'`) so `orderMoney` reflects it in both books, then closes the claim.
- **NO restock** — the returned item is defective.
- `POST /claims/:id/refund` is **SUPER-ADMIN ONLY** (money + bank PII) even though claim review is super+mechanic — the mechanic does the verdict, the super-admin does the money.
- Profit reads 0 on a claim refund (grand − refund − 0): this ASSUMES the defective part is cost-recovered up the supply chain (supplier warranty). ⚠️ If the owner instead writes the part off, the real loss = the part's COGS — `orderMoney` would need to subtract COGS. FLAGGED to the owner, not built.

**Exchange path**:
- Replacement = drop-off shipping form (carrier + tracking + ค่าจัดส่ง shipping fee) → `order_claims.carrier/tracking_no/shipping_fee_satang` on mechanic_approved→shipped.
- Replacement financials = **shipping fee ONLY** (the new part assumed supplier-covered): `orderMoney` gained `claimShippingSatang` (summed across the order's claims), subtracted straight off profit.

**Reject path** (ปฏิเสธ = out of T&C or customer misuse, NOT "no defect"): received→mechanic_rejected with a required reason. Since the customer still owns the item, a return-shipment form (same fields as replacement) records the send-back onto the claim's existing us→customer columns via `recordClaimReturnShipment` + `POST /claims/:id/return-shipment` (`canReviewClaim`, no state change, idempotent on `tracking_no`); its ค่าจัดส่ง also flows into `orderMoney` (owner OK'd eating that cost).

## Return address — do NOT confuse the two addresses

The customer send-back return address (shown for BOTH refund & replacement while the item is in transit back) comes from the AirPlus shop profile: storefront lookup reads `KV.get(shopKey('airplus','address'))` → `returnAddress` — the same value shown in admin Shop info (see the `SHOP_TEXT_FIELDS` comment). **WARNING**: the SEO `SHOP` constant in storefront `lib/business.ts` is a DIFFERENT hardcoded Surin address used only for schema.org markup — never conflate them.

## classifyRefundAction gating + CodeQL gotcha

Bug fixed via TDD: `classifyRefundAction` returned `'refunded'` for ANY `refundedAt`, so a claim refund (`order_status='claimed'`) wrongly rendered the failed-delivery Zone A labelled "พัสดุตีกลับ". Now gated on `orderStatus === 'delivery_failed'` **FIRST** (a bounce refund keeps `delivery_failed`; a claim refund sits at `claimed`).

Separate gotcha: the storefront claim photo picker shows selected photos as filename tiles, NOT blob-URL thumbnails — CodeQL flags `URL.createObjectURL(file)`→`<img src>` as `js/xss-through-dom` (a false positive, but a blocking high-severity check). Avoid createObjectURL previews in storefront code.

## References

- PRs #95, #96, #97, #98; migrations 0071, 0077, 0078, 0079
- `packages/core/src/claimState.ts`, `packages/core/src/orderMoney.ts`
- `apps/api` `recordClaimRefund`, `recordClaimReturnShipment`
- `apps/storefront` `lib/business.ts` (SEO address trap)
- Related: [refunds-and-returns](refunds-and-returns.md), [money-model-and-finance](money-model-and-finance.md), [customer-credit](customer-credit.md)
