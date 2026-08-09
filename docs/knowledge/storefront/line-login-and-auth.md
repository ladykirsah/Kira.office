---
type: feature
title: LINE Login & storefront customer auth
description: LINE Login end-to-end, the phone-NOT-NULL D1 invariant, ap_session architecture, PDPA consent gate, dormant OTP, and the parked age gate
tags: [storefront, auth, line, oauth, pkce, pdpa, otp, sessions, d1]
timestamp: 2026-08-09
status: live
sources: [airplus-line-login-build.md, airplus-staging-preview.md, airplus-registration-age-gate.md]
---

# LINE Login & storefront customer auth

This is CUSTOMER auth on the storefront. Staff/admin auth (Cloudflare Access, PBKDF2 logins) is a different world — see [auth](../auth/index.md).

## LINE Login (live end-to-end on airplusauto.com)

LINE Login (web) replaced SMS-OTP as the primary login, chosen for cost (see [business-and-launch](business-and-launch.md)). **Channel ID 2010753164** — a LINE Developers *Login* channel, NOT the paid/verified OA, NOT a LIFF mini app.

- Config: `LINE_CHANNEL_ID` var in `apps/storefront/wrangler.jsonc` (top-level + staging); `LINE_CHANNEL_SECRET` set by the owner via `wrangler secret put` per env (name only — value never in repo).
- Routes:
  - `GET /api/auth/line/start` — state + PKCE S256 → LINE, scope `openid profile`
  - `GET /api/auth/line/callback` — state-cookie CSRF (its OWN CSRF mechanism, because `guardMutation` forbids state-changing GETs and an OAuth callback is inherently a GET redirect); exchanges code; find-or-create by `line_user_id`; new user → `/register/line`
  - `POST /api/auth/line/register`, `GET /api/auth/line/pending` (`peekLinePending` reads KV without consuming)
- Core helpers: `packages/core/src/lineLogin.ts` (`pkceChallengeS256` verified against the RFC 7636 test vector, `buildLineAuthorizeUrl`, `decodeJwtClaims` — the id_token is decoded, not re-verified, because it arrives over TLS directly from LINE's token endpoint) + `apps/storefront/src/lib/lineAuth.ts` (`exchangeCodeForIdToken` holds the secret; KV pending-state stash/take).
- Key commits: 5cf4813, 50a2238, e766b8d, 52c755b, 93d34fe, 1144350; staging worker version 6c287c32, prod d52b7cf9.

**RUNBOOK for any future LINE Login channel**: the launch blocker was LINE-side — a 400 at LINE's own consent screen. Fix = set Privacy policy URL (`https://airplusauto.com/privacy`) AND Terms URL (`https://airplusauto.com/terms`) in the channel settings, AND flip the channel Developing → **Published** (instant for a Login channel, no review). Skip either and the consent screen 400s. GoGoCash's one-tap "Continue as" is a browser-LINE-session/LIFF behavior, not a code difference.

## HARD INVARIANT: `storefront_customers.phone` cannot be made nullable

Verified 2026-07-18 on staging: a table-rebuild migration (`PRAGMA defer_foreign_keys=ON` + copy/drop/rename) to drop NOT NULL from `storefront_customers.phone` (attempted as migration 0037:7) was ROLLED BACK by D1 — "FOREIGN KEY constraint failed... DB was reset" (4 incoming FKs: `addresses`, `sales_orders`, `storefront_sessions`, `coupon_redemptions`). Migration 0041's own comment warns the same.

Consequence baked into the LINE design: **no phone-less customer ever exists**. Phone + PDPA consent are collected on ONE screen right after LINE sign-in (`/register/line`) instead of at checkout. Because of this, nothing downstream needed changing — `SessionCustomer.phone` stays non-null, (ref,phone) guest order tracking via `api/orders/lookup` still works, slip upload via `api/payments/slip` still works — and NO migration was required.

Locked signup flow (owner's model: "phone works like zip/จังหวัด"): LINE → username (pre-filled from the id_token `name` claim, editable) → phone + delivery address (zip-first autofill, see [checkout-and-addresses](checkout-and-addresses.md); address optional but must be complete if started) → PDPA consent LAST (right above submit) → done. The register API **rejects an already-taken phone** rather than linking without verification.

Also discovered in that session: **staging schema has DIVERGED from prod** (staging has `date_of_birth` from the parked returns branch; prod doesn't) — part of the migration-linearization mess, see [operations](../operations/index.md).

## Session & route architecture

- Cookie `ap_session` (`lib/authCore.ts`): token stored SHA-256-hashed in `storefront_sessions`, 90-day lifetime, issued by `createSession` (`lib/auth.ts`); `getSession` returns `SessionCustomer` with `phone: string` non-null.
- Auth routes under `apps/storefront/src/app/api/`: `auth/otp/send`, `auth/otp/verify`, `auth/me`, `auth/logout`, `account/addresses*`, `coupons/check`, plus the `line/*` routes above.
- DB was LINE-ready before the build: `storefront_customers.line_user_id` + partial-unique index `storefront_customers_line_uq` (migration 0041; that migration also added `facebook_id`, `password_hash`, `status`).

### Dormant OTP path

`OtpLogin` shows the phone/OTP path ONLY when `NEXT_PUBLIC_OTP_ENABLED="1"`; otherwise just the LINE button. The SMS seam `lib/sms.ts` (ThaiBulkSMS → Twilio → dev-echo via `OTP_DEV_ECHO=1`) is dormant, no key in prod — a ฿0 fallback kept deliberately. GOTCHA: staging's mock OTP login (0123456789 + 123456) is unreachable via UI unless `NEXT_PUBLIC_OTP_ENABLED=1` is set. Remember `NEXT_PUBLIC_*` is baked at build time (see [platform](../platform/index.md)).

## PDPA consent invariant

**No session is ever issued for an account that never gave PDPA consent.** In `POST /api/auth/otp/verify`: `if ((!existing || existing.pdpaConsentAt === null) && pdpaConsent !== true) → 400 {requiresConsent}`. This applies to ANY account without a consent timestamp, not just brand-new phones — the gotcha it caught was a demo row seeded with `pdpa_consent_at = NULL` logging straight in under the old `!existing`-only check. **Any seeded/demo `storefront_customers` row MUST set `pdpa_consent_at`** or it hits the consent gate at login. Consent is enforced via `pdpa_consent_at`; no session without it.

## Registration gate reveals registration status (owner decision — do not "fix")

2026-07-13, the owner REVERSED the anti-enumeration design: `POST /api/auth/otp/send` takes `mode: 'login'|'register'` and looks up the phone AFTER the throttle. login mode + unregistered → `404 {notRegistered:true}` (no OTP sent); register mode + already-registered → `409 {alreadyRegistered:true}` (no OTP). The owner accepted the account-enumeration tradeoff for a clearer login-vs-register split; probing remains rate-limited by per-phone/per-IP throttles + Turnstile. `OtpLogin` shows a tab-switching nudge that keeps the phone filled. Do NOT restore identical-response behavior without asking the owner.

## Registration age gate (parked — skipped for launch)

The whole 20+ age-gate build lives ONLY on the parked `claude/airplus-returns` branch — NOT on launch branch `claude/airplus-publication-plan-08e4c7` (verified: only marketing copy in `how-to-order/page.tsx` mentions age 20). Owner DECIDED 2026-07-18 to SKIP it: AC parts aren't age-restricted; revisit only if a credit/installment feature needs it.

Implementation details (for whoever revives it):

- `@l-shopee/core` `age.ts` (TDD, 11 tests: `ageInYears` + `isAtLeastYears`; ISO YYYY-MM-DD, UTC, invalid/future dates fail-closed).
- Migration `0050_customer_dob.sql` adds `storefront_customers.date_of_birth` text NULLABLE (legacy accounts not blocked retroactively).
- Server-authoritative in BOTH OTP routes: `otp/send` (register mode) rejects under-20 BEFORE sending the SMS; `otp/verify` re-checks + requires name and stores name + DOB at account creation.
- `OtpLogin.tsx`: birthday as 3 dropdowns วัน/เดือน/ปีพ.ศ. (Buddhist year − 543 → ISO); optional address step gated on `compact` (shown at /login, skipped in the /checkout embed which has its own address flow).
- `apps/storefront/src/lib/dob.ts` (`toDobIso` + `daysInBeMonth`) clamps the day dropdown to the real month length — 31 Feb was pickable and surfaced as a FALSE "must be 20+" error.
- **Deploy dependency**: `/account` SELECTs `c.date_of_birth`, so 0050 must be applied to a DB BEFORE deploying this build or `/account` 500s. Demo account 0123456789 has DOB=NULL, so `account/page.tsx` has a `DEMO_DOB` code fallback (0123456789 → 1997-03-20).
- **COUPLING TRAP**: the returns branch also rewrote the Terms/Privacy pages to say DOB IS mandatorily collected. If the returns branch merges but the age gate stays dropped, the policy pages will again mismatch the code — reconcile at merge. See [legal-policies-and-privacy](legal-policies-and-privacy.md).

### Phase 2 (not started)

LINE Mini App (LIFF) — needs a SEPARATE "LINE MINI App" channel + LINE review (days) + `NEXT_PUBLIC_LIFF_ID`. Post-launch.

## References

- `packages/core/src/lineLogin.ts`, `apps/storefront/src/lib/lineAuth.ts`, `lib/authCore.ts`, `lib/auth.ts`, `lib/sms.ts`, `lib/dob.ts`
- `apps/storefront/wrangler.jsonc`, `components/OtpLogin.tsx`
- migrations 0037, 0041, 0050 (0050 parked)
