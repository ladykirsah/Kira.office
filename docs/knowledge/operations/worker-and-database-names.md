---
type: invariant
title: Worker vs database names — the kiraoffice / kira-office trap
description: The API worker script id has NO hyphen; the hyphenated name is the D1 database. Confusing them once produced a full-session deploy deadlock.
tags: [naming, wrangler, workers, d1, durable-objects]
timestamp: 2026-08-09
status: live
sources: [kira-office-deploy-paths.md]
---

# Worker vs database names — the `kiraoffice` / `kira-office` trap

## The invariant

| thing | exact name |
|---|---|
| API worker script id | **`kiraoffice`** — NO hyphen |
| prod D1 database | **`kira-office`** (id `2e88a362-ffd7-4255-b178-e511d475f687`, GoGoCash account `187ab61ed9dbc6e616cb23e6b95aa8f1`) — also the npm workspace name |
| admin worker | `kiraoffice-admin` |
| storefront worker | `airplus-storefront` |
| staging D1 database | `kira-office-staging` (staging DOES have the hyphen; id `85f22f44-063d-424e-91ef-39e1fa1fef24`) |
| Durable Object namespace | **named** `kira-office_StockLedger` but **owned by script `kiraoffice`** |

Verify anytime: `GET /accounts/187ab61e…/workers/scripts` (see [deploy-runbook](deploy-runbook.md) for the REST-listing technique).

## Why this is written down

The collision cost a full session: a 10065/10061 deploy deadlock. Root `wrangler.jsonc` said `name: "kira-office"`, so wrangler tried to CREATE a *second* worker whose DO migration collided with the existing `kira-office_StockLedger` namespace, while the storefront's `script_name: "kira-office"` binding pointed at a nonexistent script. Fix was a **one-line config rename, nothing destructive** (PR #30 era). The earlier theory — "orphaned DO namespace, delete it" — was **WRONG**; do not act on it if the symptom recurs. DO bindings resolve by `(script_name, class_name)`, not by the namespace's display name.

## StockLedger DO holds NO durable state

Verified 2026-07-20, re-verified 2026-08-09: the StockLedger Durable Object holds no durable state — no `ctx.storage`, no alarms — so D1 `stock_ledger_entries` really is the source of truth. Since `d08c921` (2026-07-26, "fix(stock): serialize the ledger DO") its **five** methods (`applySync`, `applyOnlineSale`, `applyAdjustment`, `applyHold`, `refundSale`) each wrap their work in `this.ctx.blockConcurrencyWhile(...)` on the one fixed instance (`idFromName('default')`) — a real mutual-exclusion lock, not just a routing hop. Useful the next time a "does the DO hold live stock state?" scare comes up — e.g. before deleting or migrating the namespace, the answer is: no state lives there, but the namespace must still exist for the lock to work.

## References

- `wrangler.jsonc` (root), `apps/admin/wrangler.jsonc`
- [platform](../platform/index.md) — bindings and account layout
