---
type: invariant
title: Worker vs database names — the config name must equal the live Worker
description: The api Worker is teampit-api (renamed in place from kiraoffice on 18 Nov 2026); Den Air's D1 database is teampit-denair (copied from kira-office on 18 Nov 2026). A config name that doesn't match the live Worker once produced a full-session deploy deadlock.
tags: [naming, wrangler, workers, d1, durable-objects]
timestamp: 2026-08-09
status: live
sources: [kira-office-deploy-paths.md]
---

# Worker vs database names — the config name must equal the live Worker

## The invariant

| thing | exact name |
|---|---|
| API worker | **`teampit-api`** — renamed in place in the dashboard on 2026-11-18 (was `kiraoffice`) |
| prod D1 database | **`teampit-denair`** (id `e609101c-78d3-4a80-94a6-0cc5d4625d17`, copied from `kira-office` 2026-11-18; GoGoCash account `187ab61ed9dbc6e616cb23e6b95aa8f1`) — also the npm workspace name |
| admin worker | `kiraoffice-admin` (parked; to delete) · back-office website `teampit-app` |
| storefront worker | `airplus-storefront` |
| staging D1 database | `kira-office-staging` (staging DOES have the hyphen; id `85f22f44-063d-424e-91ef-39e1fa1fef24`) |
| Durable Object namespace | **named** `kira-office_StockLedger` but **owned by Worker `teampit-api`** (the namespace keeps its old display name through renames) |

Verify anytime: `GET /accounts/187ab61e…/workers/scripts` (see [deploy-runbook](deploy-runbook.md) for the REST-listing technique).

## How to rename the api Worker (done 2026-11-18)

Rename it IN PLACE in the dashboard (Workers & Pages → the Worker → Settings → General → Name → Deploy) FIRST, then ship root `wrangler.jsonc` `name` + the storefront's `script_name` + CI's `Deployed <name>` check to match. Never the other way round: shipping a new name first creates a second, empty Worker (no secrets) that grabs the custom domains. Proven on two throwaway Workers the same day: the other Worker's binding keeps working before it redeploys, DO data and secrets carry over, and deploying the stale old name from AirPlus fails loudly with 10061 (nothing breaks silently).

## Why this is written down

The collision cost a full session: a 10065/10061 deploy deadlock. Root `wrangler.jsonc` said `name: "kira-office"`, so wrangler tried to CREATE a *second* worker whose DO migration collided with the existing `kira-office_StockLedger` namespace, while the storefront's `script_name: "kira-office"` binding pointed at a nonexistent script. Fix was a **one-line config rename, nothing destructive** (PR #30 era). The earlier theory — "orphaned DO namespace, delete it" — was **WRONG**; do not act on it if the symptom recurs. DO bindings resolve by `(script_name, class_name)`, not by the namespace's display name.

## StockLedger DO holds NO durable state

Verified 2026-07-20, re-verified 2026-08-09: the StockLedger Durable Object holds no durable state — no `ctx.storage`, no alarms — so D1 `stock_ledger_entries` really is the source of truth. Since `d08c921` (2026-07-26, "fix(stock): serialize the ledger DO") its **five** methods (`applySync`, `applyOnlineSale`, `applyAdjustment`, `applyHold`, `refundSale`) each wrap their work in `this.ctx.blockConcurrencyWhile(...)` on the one fixed instance (`idFromName('default')`) — a real mutual-exclusion lock, not just a routing hop. Useful the next time a "does the DO hold live stock state?" scare comes up — e.g. before deleting or migrating the namespace, the answer is: no state lives there, but the namespace must still exist for the lock to work.

## References

- `wrangler.jsonc` (root), `apps/admin/wrangler.jsonc`
- [platform](../platform/index.md) — bindings and account layout
