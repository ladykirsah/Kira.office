---
type: guide
title: Platform — index
description: Entry point for the platform area — the three Cloudflare Workers, account/bindings, domains, staging, D1, local dev, and the code map
tags: [platform, index, cloudflare, workers]
timestamp: 2026-08-09
status: live
sources: [docs/knowledge/platform/]
---

# Platform

Everything about where and how this system runs: three Cloudflare Workers on one account, one D1 database shared by two of them, a domain consolidation with deliberate fallbacks, and the local/staging recipes that make it workable. Start with [three-workers](three-workers.md) if you're deploying anything.

- [three-workers](three-workers.md) — The three deployables (`kiraoffice` API — NO hyphen, `kiraoffice-admin`, `airplus-storefront`): script ids, bindings, cron, the DO-namespace naming deadlock, the env-inherits-routes hostname-theft incident, and the admin's same-origin proxy invariant.
- [cloudflare-accounts](cloudflare-accounts.md) — The GoGoCash account (`187ab61e…`), the owner's three CF accounts, lady.kirsah as the operational identity, the wrangler OAuth token's permission split (no DNS, no Access), and the custom-domain-attach API recipe.
- [domains](domains.md) — Why airplusauto.com and why it must live on GoGoCash; the six-host map; homeseeker.me's retiring fallbacks (the domain CAN lapse); the `isIndexableHost` exact-match invariant; derive-URLs-from-request (`adminUrlForApiHost`).
- [staging-stack](staging-stack.md) — Three staging Workers behind their own hostnames; why workers.dev is permanently off (the fixed-OTP hole); the storefront staging redeploy recipe with six gotchas; the staging D1's Frankenstein schema and seed rows (stale — re-verify).
- [d1-and-migrations](d1-and-migrations.md) — Prod/staging D1 ids; latest migration 0087 (new ones start at 0088); NEVER rename an applied migration (wrangler keys on filename); the BACKUP_TABLES bidirectional drift contract; schema.ts is a DRAFT, migrations are the truth.
- [local-dev](local-dev.md) — Blank `ACCESS_*` + `.env.local` → :8788 + local D1 migrations; per-worktree D1 state (the /orders-500 diagnosis); NO seed script exists; the load-prod-dump-via-Python trick (`wrangler d1 execute --file` fails on dumps).
- [storefront-architecture](storefront-architecture.md) — The storefront Worker's design (direct D1/KV, cross-Worker DO, fail-open checkout deduction); the force-dynamic rendering invariants and the `"use client"` 1-year-cache trap; the anti-dead-end checkout thesis.
- [code-map](code-map.md) — Monorepo/workspace layout (`@l-shopee/*`); the 4-channel model as code + DB CHECKs; the StockLedger DO is STATELESS (and which docs lie about it); the owner's 2026-07-16 locked decisions.

Adjacent areas: [operations](../operations/index.md) (CI/CD, deploy rules, migration timing, incidents) · [auth](../auth/index.md) (Cloudflare Access, requireAccess fail-open, staff logins) · [commerce](../commerce/index.md) · [back-office](../back-office/index.md) · [storefront](../storefront/index.md) · [conventions](../conventions/index.md).
