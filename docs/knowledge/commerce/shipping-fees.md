---
type: feature
title: Shipping fees — Flash local rate-card engine
description: Server-side checkout fee from a local Flash rate card; rate numbers are PLACEHOLDER and volumetricDivisor:5000 is likely wrong — do not trust customer quotes yet
tags: [shipping, flash-express, checkout, rate-card, blocked]
timestamp: 2026-08-09
status: blocked
sources: [airplus-launch-cost-decisions-2026-07.md, airplus-shipping-fee-built.md, flash-express-rate-rules.md, auto-shipping-fee-calc.md]
---

# Shipping fees — Flash local rate-card engine

## Why it is this way (decision 2026-07-18)

No aggregator, no ฿15k deposit — the ฿15,000 deposit is a Shippop/GoShip aggregator wallet artifact, not a Flash cost. The owner chose **"calculation only + manual label + drop off"**: a LOCAL rate-card calculator replicating Flash's published table, behind a **thin carrier adapter** so a future swap isn't a rewrite. The owner creates labels in the Flash app + drops off; the customer reimburses shipping. With manual labels there is **no carrier webhook** at launch — statuses stay owner-set in admin ([order-lifecycle](order-lifecycle.md)).

Upgrade path (not chosen for launch): Flash's OFFICIAL Open API (open-docs.flashexpress.com) — `POST /open/v1/orders/estimate_rate` (Freight Inquiry), SHA256 signature auth (mchId + key, same pattern as `apps/api/src/shopee.ts`), free training sandbox `open-api-tra.flashexpress.com`, free merchant account, no deposit for quotes — behind the same adapter shape.

Dimensions: owner chose real box W×L×H per product (needed for volumetric — A/C parts split hard: compressor heavy+small, condenser/evaporator light+bulky). At decision time products had only `weight_grams` (migration 0003); box dimensions did not exist → schema + catalog work tied to the real-catalog load.

Provenance: the original request (2026-07-04) was "auto-calculate the shipping fee per order instead of hand-entry", with envisioned inputs of transport weight, destination, and carrier (Flash/Kerry/J&T/ไปรษณีย์ไทย — carriers already surface as a tag on the AirPlus order row). That memory predates the build; the Flash-local-rate-card work implements it.

## What is built (2026-07-18, claude/airplus-publication-plan-08e4c7, commits 3aaacd6/5f192a5)

`packages/core/src/shipping.ts`:
- `volumetricWeightKg` (W×L×H cm ÷ 5000) — **see the divisor warning below**
- `chargeableWeightKg` (greater of actual vs volumetric)
- `cartChargeableWeightKg` — ONE parcel = greater of Σactual vs Σvolumetric (owner's confirmed multi-item rule)
- `feeForChargeableKg` (tier lookup + per-kg overflow above top tier)
- `quoteShippingSatang` (incl. remote surcharge). Rate-card-injected, fixture-tested.

`packages/core/src/flashRates.ts`:
- `FLASH_TH_RATE_CARD` — ⚠️ **PLACEHOLDER numbers** from Flash's public 3/2568 table (base ฿25, ≤19kg ฿257, +฿12/kg over, +฿50 remote); the owner MUST confirm from their Flash account.
- `FLASH_TH_REMOTE_POSTCODES` — 49 REAL codes captured 18 Jul 2026 from flashexpress.co.th/th/fle/outer/remote; `isRemotePostcode`.

## Checkout wiring (commit 74dcaed) — server-side, pass-through money

- Migration `0055_sales_order_shipping_fee.sql` adds `sales_orders.shipping_fee_satang integer NOT NULL DEFAULT 0` (**collides with other branches' 0055 — renumber at merge**).
- `/api/checkout` computes the fee SERVER-SIDE (never trusts the client, same as pricing); remote determined via the entered/saved postcode; grand = subtotal − discount + shipping.
- **Shipping goes to `grand_total` + the new column ONLY, NOT `sales_satang`/profit** — a pass-through the customer pays. See [money-model-and-finance](money-model-and-finance.md) for the two-book rule.
- Returned as `CheckoutSuccess.shippingSatang` on both fresh and idempotency-replay paths.
- `/api/shipping/quote` = display-only estimate `{lines,postcode}→{shippingSatang,isRemote}`.
- Checkout page shows a live fee updating with the address (debounced cartKey+postcode effect, stale-response-safe); all "ส่งฟรี" (free shipping) copy/ribbons removed.
- Verified with exact values: compressor 5.8kg→฿77, +remote→฿127, volumetric-dominant condenser→฿50, 2×condenser cart aggregation 6.2kg→฿89.
- Admin display (commit ac48e52): `GET /orders` + `OrderRow` carry `shippingFeeSatang`; the AirPlus order table (`sales/AirPlusOrders.tsx`) has a Shipping column between Sales and Profit; Shopee `OnlineOrders.tsx` untouched.

## ⚠️ BLOCKER: volumetricDivisor:5000 is likely WRONG

Researched Jul 2026. The rate TIERS in `flashRates.ts` are VERIFIED CORRECT against Flash's "3/2568 – 1/2569" table (effective 3 Dec 2025) — all 20 tiers match the Bangkok-metro column exactly (25/30/34/35/50/61/77/89/104/116/135/158/168/181/192/204/222/233/245/257 baht). But **NO source supports /5000**:

- ส่งแบบมาตรฐาน (standard) uses size = W+L+H plain **SUM** matched to a cm column; price = higher of weight tier vs size tier; NO divisor.
- พัสดุขนาดใหญ่ / Flash Bulky uses (W×L×H)/**6000**.
- The published size column runs 40cm→150cm — a parcel whose three sides sum above ~150cm falls OFF the table (system quote / Bulky). That matters: condensers/radiators are that big.

Discriminating test the owner can run at flashexpress.co.th/fle/check-price: 1 kg at 30×30×30, same origin/dest — sum-of-sides predicts ฿89, /5000 predicts ฿77, /6000 predicts ฿61. **Get that result BEFORE trusting any quote**; then switch the engine to sum-of-sides or confirm /6000 for Bulky. A confident wrong quote is worse than an admitted gap.

## More rate-rule gaps (open)

- Pricing is **4-zone, not flat** (BKK metro / BKK↔province / same province / province→BKK) — BKK-metro-everywhere overcharges same-province by up to ~฿46 at 10kg and undercharges province→BKK by up to ~฿41 at 19kg; above 19kg (to 50kg) unpublished.
- Surcharges: remote +฿50 (in repo ✓); special tourism zones +฿30/+฿100/+฿200 by weight band and island +฿30 (**BOTH missing from repo**); COD 2.5%.
- Limits: standard max 50kg, each side ≤150cm, sum ≤280cm; Bulky up to 100kg, sum ≤400cm. Ignore 30kg/200cm figures online — that's Flash MALAYSIA.
- Public unauthenticated endpoints (don't hammer — Flash started refusing requests after repeated probing; cache the area table):
  - `POST https://www.flashexpress.co.th/webApi/tools/freightCharge` (params `express_category, weight, length, width, height, src_area, dst_area`; area = districtCode-postalCode e.g. `TH471705-50260`) — rate lookup needs NO account.
  - `GET /webApi/tools/getUpcountryAddress` returns the whole remote/tourism table with codes — far better for refreshing `FLASH_TH_REMOTE_POSTCODES` than scraping HTML.
- Booking/labels/pickup DOES need a merchant account (Open API mchId + SHA256-signed key, issued by Flash support).

## References

- `packages/core/src/shipping.ts`, `packages/core/src/flashRates.ts`
- commits 3aaacd6, 5f192a5, 74dcaed, ac48e52; migrations 0003, `0055_sales_order_shipping_fee.sql`
- `apps/storefront/src/app/api/shipping/quote`
- open-docs.flashexpress.com
- Related: [money-model-and-finance](money-model-and-finance.md) (shipping columns 0073, never-count-twice rule)
