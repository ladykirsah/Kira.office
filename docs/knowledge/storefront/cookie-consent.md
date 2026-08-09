---
type: feature
title: PDPA cookie-consent banner (parked)
description: Built consent banner + lib/cookieConsent.ts on the parked claude/airplus-returns branch; tracker gating rules for whenever it lands
tags: [storefront, pdpa, cookies, consent, privacy, parked]
timestamp: 2026-08-09
status: parked
sources: [airplus-cookie-consent.md]
---

# PDPA cookie-consent banner (parked)

## What it is

A PDPA-compliant cookie-consent banner, BUILT 2026-07-17 per `docs/policies/cookie-policy.md` §3 + PDPC 2565 guidance — but it lives on the parked branch **`claude/airplus-returns`**, not main. Building it was the prerequisite for publishing the cookie policy doc (see [legal-policies-and-privacy](legal-policies-and-privacy.md)).

Owner picked **Design B** (friendly non-blocking bottom sheet, no cookie wall) as the default + **Design C** (per-category toggles, dimmed backdrop) as the ตั้งค่า (settings) mode.

## How it works

`lib/cookieConsent.ts` (pure, TDD, 12 tests):

- `CookieConsent` shape: `{necessary:true, analytics, marketing, thirdParty, at, version}`
- localStorage key `airplus.cookieConsent.v1`; bumping `CONSENT_VERSION` forces re-consent
- `CONSENT_EVENT` fires on write (future trackers listen); `OPEN_SETTINGS_EVENT` re-opens Design C from the footer
- **Opt-in**: analytics/marketing/thirdParty all OFF by default; ยอมรับทั้งหมด (accept all, red) and ปฏิเสธทั้งหมด (reject all, black) get equal visual weight per PDPA
- SSR-safe: renders nothing until mounted

Components: `components/CookieConsent.tsx`, `app/cookies/page.tsx`.

## Invariants & traps

- **No trackers exist yet.** When a tracker is added it MUST gate on `hasConsent(readStoredConsent(), category)` and (de)activate on `CONSENT_EVENT`.
- `app/privacy/page.tsx` §6 claims "necessary cookies only, no ads" — true today, but it contradicts the cookie policy's categories and MUST be updated when trackers land.
- Consent is client-side localStorage only — server-side PDPA evidence logging is a known follow-up.
- **Why main doesn't need it (yet)**: the AirPlus Insight analytics shipped later on main was deliberately designed to avoid needing this banner at all — a day-rotating visitor hash, no persistent identifier (see [back-office](../back-office/index.md); never rotate TRACK_SALT).

## References

- `claude/airplus-returns` branch: `apps/storefront` `lib/cookieConsent.ts`, `components/CookieConsent.tsx`, `app/cookies/page.tsx`
- `docs/policies/cookie-policy.md` (policy branch)
