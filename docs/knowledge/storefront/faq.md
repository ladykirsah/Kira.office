---
type: feature
title: FAQ page — format, design, and warranty source of truth
description: The /faq answer markup format, the Design-A card, the review-loop workflow, and why lib/faq.ts is the warranty source of truth
tags: [storefront, faq, content, warranty, returns, thai, markup]
timestamp: 2026-08-09
status: live
sources: [airplus-faq-format.md, airplus-policy-docs-2026-07.md]
---

# FAQ page — format, design, and warranty source of truth

## Shipping status

Shipped 2026-07-20: PR #25 merged (main `51ea02d`), migration 0056 applied to prod D1, storefront deployed (version fcb5c733), verified at airplusauto.com/faq (FAQPage schema renders). The content itself is the owner-reviewed 34-question rewrite in 7 sections (from a 38-question plan) via branch `claude/airplus-faqs-a83c5e`.

Files: `apps/storefront/src/lib/faq.ts` + `components/FaqAnswer.tsx` + `app/faq/page.tsx` (+ `FaqHashOpener.tsx` for hash-open behavior).

## Answer markup format

Answers are plain strings with a tiny markup language:

- `\n` lines; lines starting `N. ` → numbered steps
- `{b}…{/b}` → blue emphasis (non-clickable)
- `{l:/path}…{/l}` → red underlined link
- `{r}` exists in the parser but must NOT be used in content (red = clickable only — see [brand-ci-design-system](brand-ci-design-system.md))
- JSON-LD strips markup via `faqAnswerPlainText` (tested)
- In-page card links: `{l:#<anchorId>}` + `faqAnchorId` + `FaqHashOpener`

## Card design (Design A — owner-tuned, do not redesign)

`.card.faq-item` — no marker triangle; right chevron (shared Icon, rotates 90° when open, same as the PDP `CollapsibleSection`); NO red left accent (owner explicitly removed it). Owner-tuned weights: highlights color-only (no bold), links fontWeight 500 + underline, summaries semibold 600, card border `#e3e3e3` scoped to `.faq-item`. The owner rejected panel/icon/tinted-block redesigns. Overline has no emoji.

## Category deep links — UUID trap

Category links inside answers use `/products?type=<id>&ctx=cat`. กรองอากาศ (air filter) links the stable seeded `pt-air-filter` (seeded by migration `0056_air_filter_type` precisely so answers can deep-link the category), but กรองแอร์ (cabin filter) links an admin-created UUID `11f5177c-…` — **RE-CHECK that UUID when the real catalog replaces the demo one.**

## faq.ts is the warranty SOURCE OF TRUTH

The owner's final warranty + change-of-mind rules were locked in the FAQ merged to main (PR #25); the policy-branch claim doc was stale at the time. The rules:

- **Warranty = 2 cases**: (a) transit damage → 100% within 3 days with photos; (b) defect → part-only, no labor.
- **Per-category windows**: electronics 1 month; small parts + consumables transit-only; fluid-system parts (e.g. ตู้แอร์, หม้อน้ำ) 3 เดือน conditioned on "ติดตั้งอย่างถูกต้อง" (= clean system, correct method).
- **เปลี่ยนใจ (change of mind) post-receipt = NOT returnable.**
- **สั่งผิด (wrong order) 3-way**: cancel-only → no; shop-recommended-wrong → exchange with all shipping on the shop OR full refund; own mistake → exchange, split shipping, price difference settled.

Both dependent surfaces were synced with owner approval: storefront `/returns` in commit `ff98b5b` on `claude/brave-almeida-e59405`, and `claim-returns-warranty-policy.md` (TH+EN, new §3) in commit `a6537a8` on the policy branch — **neither was pushed at the time**; verify before assuming they landed. Outstanding legal items from this change (ToS gaps, cooling-off question, returns-branch conflicts) are tracked in [legal-policies-and-privacy](legal-policies-and-privacy.md).

## Workflow that produced it (reusable)

One Q&A at a time → owner edits → re-check on preview → next. Content review with this owner works best in that loop, not in bulk drops.

## References

- PR #25, migration 0056 (`0056_air_filter_type`)
- `apps/storefront/src/lib/faq.ts`, `components/FaqAnswer.tsx`, `app/faq/page.tsx`
