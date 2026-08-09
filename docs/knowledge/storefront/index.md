---
type: guide
title: Storefront knowledge index
description: Map of the AirPlus storefront concept files — architecture, features, branding, auth, content, and launch decisions
tags: [storefront, index]
timestamp: 2026-08-09
status: live
sources: [docs/knowledge/storefront/]
---

# Storefront knowledge index

The AirPlus storefront (airplusauto.com) — the customer-facing shop of the Kira.office system. One line per concept; open the file before touching its area.

- [architecture](architecture.md) — own Worker on the GoGoCash account, shared D1/KV, StockLedger DO cross-bind via `script_name`, force-dynamic rendering, bundled (not R2) banner/brand images.
- [checkout-and-addresses](checkout-and-addresses.md) — the anti-dead-end checkout thesis (guest checkout, payment-before-commit, COD equal) and the zip→ตำบล/อำเภอ/จังหวัด autofill; the checkout form still lacks the autofill.
- [brand-ci-design-system](brand-ci-design-system.md) — the final red DENSO CI (#e10000/#960101, blue #015abf trust-only), red=clickable/blue=emphasis, SectionHead pattern, system-first font stack with Thai-fallback ordering, the 17-glyph icon set, pill/discount-tag rules, ✦ empty-image star.
- [line-login-and-auth](line-login-and-auth.md) — LINE Login live (channel 2010753164) + runbook, the phone-NOT-NULL D1 invariant, ap_session architecture, PDPA consent invariant, deliberate registration-status disclosure, dormant OTP, parked 20+ age gate.
- [line-oa-help-routing](line-oa-help-routing.md) — the LINE OA help deep link (lin.ee/tltIFtI), the locked product→AirPlus / service→Den Air LINE routing rule, and the zbar QR-decode recipe.
- [navigation-and-header](navigation-and-header.md) — router.replace-for-filters convention, the InnerHeader back-arrow logic and its remount trap, the /search landing page, the PDP share action and its AbortError trap.
- [faq](faq.md) — /faq answer markup format, Design-A card, the category-UUID trap, and why `lib/faq.ts` is the warranty source of truth.
- [legal-policies-and-privacy](legal-policies-and-privacy.md) — the six policy docs and their storefront pages, the OPEN privacy-page draft that gates all new data collection, open legal items, and the policy-drift lesson.
- [cookie-consent](cookie-consent.md) — the built-but-parked PDPA consent banner on `claude/airplus-returns` and the tracker-gating rules for when it lands.
- [seo-and-agent-discovery](seo-and-agent-discovery.md) — SEO steps 1–7 (structured data, Thai slugs, sitemap, LocalBusiness, GSC), remaining owner levers, and the /llms.txt-family agent surfaces.
- [affiliate-tools](affiliate-tools.md) — affiliate categories + the /tools shelf page (design B), real-click ranking, the Thai slug `\p{M}` trap, unfiled-cards empty state.
- [business-and-launch](business-and-launch.md) — confirmed business facts, the Den Air separation and แท้ taxonomy, brand-naming numerology, and the locked lowest-cost launch verdicts (hide coupons, cut SMS-OTP, COD on).

Neighbor areas: [platform](../platform/index.md) (deployables, domains, local dev) · [operations](../operations/index.md) (deploys, migrations discipline) · [auth](../auth/index.md) (admin/staff auth — customer auth is HERE) · [commerce](../commerce/index.md) (orders, payments, refunds, coupons, shipping) · [back-office](../back-office/index.md) (products, stock, POS, Insight analytics) · [conventions](../conventions/index.md) (admin design system, working agreements).
