---
type: guide
title: Release history and current main
description: The 2026-07-19 go-live, the domain move, and the last ten merged PRs — the deploy lineage an agent needs to know what is actually live.
tags: [releases, deploy-history, go-live, main]
timestamp: 2026-08-09
status: live
sources: [airplus-production-golive-2026-07.md, git log (branch hunt, 2026-08-09)]
---

# Release history and current main

## Go-live, 2026-07-19

The AirPlus storefront went LIVE at **airplusauto.com** on 2026-07-19 — deployed at the owner's explicit "go live" instruction (after being warned of the risks), worker `airplus-storefront`, Version e212cc60, prod D1 `kira-office`, **from the UNMERGED branch `claude/airplus-publication-plan-08e4c7`** via `npm run deploy` in `apps/storefront` (default env = prod). Verified live: red DENSO CI (`--brand #e10000`), blue accents, LINE-first login, QA text removed. At go-live the demo catalog was still customer-visible; other then-open blockers: confirm Flash rate-card numbers, set PromptPay/bank in admin, legal sign-off, re-export red-CI banner PNGs (current status of these: [commerce](../commerce/index.md), [storefront](../storefront/index.md)). The **deploy-on-request-only rule still holds** for all future deploys.

Same session, API + admin were deployed to `api.homeseeker.me` and `admin.homeseeker.me` (admin `kiraoffice-admin` Version fd67775f, behind Cloudflare Access "Super Admin Only", both on GoGoCash `187ab61e…`). **Those hosts are STALE**: everything moved to airplusauto.com on Jul 21 (single-domain move — [platform](../platform/index.md)), and the canonical API script id is `kiraoffice`, no hyphen ([worker-and-database-names](worker-and-database-names.md)). At the time both workers were ahead of main until PR #24 merged, while Workers Builds still auto-deployed the API from main — a deploying-≠-merging era that ended with the CI hardening ([ci-pipeline](ci-pipeline.md)). The benign custom-domain re-assert failure on API deploys was first observed here and persists by design ([deploy-runbook](deploy-runbook.md)).

## Last ten merged PRs on main (as of 2026-08-09)

HEAD is `7fe11e9` on branch `hunt` (clean tree). Newest first:

| PR | commit | what |
|---|---|---|
| #129 | 7fe11e9 | staff: admins are never locked out for 24 hours; mechanics still are |
| #126 | b417f16 | Day-off submission (ลาแบบ, leave request) — inline editing, delete reserved to the owner |
| #128 | aa218ad | Unverifiable credentials: say the login needs resetting, don't call it wrong |
| #125 | 559b506 | ci: deploy the storefront on merge — "merged" means live for all three apps |
| #124 | 193744f | AirPlus Insight — Shopee-parity analytics, with the profit Shopee can't show |
| #123 | fc8434d | Fix staff PBKDF2 at 100k rounds — Workers refuses higher; every prod login 500'd at 210k |
| #121 | 8e050dd | Per-staff logins, HR and wage slips, require a slip before an order is paid |
| #120 | 3526392 | Admin menu grouped by real function, Shopee block always on |
| #119 | bb8c249 | Edit AirPlus Finance orders on the order-detail page |
| #118 | 0bc5863 | Finance rework — channel expenses, POS reprint lock, table polish |

Just below: #117 Den Air directory search by bill number, #116 drop monospace fonts, #115 Sales→Finance rework, #113 "Update on Shopee" stock-reconcile worklist, #111 dashboard notifications.

Since PR #125, every merge to main auto-deploys all three apps — so this list is also the live-prod lineage. Migration cadence example from the financial wave (PRs #86–#92, migrations 0068–0075, `SUPER_ADMIN_EMAILS` set Jul 31): migrations always landed on prod BEFORE the merge, per [d1-migration-discipline](d1-migration-discipline.md); feature detail lives in [commerce](../commerce/index.md).
