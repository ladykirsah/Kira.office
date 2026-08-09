---
type: convention
title: Navigation, back button, search page & share action
description: The router.replace filter convention, the InnerHeader back-arrow logic and its remount trap, the /search landing page, and the PDP share action
tags: [storefront, navigation, router, history, search, share, ux]
timestamp: 2026-08-09
status: convention
sources: [airplus-back-nav-convention.md, airplus-search-page.md, airplus-share-action.md]
---

# Navigation, back button, search page & share action

## Back-nav convention (owner-set 2026-07-12)

The header back arrow means **"go back to the previous PAGE"**, not "undo my last in-page action".

**RULE 1 — filters replace, never push.** Every in-page filter/refinement on `/products` uses `router.replace` (or `<Link replace>`) — quick-chips, the ตัวกรอง (filter) sheet Apply, empty-state reset. Genuine page-to-page navigation stays a push. The original bug: home → products(all) → products(Toyota) → PDP walked back through each filter state because filter clicks were pushes. Apply this to any NEW filter/sort control on listing pages (the affiliate `/tools` chip bar already follows it — see [affiliate-tools](affiliate-tools.md)).

**RULE 2 — back must not dead-end.** `InnerHeader` (root layout, mounts once) pins the entry path + entry `history.length` in refs; `goBack = (navigated || grew || pathname !== entryPath) ? router.back() : router.push("/")`, where `grew = history.length > startLen` and `navigated` is a `sessionStorage["ap:navigated"]` flag set on the first pathname change.

- **2026-07-13 robustness fix**: the mount-pinned refs are FRAGILE to a remount — a hard refresh or cold deep-link mid-session reset them and back wrongly went HOME. sessionStorage survives remounts and is empty only on a genuinely fresh tab; the refs remain as a storage-blocked fallback.
- **Do NOT gate on `pathname === entryPath` alone** — the first attempt did, and re-visiting the entry path later in the session matched the check, making back skip the real previous page.
- Known accepted edge: after a forward-then-back round-trip to the true cold-entry page, back leaves the site (App Router `history.state` carries no index).
- Verified by browser E2E, deliberately NOT by unit tests — asserting push-vs-replace call sequences is an anti-pattern (tests implementation, not behavior), and the repo has no jsdom/RTL.

## /search landing page (built 2026-07-13, TDD-first)

`apps/storefront/src/app/search/`. Sections:

1. 🔥 **ค้นหาบ่อย · Popular chips** — TRAP: the owner relabelled these from "Recent" but the DATA is still the recent-search store. Label only. Make it truly frequency-ranked if บ่อย ("often") should mean most-searched.
2. 🚗 **Car-brand logo tiles** — `object-fit: cover`, `minmax(0,1fr)` grid, logos from `CAR_BRAND_LOGO` (bundled assets, see [architecture](architecture.md)), ✦ fallback.
3. ✨ **6 suggested ProductCards** — pure + tested (`lib/suggest.ts`): new visitor → `suggestionPool` head (on-sale→best→latest); returning visitor → `rerankByInterest(pool, viewedProductIds, interestedTypes, 6)` with already-viewed items as filler to keep the grid full on a small catalog.

Recent searches: `lib/recentSearches.ts`, localStorage key `airplus.search.v1`, pure `nextRecentSearches` (trim / case-insensitive dedupe / cap 8), recorded from BOTH the /search bar and the home `SearchBox`. The home SearchBox is a tap-to-open LINK to /search (Shopee pattern — no inline typing on home). /search has its own sticky orange `SearchLandingBar`; `InnerHeader` early-returns on /search.

A11y guardrails: the input placeholder must stay `--gray-mid` (WCAG AA); `.search-go` keeps a 36px disc with a 44px `::before` hit area.

## PDP share action

Share icon (feather share-2, stroke 1.8, 21px) sits between search and cart in `InnerHeader`, shown only on `/products/*` detail pages.

- `lib/share.ts` (TDD): `shareOrCopy(navigator,{title,url})` tries the Web Share API (native sheet → LINE/Messages), falls back to `clipboard.writeText`, returns `'shared'|'copied'|'cancelled'|'unsupported'`, total (never throws). **Reuse `shareOrCopy` for any future share button.**
- **AbortError trap**: user dismissing the share sheet → `'cancelled'` with NO silent clipboard copy. Matched on `.name` alone because a real AbortError is a `DOMException` and NOT `instanceof Error`.
- `productShareTitle` strips the " — AirPlus" suffix that `generateMetadata` appends.
- Toast = `.ap-toast` class in globals.css (dark `--gray-dark` pill under the header, `role=status`/`aria-live=polite`, respects reduced-motion); copy shows "คัดลอกลิงก์แล้ว", failure "ไม่สามารถแชร์ได้ ลองอีกครั้ง".

## References

- `apps/storefront/src/app/InnerHeader.tsx`, `components/ProductFilter.tsx`
- `apps/storefront/src/app/search/`, `src/lib/recentSearches.ts`, `src/lib/suggest.ts`, `src/lib/share.ts`
