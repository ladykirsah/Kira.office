---
type: database
title: D1 databases and migration discipline
description: Prod + staging D1 ids, the never-rename-an-applied-migration invariant, the BACKUP_TABLES drift contract, and why schema.ts is not the source of truth
tags: [d1, sqlite, migrations, wrangler, backups, schema]
timestamp: 2026-08-09
status: live
sources: [wrangler.jsonc, packages/db/migrations, "airplus-returns-branch-parked.md", "kira-audit-findings-2026-07.md"]
---

# D1 databases and migration discipline

## The databases

- **Production:** `kira-office`, database_id `2e88a362-ffd7-4255-b178-e511d475f687`. Bound as `DB` by BOTH the API Worker and the storefront Worker (a D1 db can be bound by multiple Workers) — one database, two writers.
- **Staging:** `kira-office-staging`, id `85f22f44-063d-424e-91ef-39e1fa1fef24`.
- `migrations_dir` is `packages/db/migrations`. Latest files as of 2026-08-09: `0084_lockout_window.sql`, `0085_pin_reveal.sql`, `0086_payslip_slip.sql`, **`0087_storefront_events.sql`** (highest), plus a `meta/` directory. **Any new migration must be numbered 0088+.**
- GHA never runs migrations — apply to prod with wrangler **BEFORE** merging. Deploy sequencing and the two doors to prod D1 (MCP connector vs wrangler CLI) live in [operations](../operations/index.md).

## INVARIANT: never rename an applied D1 migration file

Learned the hard way 2026-07-17 (done wrong once, reverted by another session). **wrangler's `d1_migrations` table keys on the FILENAME.** If a DB already applied `0048_campaign_kind.sql` / `0049_order_returns.sql` / `0050_customer_dob.sql` and you `git mv` them to 0053/0054/0055, wrangler sees three never-applied migrations and RE-RUNS them → `duplicate column kind` / `table order_returns already exists` → hard deploy failure. Mirror risk: a DIFFERENT file reusing an already-recorded name gets silently **SKIPPED**.

Correct renumber procedure — both halves or neither, done at merge time coupled with the deploy:

1. `git mv` the files.
2. On EVERY DB that applied the old names: `UPDATE d1_migrations SET name='<new>.sql' WHERE name='<old>.sql';`
3. Prod may need nothing — verify with `wrangler d1 migrations list`.
4. Fix stale in-code comments naming migration numbers: `apps/api/src/index.ts` BACKUP_TABLES note, `apps/storefront/src/app/account/page.tsx` (the since-deleted `schema.ts` carried four more at the time).

Historical context: the 2026-07 collision was 3-way — the returns branch's 0048/0049/0050 vs the on-site branch `claude/kira-office-tasks-b9b9c5` which owns 0048–0052 and lands first (per `docs/AIRPLUS_GO_LIVE.md` — a runbook that exists only on the unmerged go-live branch, not on main), so returns renumbers to 0053+. An earlier note saying "0050/0051" is WRONG.

## INVARIANT: BACKUP_TABLES must track migrations, in both directions

- Every table a migration **creates** must be added to `BACKUP_TABLES` (in `apps/api/src/index.ts`) — e.g. `order_returns` when 0049 lands. A bidirectional drift test in `apps/api/src/index.test.ts` fails if a migration creates a table the backup omits.
- Inverse trap: listing a **nonexistent** table kills the whole daily dump, because `runDailyBackup` has no try/catch — which is why `order_returns` was removed from the list when PR #20 landed without 0049. A missing table = the entire backup dies wholesale, not one table skipped.

## Migrations are the only schema truth (schema.ts is gone)

`packages/db/src/schema.ts` called itself a "representative subset / DRAFT", was missing live tables at the 2026-07-16 audit (`payments` 0031, `customer_history_entries` 0033), and nothing ever imported `@l-shopee/db` — no `drizzle()` call existed. The file — and the whole `packages/db/src/` directory — has since been **deleted**; `packages/db/` now holds only the migrations. The rule outlived the file: when reasoning about the real schema, **read the migrations directory**.

## Local D1 state

Each git worktree has its own local D1 (miniflare state under `<worktree-root>/.wrangler/state/v3`); fresh worktrees come up schema-less until you apply migrations. Recipes, the /orders-500 diagnosis, and the load-prod-data trick: [local-dev](local-dev.md).

## References

- Migration-before-merge rule + CI contract: [operations](../operations/index.md)
- Staging D1 contents: [staging-stack](staging-stack.md)
- Channel CHECKs baked into migrations 0025/0026: [code-map](code-map.md)
