---
type: convention
title: Storefront Home v2 layout conventions
description: The AirPlus home page's 13-section merchandised feed, the 16px gutter system, and section-eyebrow rules
tags: [storefront, airplus, layout, home, design-system]
timestamp: 2026-08-09
status: live
sources: [airplus-storefront-built.md]
---

# Storefront Home v2 layout conventions

Layout conventions for the AirPlus storefront home page. Feature detail and branding live in [storefront](../storefront/index.md); this file records the layout/ordering conventions an agent must not break when touching `apps/storefront/src/app/page.tsx`.

## CI history

The initial teal/Anuphan design was fully replaced 2026-07-11 by the coral "Confident Retail" CI (`--brand` #eb5031, `--brand-deep` #c62100, `--accent-soft` #ffe8e0, `--radius` 16) + a system-first font stack (SF Pro + Thonburi). Note: the **FINAL red DENSO CI** later supersedes coral (approved, not yet in code at last record — see [storefront](../storefront/index.md)).

## Home section order (`page.tsx` > `.home-sections`)

1. **Quick-access shortcut bar** — "Design 2" framed white toolbar (`QuickAccessBar.tsx`) STRADDLING an orange backdrop (`.qa-section::before`, `height: calc(50% + 16px)`). Shortcuts: คูปองส่วนลด (coupons) → `/coupons` · ติดตามคำสั่งซื้อ (track order) → `/orders` · เครื่องมือช่าง (mechanic tools) → `/tools` · ช่วยหาอะไหล่ (help me find a part) → LINE OA.
2. Hero carousel
3. Categories — bilingual `.cat-card` (`lib/labels.ts` `PART_TYPE_EN`)
4. By-brand — bilingual `.cat-card` (`CAR_BRAND_TH`)
5. Flash sale (`Countdown` variant=boxes)
6. Best-sellers (`BestSellerList` medals + ยอดขายเฉลี่ยต่อเดือน "avg monthly sales" from `bestSellers()`)
7. On-sale `CollectionRow`
8. New arrivals
9. Promo banner
10. `AffiliateShelf` rail → `/go/:id`
11. Trust strip
12. LINE/FB
13. `RecentlyViewed`

## Layout rules

- `.home-sections` = flex column, gap 28px.
- **EVERYTHING aligns to a 16px page gutter**: `main.wrap` padding 16; horizontal scroll rows use `scroll-padding-inline: 16px`.
- Section eyebrows = "ไทย · English" in Title Case (`.t-overline` 12px, **no** uppercase transform).
- `/coupons` is a STUB page that exists so the shortcut never 404s (the real coupon wallet is a mock — see [commerce](../commerce/index.md)).
