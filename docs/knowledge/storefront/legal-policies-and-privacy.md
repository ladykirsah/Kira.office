---
type: plan
title: Legal/policy docs & the privacy-page gap
description: The six policy docs and their storefront pages, the open privacy-page draft that gates new data collection, open legal items, and the policy-drift lesson
tags: [storefront, legal, policies, pdpa, privacy, terms, returns, thai]
timestamp: 2026-08-09
status: open
sources: [airplus-policy-docs-2026-07.md, airplus-privacy-page-gap.md, airplus-registration-age-gate.md, airplus-returns-pages-and-warranty.md]
---

# Legal/policy docs & the privacy-page gap

## The six policy docs (parked branch `claude/airplus-policy-0adda6`)

Drafted for AirPlus (operated by บริษัท เด่นแอร์ เซอร์วิส จำกัด / Den Air Service Co., Ltd.), with heavy per-doc Q&A at the owner's request. Live in `docs/policies/` on the policy branch — **NOT merged as of 2026-07-16; check before assuming the path exists on main.** The .md docs remain the source of truth for the rendered pages; reconcile when that branch merges.

1. `cookie-policy.md` — bilingual; the consent banner was a build prerequisite (since built, but itself parked — see [cookie-consent](cookie-consent.md)).
2. `terms-of-service.md` — B2C only; 20kg order weight cap; 3-case cancellation; pricing-error clause; **NO exclusive-jurisdiction clause** because Thai consumer law voids those — OCPB mediation instead.
3. `internal-data-handling-policy.md` — staff-facing 3-tier access: Super Admin = shop owner, 1 shared login used by 2 people, sees everything; Admin sees only shipping label + ordered product; Mechanic sees no customer data. (Roles model detail: [auth](../auth/index.md).)
4. `privacy-notice-pdpa.md` — PDPA §23 notice with a care-pass checklist.
5. `claim-returns-warranty-policy.md` — per-product warranty window shown on each product page; 3 mechanic-inspection outcomes: 100% / partial X% / 0% rejected.
6. `credit-score-rule.md` — INTERNAL-ONLY 5-tier COD-risk design (Star > Good > Watch (Super-Admin approval for COD) > Bad (no COD, prepaid ok) > Block; new customers start Good). A design doc, never implemented as such — the SHIPPED customer-credit model on main differs; see [commerce](../commerce/index.md).

### Storefront pages (applied 2026-07-17 via a 6-agent audit)

`/cookies`, `/privacy` (REWRITTEN to the authoritative doc incl. the trust-score→auto-reject-COD disclosure, fixing a §6 cookie contradiction), `/terms` (REWRITTEN; card-payment language trimmed since checkout doesn't offer cards), and a NEW `/returns` — all rendered via shared `components/PolicyDoc.tsx`. `credit-score-rule` and `internal-data-handling` are deliberately NOT pages (internal only).

## /returns + /how-to-order content pages (live)

Committed 2026-07-18 on `claude/airplus-publication-plan-08e4c7`, commit `9c3bc45`:

- `apps/storefront/src/app/returns/page.tsx` ("การคืน ยกเลิก เคลม") **mirrors** `docs/policies/claim-returns-warranty-policy.md` so it can't drift from the lawyer's review; carries a DRAFT header.
- `how-to-order/page.tsx` = the real OTP→address→pay→track flow (note: written pre-LINE-first; check copy).
- The PDP gained a returns `CollapsibleSection` + a 🛡️ ระยะเวลารับประกัน · N วัน details row; checkout gained a "ซื้อได้อย่างมั่นใจ" note linking `/returns`.
- Follow-up: these pages are NOT yet linked from the footer/info page — a discoverability gap.

A later fix made `/returns` state the flat `RETURN_WINDOW_DAYS` and the real LINE hand-off, with the page IMPORTING the constant so text can't drift from the rule (it had promised per-category windows + photo uploads that weren't built).

## OPEN: the privacy page is a self-declared draft — and it gates all new data collection

`apps/storefront/src/app/privacy/page.tsx` still carries a "DRAFT — for owner review BEFORE launch" comment and an unresolved `TODO(owner)` for the data-subject-rights contact channel (PDPA §30–33 requirement). It declares four data categories (name, phone, address, order history), but registration has stored a **LINE user id + display name** since the LINE-first launch — never mentioned; the page is also written for phone-OTP while signup is LINE-first. The owner was offered a fix 2026-07-21 and chose **"flag only, I'll handle it"** — a decision, not an oversight.

Consequences deliberately baked into code:

- `marketing_consent_at` (migration 0058) exists with an admin toggle, but NOTHING asks customers for it — no storefront checkbox was built, precisely so nothing undisclosed gets collected. Wire the checkout checkbox only once the page is updated.
- The trust/credit tier stayed unbuilt on the storefront for the same reason.

**GOVERNING RULE**: PDPA wants disclosure BEFORE collection. Before building anything that collects new customer data on AirPlus, check whether the live privacy page covers it; if not, SAY SO rather than shipping the collection.

## Open legal items (as recorded 2026-07-19)

- ToS §7 lacks the 3-day transit-damage window; ToS §8 still lists post-receipt เปลี่ยนใจ (contradicting the locked FAQ rules — [faq](faq.md) is the source of truth).
- A lawyer must rule on Thai distance-selling 7-day cooling-off vs the no-change-of-mind rule.
- The parked returns branch's orders page offers เปลี่ยนใจ as a claim reason AND has its own `/returns` page that will conflict on merge.
- Launch gates recorded for the policy pages: build-or-trim undisclosed features (trust-score COD gating, marketing profiling, SlipOK), replace placeholder domain (DONE — airplusauto.com), Thai PDPA lawyer review, name the SMS OTP provider.
- **Rule**: when the user references any policy, READ the current file — this document is a map, not a substitute.

## Lesson: policy pages encode the OLD plan and nothing type-checks them

When a design decision changes, re-read the policy pages. Case study: the pages were written when the age design was a self-declaration tickbox; the build changed to mandatory stored DOB, and Terms §2 literally said "เราไม่เก็บวันเดือนปีเกิดของท่าน" (we don't collect your birthdate) on the same screen that forced one; Privacy §2/§3 called DOB "ไม่บังคับ" (optional). Both rewritten in commit `03c67f5` (PDPA s.23 notice-at-collection). The same pass fixed `/returns` (above) and a validation hole: `otp/verify` validated the name with a bare `!name`, bypassing the shared `displayNameError` rules that `accountProfile.ts` exists to enforce — now uses the shared rules + stores the normalized name.

The same coupling trap is pending again: the parked returns branch rewrote Terms/Privacy to say DOB is mandatory, but the age gate was dropped for launch — see [line-login-and-auth](line-login-and-auth.md).

## References

- `docs/policies/` on `claude/airplus-policy-0adda6`; `components/PolicyDoc.tsx`
- `apps/storefront/src/app/privacy/page.tsx`, `returns/page.tsx`, `how-to-order/page.tsx`
- commits `9c3bc45`, `03c67f5`, `ff98b5b` (on `claude/brave-almeida-e59405`), `a6537a8`; migration 0058
