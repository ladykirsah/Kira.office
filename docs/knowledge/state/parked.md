---
type: guide
title: Parked work
description: Deliberately deferred work — the reason it waits and the condition that resumes it. Parked is a decision, not neglect.
tags: [state, parked, deferred]
timestamp: 2026-08-09
status: parked
sources: [kira-parked-followups-2026-07.md, airplus-slip-autoverify-parked.md, airplus-returns-branch-parked.md, airplus-line-login-build.md, stock-full-track-roadmap.md, terms-description-pattern-feature.md, product-naming-pattern-feature.md, auto-shipping-fee-calc.md, kira-staff-mechanic-section-plan.md, kira-dashboard-notifications-plan.md]
---

# Parked work

`docs/NEXT_UP.md` keeps the maintained technical detail for the first three — read it before
resuming any of them.

| Item | Why it waits | Resumes when |
| --- | --- | --- |
| **Slip auto-verify (SlipOK)** | Built and dormant; manual approve covers today's volume at ฿0 | Owner signs up at slipok.com, sets `SLIPOK_API_KEY` + `SLIPOK_BRANCH_ID` on the storefront Worker, ฿1 live test (wire format has never run live — expect one round of fixes) |
| **Shipping fee quoting** | Rate tiers verified but `volumetricDivisor: 5000` is likely wrong — Flash bills on the **sum** of three sides. Do **not** quote customers from it | Owner's 30×30×30 Flash price lookup. Commercial note: absorbing shipping beats Shopee's ~22.5% fee — the real feature is flat/free-over-X, not a perfect quote engine |
| **name_en / name_th columns** | `PART_TYPE_EN` / `CAR_BRAND_TH` hardcoded maps block admin-managed categories/brands | Prioritised UX work ([back-office](../back-office/index.md)) |
| **Returns branch `claude/airplus-returns`** | Cancel/return/claim + migrations 0048/0049 built pre-launch, never merged; the shipped defect-claim flow (#95–#97) took a different path | Only mine it for ideas — reconcile against the live claims flow first ([commerce](../commerce/index.md)) |
| **LINE Login** | Core OAuth done (`5cf4813`); blocked on `phone NOT NULL` decision and the owner's LINE channel credentials | Owner provides the channel; decide the phone-column relaxation |
| **Stock full-track Phase 2 (Shopee)** | Needs the owner's sample Shopee stock export to design against | Owner exports the file |
| **Terms↔description + naming patterns** | Owner wants per-product Terms/naming pattern generation built **last**, together | Owner calls for it |
| **Staff & Mechanic section phases 2–3** | Payroll and mechanic-approves-returns planned; phase 1 (logins, HR, slips, day-off) is live | Owner prioritises |
| **Dashboard notifications/shortcuts** | Plan agreed (surface action stages via `fetchOrders`/`operationalStatus` building blocks); not started | Next build slot |
| **Staging preview** | workers.dev disabled on both staging Workers (2026-07-21) | Needs an Access-gated hostname to reopen |
| **Backlog (agreed, unscheduled)** | FAQ replacement (27 hardcoded Q&As already contradict PDP warranty days), PDP related products, marketing center, homepage re-ordering, product grouping, affiliate tooling | Owner prioritises |
