---
type: invariant
title: D1 migration discipline
description: Migrations are always manual, always BEFORE the merge; the numbering gap 0048–0052 is a live landmine on two parked branches.
tags: [d1, migrations, wrangler, deploy-order, staging]
timestamp: 2026-08-26
status: live
sources: [kira-office-deploy-paths.md, kira-financial-part-progress.md, kira-staging-blocked-on-access.md, kira-office-architecture.md, packages/db/migrations]
---

# D1 migration discipline

## The rule

**CI never runs `d1 migrations apply`. Migrations are always manual, and MUST be applied to prod BEFORE the merge.**

Why this order: additive columns are invisible to already-deployed code, but new code that SELECTs a column that doesn't exist yet 500s until the migration lands. Merge triggers auto-deploy ([ci-pipeline](ci-pipeline.md)), so migrate first, merge second. The inverse failure also happened once: migrations correct for NEW code were applied while STALE code was live (because deploys were silently skipping) and dropped columns broke it — the order rule protects both directions, but only if deploys actually ship (see [incidents-log](incidents-log.md)).

## Commands

```
# read-only dry run first — what has prod actually applied?
CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1 \
  npx wrangler d1 migrations list kira-office --remote

# apply (R1+, owner-gated)
CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1 \
  npx wrangler d1 migrations apply kira-office --remote
```

The account pin is mandatory (three accounts visible to the login — [prod-d1-access](prod-d1-access.md)). One old memory line cited account `8724aa41…` for this — **WRONG**; the correct account is `187ab61e…` (verified when applying 0064). Reads are safe (R2 tier); writes and `migrations apply --remote` are R1+ and owner-gated. Rollback safety net: **D1 Time Travel (30 days)**.

## Current state (2026-08-26)

- Repo migrations tip: **0090** (`0090_owner_recovery_key.sql`) in `packages/db/migrations/`.
- **Prod is applied through 0090** — verified 26 Aug 2026 by `migrations list --remote` (which showed 0090 as the
  only pending file, so prod already held 0076–0089) and then applying it: 7 commands, `users_recovery_lookup_unique`
  present in `sqlite_master`, 1 user row, 0 carrying a key. This line is a snapshot like the one below it was —
  **still run `migrations list --remote` rather than trusting it.**
- What the recent numbers carry, for reading a column back to its migration: 0068–0069 credit/status, 0071 claims,
  0072 staff note, 0073 shipping money, 0074 `slip_image_key`, 0075 `payment_expires_at`, 0077–0079 claims resolution,
  0080 Shopee sync, 0081 expenses, 0082–0086 staff auth, 0087 Insight, 0089 staff advances, 0090 the owner's emergency key.
- The stale note trap: comments inside old migration files can lie about current behaviour (e.g. the 0068 comment describes a credit model since rebuilt) — the migration is history, not documentation.

## The numbering gap 0048–0052 (blocked landmine)

Prod is migrated **past 0059 WITHOUT migrations 0048–0052** — those five exist only on the parked, unmerged `claude/airplus-returns` branch. If that branch ever merges, they would apply out of order — **the numbering must be linearized/renumbered before merging it**. Worse, the old on-site branch `claude/kira-office-tasks-b9b9c5` ALSO used numbers 0048–0051 with *different content* — a second collision to resolve. Standing rule: **check migration numbers against prod's `d1_migrations` table before merging any old branch.** (Those branches' other problems live in [back-office](../back-office/index.md) and [storefront](../storefront/index.md).)

## Staging drift is a recurring failure mode

Staging D1 (`kira-office-staging`) had drifted **5 migrations behind** (0056–0060) and was caught and applied 2026-07-22. Nothing keeps staging in sync automatically — when staging behaves oddly, check its migration level first. Staging apply uses the same commands with the staging database name; the staging stack itself is described in [staging-operations](staging-operations.md).

## Testing a migration before it goes anywhere

The relational test harness builds an in-memory sqlite from EVERY real migration file, so a broken migration fails tests locally. For a **data migration (backfill)** specifically: apply migrations up to the cut, insert rows, then apply the rest — the default `migratedDb()` applies everything up front and cannot see a backfill. Details in [testing-and-lint](testing-and-lint.md).
