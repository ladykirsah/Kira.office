---
type: guide
title: Blockers
description: Things that stop revenue or stop merges. Most need an owner action in a dashboard, not code.
tags: [state, blockers, owner-action]
timestamp: 2026-08-09
status: blocked
sources: [airplus-prod-catalog-is-demo-data.md, airplus-cannot-take-payment.md, airplus-privacy-page-gap.md, kira-onsite-branch-holds-bugs.md]
---

# Blockers

## 1. The production catalog is demo data (longest-lead item)

airplusauto.com serves ~6 demo products to real customers — a skincare cream is publicly
visible as a top best-seller on a car-parts shop. Building the real catalog is owner work
(photos, prices, fitment) and has been the standing longest-lead blocker since the
2026-07-19 go-live. Nothing in code blocks it.

## 2. AirPlus cannot take money

The KV key `shop:airplus:paymentMethods` is **unset in prod**, so the storefront checkout
has no PromptPay QR. COD works; everything else waits on the owner entering the receiving
account in admin. Note the deliberate separation: `shop:denair:paymentMethods` **is** set
(the on-site workshop's account — value lives in KV, not in this repo) and the storefront
must never fall back to it — two businesses, two money streams
([commerce](../commerce/index.md)).

## 3. Privacy page gap

A PDPA privacy page draft exists but omits LINE-data handling and has a TODO for the
data-rights contact. Owner sign-off needed before it ships
([storefront](../storefront/index.md)).

## 4. Branch `claude/kira-office-tasks-b9b9c5` must NOT merge

A 4-reviewer audit (2026-07-17) found three critical stock-holds bugs. Bugs 1 and 3 are
fixed on the branch (`4d02180`, `961e129`); **Bug 2 is a design trap** — the bill path's
unconditional hold close *is* the double-bill guard (`hold_already_billed`). Making the
close conditional requires `qty_used` to become additive AND re-inventing double-bill
protection (two phones finalizing the same bring-back draft could each deduct stock). The
obvious narrow fix — reject bills that don't settle the hold — is also wrong: it breaks the
legitimate mechanic-keeps-2-overnight flow. Before touching it, trace the
draft/finalize/`client_uuid` lifecycle and work out what actually protects double-billing.
The shipped alternative to this branch's reservation model is the two-bucket on-hold design
in `docs/SCAN_HERE_SPEC.md` ([back-office](../back-office/index.md)).
