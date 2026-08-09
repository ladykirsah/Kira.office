---
type: convention
title: AirPlus red CI & storefront design system
description: The final red DENSO-style palette, color semantics (red=clickable, blue=trust), fonts, icon set, pills, and typography kit
tags: [storefront, ci, branding, design-system, colors, fonts, icons, thai]
timestamp: 2026-08-09
status: live
sources: [airplus-final-red-ci.md, airplus-ci-font-lock.md, airplus-headline-pattern.md, airplus-icon-set.md, airplus-info-tag-convention.md, airplus-faq-format.md]
---

# AirPlus red CI & storefront design system

This is the STOREFRONT design system. The admin back office has its own, separate design system — see [conventions](../conventions/index.md). Do not mix them.

## The final palette (locked 2026-07-16)

The owner (a DENSO representative) locked a red DENSO-style CI, moving OFF the earlier coral `#eb5031` — it was too close to their own Shopee shop's `#ee4d2d`. Roles:

| Color | Role |
|---|---|
| `#e10000` bright red | PRIMARY: header bg, sale badge, CTAs, ribbon, active carousel dot, ของแท้ hero highlight, PROMOTION/sale price |
| `#960101` dark red (`--brand-deep`) | Deep accent: regular price accents, ดูทั้งหมด links, shortcut-bar icons, hover/pressed states |
| `#000000` black | The "+" in the Air+Plus wordmark (red+black pop, Netflix-style), headings, nav circle, CollapsibleSection chevrons |
| white | Cards |
| `#ebebeb` (`--paper`) | Page background |
| `#bbbbbb` | Dividers, struck-through price |
| `#737373` | Muted text |
| `#015abf` blue (`--brand-blue`) | HIGHLIGHT ONLY — Car-Fitment context, แท้ 100% trust badge, PDP fitment ✓ checks, PDP info-meta icon frames at `rgba(1,90,191,0.1)`, the PDP consult rail, ใส่ตะกร้า secondary CTA. Keep it sparing. |
| `#1a7f37` green (`--ship`) | Status พร้อมส่ง ("ready to ship") — semantic, deliberately separate from brand colors |

Header = bright red (owner chose over dark-red after seeing both). Applied via commit `86cf48a` on `claude/airplus-publication-plan-08e4c7`, deployed with go-live. All stray hardcoded coral rgba values were swept: `rgba(235,80,49,*)→rgba(225,0,0,*)`, `rgba(198,33,0,*)→rgba(150,1,1,*)`. The PDP `AddToCartBar` was redesigned in the same pass: blue trust rail on top, quiet ghost help button ("หาอะไหล่"), blue ใส่ตะกร้า, red ซื้อเลยตอนนี้.

### Open item (point-in-time 2026-07-18, may be resolved)

Three hero/promo banner PNGs still had the old coral ribbon baked in: `public/banners/hero-1.png`, `hero-2.png`, `promo-1.png` (served via `HeroCarousel <img>`). They are raster — code cannot recolor them. Owner chose option A: THEY re-export in red and re-upload. Check the live banners before touching this.

## Color semantics (owner-defined, apply everywhere)

- **RED text = clickable only.** Never style plain text red — the owner flagged it as "seems clickable". **BLUE = non-clickable emphasis.** This rule originated in the FAQ work but applies across the whole storefront.
- Blue is NEVER used on section overlines/labels — it is reserved for trust highlights (แท้ badge, PDP fitment checks, consult rail). The owner reviewed a blue Car-Fitment overline vs dark-red and chose dark-red for consistency (2026-07-16).

## Section headline pattern (SectionHead — locked)

Every storefront section headline uses ONE pattern (`SectionHead` in `apps/storefront/src/app/page.tsx`), no per-section color variation:

- Overline `.t-overline` in `var(--brand-deep)` (#960101), format "emoji TH · EN" (e.g. 🚗 ยี่ห้อรถ · Car Fitment)
- Title `.t-h2` in `var(--gray-dark)`
- Optional link "ดูทั้งหมด →" in `var(--brand-deep)`, weight 400, 13px
- Exception: on a colored/dark section background (Flash Sale) the overline flips to white `rgba(255,255,255,.9)` — a legitimate contrast case.

## Fonts (invariant — Thai fallback ordering is critical)

Owner chose "system stack, Prompt fallback" 2026-07-10 — this REVERSES an earlier Prompt-primary decision (Prompt-as-body broke the CI match; owner: "font look nothing like CI").

- `globals.css` `--font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", …` with OS Thai fonts (`"Thonburi","Krung Thep","Leelawadee UI","Noto Sans Thai"`) listed BEFORE `var(--font-prompt)`.
- **Why ordering matters**: SF Pro has no Thai glyphs; per-glyph fallback picks the first Thai-capable family. Since the storefront actually loads Prompt, Prompt hijacks Thai rendering unless the OS Thai fonts come first.
- **How to verify**: MEASURE rendered Thai width — a span in `--font-body` must equal Thonburi (~663px @ 40px), not Prompt (~689px). Checking the declared font-family string is NOT enough; this exact regression repeated on 2026-07-10.
- **Perf, keep it**: `layout.tsx` loads Prompt with `preload: false`. The default `preload: true` was preloading ~24 woff2 files on every page for a font real devices never render; `preload: false` keeps the fallback via lazy `@font-face` and dropped preloads 24 → 0.

## Component kit rules (from the locked CI kit audit, wf_6dbdd6cc-072 → 71 fixes)

- Empty/failed product images render the brand-orange **✦ star** (fontSize 44; 24 for thumbs) — never "ไม่มีรูป…" text.
- ALL typography uses the `.t-*` scale classes — no ad-hoc inline font-size/weight.
- Prices use `.t-price-l` / `.t-price-m` (brand-deep) + `.t-price-strike`.
- Buttons use the `.btn` system, sizes S/M only.
- Section heads use the `t-overline` (brand-deep) eyebrow + `.t-h2`.

## Icon set (one shared thin-line set — never re-inline SVGs)

Owner hand-picked one design per interface icon via an interactive picker (2026-07-13). Source of truth: `src/components/icons/registry.ts` — 17 glyphs: back, search, cart, profile, share, truck, check, coupon, wrench, chat, orders, address (= HOUSE, not map-pin — owner swapped), filter, close, trash, logout, chevron — rendered by `src/components/Icon.tsx` as `<Icon name size />`. All ~34 previously hand-inlined SVGs across 18 files were swapped.

Balance model:

- ONE line weight `ICON_STROKE = 1.8`, rendered as constant screen-px via `.ap-icon :is(path,rect,circle,line,polyline,polygon){ vector-effect: non-scaling-stroke }` in globals.css — 1.8px looks identical at 13px and 32px.
- Optical size normalized per-glyph via scale/cx/cy in the registry (`glyphTransform` scales about 12,12 then re-centres; scales ~0.9–1.22; scaling does not change line weight).
- Color = `currentColor`; icons `aria-hidden` by default (the enclosing button/link owns the accessible name).
- New icon → add stroke-only markup to the registry and tune scale in a browser balance check. Do NOT hand-inline SVGs.
- Deliberately OUTSIDE the set: the 3 home trust-strip badges, the PromptPay QR, the ✦ empty-image spark, and emoji heading decorations.

## Info tags / pills (owner-set 2026-07-12)

- **Gray pill** = descriptive detail (category e.g. คอยล์เย็น, brand e.g. DENSO): color `var(--gray-mid)`, background `rgba(115,115,115,0.12)`.
- **Green pill** = status พร้อมส่ง: color `var(--ship)`, background `rgba(5,150,105,0.12)`.
- **KEY RULE (owner insight)**: every pill's fill is a TRANSLUCENT tint of its own text color at ~12% — never solid — so the chip darkens whatever surface it sits on and stays visible on both a white card AND the `--paper` page bg. (A solid `--paper` fill was the original bug: it vanished on the PDP. A border attempt was reversed. The tint is the accepted fix.)
- One shape via `components/Pill.tsx` (font 10.5 / weight 400 / padding 2px 9px / radius 999 / nowrap); `BrandTag` wraps the gray pill, `ReadyToShip` the green.
- **Discount-% tag**: ONE canonical design = OUTLINE pill (brand-deep text + 1px brand-deep border, no fill, "-N%") via `components/DiscountTag.tsx` — takes `priceSatang` + `compareAtSatang`, self-guards to real markdowns. Used inline next to the price on card AND PDP. Do NOT reintroduce a filled discount badge.
- STILL SEPARATE (corner-on-image overlays, deliberately left filled for photo contrast, pending an owner call): `FlashRail` `.fl-badge -N%` and the ส่งฟรี/ลด corner ribbons.

## References

- `apps/storefront/src/app/globals.css`, `apps/storefront/src/app/layout.tsx`, `apps/storefront/src/app/page.tsx`
- `apps/storefront/src/components/icons/registry.ts`, `Icon.tsx`, `Pill.tsx`, `DiscountTag.tsx`
- `apps/storefront/src/app/products/[id]/AddToCartBar.tsx`
- Brand NAMING (numerology rules): [business-and-launch](business-and-launch.md)
