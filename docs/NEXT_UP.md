# Next up — parked work to catch up on

Owner is listing products (from 2026-07-20). These three are **deliberately parked**, not forgotten.
Nothing here blocks listing.

---

## 1. Payment verify (slip auto-confirmation)

**Status: BUILT, dormant. Needs one signup, ฿0.**

The whole flow already works:

- `apps/storefront/src/components/SlipUpload.tsx` — decodes the slip's mini-QR **on the customer's
  device** (jsQR on canvas, full size then downscaled). The image never leaves their phone.
- `apps/storefront/src/app/api/payments/slip/route.ts` — two modes:
  - SlipOK configured → auto-verify against the real bank transaction → payment confirmed, order paid.
  - Not configured → hold the payload for manual approval in admin `/payment`. **This is today's mode
    and it works.**
- Anti-reuse: one slip can only ever pay one order — partial `UNIQUE` index on `payments.slip_ref`
  (`packages/db/migrations/0034_payment_slip.sql:9`), not just app logic.
- Auth: (order ref, phone) pair with an identical 404 for wrong-ref and wrong-phone, so orders
  can't be enumerated.

**To activate:** sign up at slipok.com → set `SLIPOK_API_KEY` + `SLIPOK_BRANCH_ID` on the
`airplus-storefront` worker → test with a ฿1 order.

**Cost (checked 2026-07-20):** OK BASIC = **฿0/month, 100 slips**, then ฿1/slip. July volume was 25
orders, so the free tier is ~4× headroom. Paid tiers start ฿350/mo for 500 slips — not needed.

⚠️ `packages/core/src/payments.ts:27` marks the SlipOK wire format as **assumed, never run against
the live API**. Budget one round of fixing on first connection.

**Why not build it without SlipOK:** decoding the QR ≠ verifying payment — the QR only carries a
transaction reference, and a screenshot can be edited. Proving money arrived requires asking a bank,
which needs either a merchant API contract or a service like SlipOK. The free manual-approve path
already covers everything except that one check.

---

## 2. Shipping fee

**Status: calculation logic sound, rate basis UNCONFIRMED. Do not quote customers from it yet.**

- Packing rule is **confirmed and implemented** (owner's own rule, 2026-07-20): items stack on their
  largest face, so combined carton = `max(d1) × max(d2) × Σ(d3 × qty)`.
  See `packedParcelDims` in `packages/core/src/shipping.ts` — the owner's three worked examples are
  the test fixtures.
- Rate **tiers** in `packages/core/src/flashRates.ts` are verified correct against Flash's
  3/2568–1/2569 table (Bangkok-metro column).
- ❌ **`volumetricDivisor: 5000` is probably WRONG.** Research found Flash's *standard* service bills
  on the **sum of three sides** with no divisor; *Flash Bulky* uses `/6000`.
  **One lookup settles it** — flashexpress.co.th/fle/check-price, 1 kg at 30×30×30:
  ฿89 = sum-of-sides · ฿77 = /5000 · ฿61 = /6000.
- ❌ Pricing is **not flat nationwide** — four zone columns. Bangkok-metro everywhere overcharges
  same-province by up to ~฿46 and undercharges province→BKK by up to ~฿41.
- ❌ Tourism/island surcharges not implemented (remote +฿50 is).
- ⚠️ Real large parts (condensers, radiators) exceed the published table's 150 cm sum-of-sides cap —
  they may need Flash Bulky or a transport company (บขส.), not standard parcel.

**The commercial finding that matters more than the maths:** Shopee's contracted rate was ฿118 on a
radiator where Flash retail quotes ฿283 — but Shopee also took ฿434 in fees on that order. Absorbing
shipping is cheaper than Shopee's commission. Charging the customer Shopee's ฿118 and eating the
difference still nets ~฿269/order more than staying on Shopee. **Show customers a flat/free-over-X
rate; treat the courier cost as an expense, not a quote.** Building that setting is the real task.

---

## 3. Kira.office UX/UI

Ongoing. Done so far: Product categories card (title + photo + warranty in one form), add-forms that
respond instead of silently doing nothing, 1:1 cover crops.

**Known gap — the structural one:**
`PART_TYPE_EN` and `CAR_BRAND_TH` (`apps/storefront/src/lib/labels.ts`) are hardcoded maps, so a new
category gets no English sub-line and a new car brand no Thai name, and neither is editable in admin.
`PART_TYPE_EN` is keyed by **Thai** names while live categories are stored in **English** — so it
currently matches nothing and every category tile already renders with a blank sub-line.

**Fix:** promote to `name_en` on `product_types` and `name_th` on `car_brands`, edited in the cards
that already carry photo + warranty. The `services` table already has the `name_en` pattern to copy.
This gap grows with every category and brand added, so it is worth doing before the catalog is large.

Also open, from the 2026-07-20 storefront audit (all HARDCODED, none admin-editable): the entire FAQ,
policy pages (returns/terms/privacy — two still carry `TODO(owner)` and DRAFT headers), shop NAP +
opening hours, SEO title/description, home trust tiles and section headings, footer (which renders on
the home page only, so inner pages have no route to /returns or /terms).

---

# Backlog — agreed 2026-07-20, to start after the next weekly reset

Owner's list, in their words, with the context needed to pick each one up cold.

## AirPlus (storefront)

**Replacing FAQs.** The FAQ is 27 Q&As hardcoded in `apps/storefront/src/lib/faq.ts:73-252` and is
also emitted as `FAQPage` JSON-LD (`faq.ts:255`), so it feeds Google AI Overviews — every wording
fix currently needs a deploy. It also contradicts other pages: warranty prose there vs
`product_types.warranty_days` on the PDP, a hardcoded product-type UUID at `faq.ts:176`, and a phone
number that differs from `lib/business.ts:17` and `app/returns/page.tsx:143`. Making it
admin-managed fixes the drift as well as the editing.

**Suggested / related products on the product detail page.** New feature. Note `product_fitments`
already gives a natural relation (same car brand/model), as does `type_id` — related-by-fitment is
likely more useful to a mechanic than related-by-category.

## Kira.office (admin)

**Marketing center.** Consolidation: banners, coupons, campaigns/flash sales and affiliate tools are
four separate settings screens today.

**AirPlus homepage re-ordering.** Section order and every section heading are hardcoded JSX in
`apps/storefront/src/app/page.tsx` (headings at :98, :117, :151-156, :165, :174-176, :184, :208).
Owner wants to control order — and presumably visibility — from admin.

**Product grouping setup for product collections.** Group products into named collections the
storefront can render as a row/page.

**Auto-apply product naming.** Directly follows the naming pattern agreed 2026-07-20:
`[ประเภทไทย] [ชื่อเรียกอีกแบบ] [ยี่ห้อรถ] [รุ่นหลัก] | [ยี่ห้ออะไหล่] [แท้] [รหัส]`
e.g. `ตู้แอร์ คอยล์เย็น Toyota Vigo วีโก้ / Fortuner / Innova / Altis | Denso แท้ TG447610-7290`.
Rules settled with the owner: part-type first (Thai buyers search `[อะไหล่]+[รถ]`, so front-load it);
include BOTH common Thai part names; 3-4 top car models only, the rest live as fitment rows; years
belong in fitment rows, NOT the title (a single year like "Fortuner 2005" reads as fits-2005-only and
causes returns); one separator. One product per part code — two brands of the same part are two
products, six car models are six fitments on each. See also the sibling Terms-pattern idea.

**Affiliate tool.** Extends `/settings/affiliate-items` (today: title, image, price text, target URL
→ `/tools` page + home shelf).

---

Still parked from earlier the same day, above: payment verify, shipping fee, Kira.office UX/UI.
