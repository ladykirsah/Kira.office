---
type: feature
title: Checkout thesis & Thai address autofill
description: The anti-dead-end checkout product thesis, and the zip→ตำบล/อำเภอ/จังหวัด postcode autofill (checkout form still lacks it)
tags: [storefront, checkout, addresses, postcode, thai, ux]
timestamp: 2026-08-09
status: live
sources: [airplus-storefront-built.md, airplus-postcode-autofill.md]
---

# Checkout thesis & Thai address autofill

## Why it is this way: the anti-dead-end checkout

Owner brief 2026-07-10, from a 5-site competitor teardown: every Thai competitor's checkout dead-ends somewhere — forced Facebook login, re-entered data, bank account hidden until after commit, payment to a personal account, COD penalized ฿100, tracking via "save this link". AirPlus is deliberately the opposite:

- **Guest checkout** (phone + name) — no forced account.
- **Payment methods shown BEFORE commit** (PromptPay QR + bank transfer + COD).
- **COD equal + free** — no surcharge (the ~3% Flash COD fee is absorbed into margin, see [business-and-launch](business-and-launch.md)).
- **Tracking by phone + order number**, no magic links.

MVP priority order was: parts first, affiliate + SEO second, video last. Order-status lifecycle and payment mechanics live in [commerce](../commerce/index.md); stock deduction at checkout is described in [architecture](architecture.md).

## Postcode autofill (zip → ตำบล/อำเภอ/จังหวัด)

Built 2026-07-17 (originally on branch `claude/airplus-returns`; later ported to the launch branch for `/register/line`). Live in the shared address form.

- **Dataset**: earthchie/jquery.Thailand.js `raw_database.json` (MIT, 7,498 rows) compacted to `apps/storefront/public/thai-postcodes.json` as `{ "<zip>": [[tambon, amphoe, province], …] }` — 971 zips, ~624KB on disk / ~66KB gzipped; 175 zips span more than one อำเภอ (district).
- **Lib**: `apps/storefront/src/lib/thaiGeo.ts` — `resolvePostcode(map, zip)` (pure, unit-tested) + `loadPostcodes()` (memoized client-side fetch of the public JSON).
- **UX** (`AddressBook.tsx` → `AddressForm`): zip-FIRST field order — typing a 5-digit zip auto-fills จังหวัด + อำเภอ (still editable) and loads a ตำบล dropdown; picking a ตำบล refines อำเภอ/จังหวัด (handles multi-อำเภอ zips); unknown zips fall back to plain text inputs.

The owner's mental model for signup ("phone works like zip/จังหวัด" — familiar Thai form conventions) shaped the [line-login-and-auth](line-login-and-auth.md) registration flow, which uses this same zip-first autofill.

## Open items

- **Checkout form gap**: the checkout page has its OWN separate free-text address form (`checkout/page.tsx`, NOT the shared `AddressForm`) with NO autofill. Replicating the zip-first autofill there is a known follow-up — do it by reusing `thaiGeo.ts`, not by re-deriving the dataset.

## References

- `apps/storefront/public/thai-postcodes.json`
- `apps/storefront/src/lib/thaiGeo.ts`
- `apps/storefront/src/app/checkout/page.tsx`
