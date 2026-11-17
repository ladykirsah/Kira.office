---
type: feature
title: Coupons — real system, mock wallet, latent redemption bug
description: Admin coupons (typed code at checkout) vs the hardcoded storefront wallet mock; max_uses_per_customer >1 silently pinned to 1 by migration 0052's unique index
tags: [coupons, storefront, admin, mock, bug]
timestamp: 2026-11-17
status: live
sources: [kira-coupon-overhaul-and-date-field.md, kira-coupon-wallet-is-a-mock.md, kira-onsite-branch-holds-bugs.md, plan 8.7 (17 Nov 2026)]
---

# Coupons

## Two DISCONNECTED coupon systems (verified 26 Jul 2026)

**REAL**: admin `/settings/coupons` → `coupons` table (migrations 0044 + 0061 `max_discount`). `code NOT NULL UNIQUE` is the customer-facing identity; a coupon is applied ONLY by **typing the code at AirPlus checkout** (`validateCoupon`). POS has NO coupon concept at all.

**MOCK**: storefront `/coupons` (`AvailableCoupons.tsx`) + `/account/coupons` (`MyCoupons.tsx`) + `lib/coupons.ts` — `ALL_COUPONS` = **6 HARDCODED fakes** (AIRPLUS100, SAVE10, FREESHIP, SHIP30, WELCOME150, BIG500); the "wallet" = localStorage key `airplus.collectedCoupons`; the "ใช้" (use) button just COPIES the code to the clipboard, applies nothing.

Consequence: a no-code coupon cannot flow through this at all. "No-code / click-to-use coupons" is a real rebuild project: real active-coupons API on `/coupons`, member-scoped collected-coupons backend, checkout apply-by-id, admin optional-code toggle (`code` → nullable = SQLite table rebuild). The owner ABANDONED the coupon-form redesign on 26 Jul once this mock was surfaced ("unnecessary for now").

## Coupon admin overhaul (built 26–27 Jul 2026 on claude/kira-office-preview-ux-a54ab2)

- `coupons.name` = admin-only label (migration 0065, nullable + backfill=code), REQUIRED on new coupons (POST 400 + form guard), never shown to customers.
- Add form re-sectioned; relabels: Min subtotal→"Min spent", Max uses→"Quota", Per customer→"Usage for user".
- Coupon list = expandable rows (car-model pattern): collapsed = chevron · Name · Discount · Active toggle; expanded = 3-column view + Edit (everything except Code, via PATCH) + Delete.
- Expired coupon (end passed) → toggle off + disabled + greyed via `isCouponExpired`.
- **Status caveat**: the memory body says NOT deployed at write time; the memory index later records it live Jul 27 — verify against prod before relying on either. Deploy path when needed: migration 0065 first → API `kiraoffice` → admin `kiraoffice-admin` (no storefront). See [operations](../operations/index.md).

## Latent bug: max_uses_per_customer > 1 silently pinned to 1

The admin coupon field allows `max_uses_per_customer` with min=1 and no max, and core honours values >1 — but **migration 0052's UNIQUE index on `coupon_redemptions` pins the effective cap to 1**, so a legitimate 2nd redemption wrongly returns "already used". Prod had 0 coupons when checked, so the index applied cleanly — fix before the owner creates multi-use coupons.

Related trap: `isDuplicateRedemptionError` (`apps/storefront/src/lib/db.ts`) is a substring match on `/coupon_redemptions/i` that returns BEFORE the only `console.error` — during migration drift, a "no such column/table: coupon_redemptions" error silently becomes a friendly Thai "you already used this coupon" 409 with nothing logged. Fix: match `/UNIQUE constraint failed:.*coupon_redemptions\.customer_id/i` and log unconditionally.

(The same bug-hunt branch flagged non-coupon items — `staff_name_uq` UNIQUE-on-name, PATCH /staff treating omitted fields as values, `fetchStaff().catch(() => {})` silently unattributing holds — those belong to the staff/holds work; see [back-office](../back-office/index.md) and [auth](../auth/index.md).)

Also note the coupon usage-cap race (read-then-insert) tracked on the parked returns branch — [refunds-and-returns](refunds-and-returns.md).

## The real coupon list for the website + แสดงบนเว็บ (plan 8.7, 17 Nov 2026)

Server side only; the website's coupon pages stay the mock above until the AirPlus redesign (board 11).

- **แสดงบนเว็บ** (`coupons.show_on_web`, migration 0104, owner's pick A): a switch on CrewEngine's
  coupon form (โค้ดและสิทธิ์), off for every coupon until the owner turns it on; off = code only, so a
  code handed to one person stays private (like Shopee's shop-page vouchers vs code-only ones). A
  ลูกค้าใหม่ coupon has no switch: it lands on My coupons, never on the list. The coupon's page shows
  แสดง / ไม่แสดง.
- **`GET /api/coupons`** (storefront, open to everyone): switched-on, แสดงบนเว็บ coupons that can be
  used right now — started, not ended, not used up, with a use left for the signed-in customer
  (`listWebCouponRows` → `webCoupons` in `lib/couponCart.ts`). Ending soonest first.
- **`GET /api/account/coupons`** (My coupons) now also sends each coupon's `name`, its `targets`
  (brand / category / car model / product names) and `forLine`.
- **`forLine`** — "สำหรับทุกออเดอร์ · สำหรับสินค้า DENSO · สำหรับลูกค้าใหม่" — is `couponForLine` in
  `@l-shopee/core`, the same words CrewEngine's coupon card says.
- Customers still use a coupon by typing its code at checkout; `/api/checkout` checks it all again.

## References

- migrations 0044, 0052, 0061, 0065
- `apps/admin/src/app/settings/coupons/page.tsx`
- `apps/storefront/src/lib/coupons.ts`, `apps/storefront/src/lib/db.ts`
- Shared `DateTimeField` shipped with the same overhaul (see [conventions](../conventions/index.md))
