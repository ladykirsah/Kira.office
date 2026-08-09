---
type: guide
title: Operations — index
description: CI/CD, deploy paths, D1 migration discipline, prod D1 access, incident history, and the testing/lint rules CI enforces.
tags: [operations, index, ci, deploy, d1, incidents]
timestamp: 2026-08-09
status: live
sources: [docs/knowledge/operations/]
---

# Operations

Read this area before deploying, migrating, or diagnosing production. One line per concept:

- [ci-pipeline](ci-pipeline.md) — the four GitHub Actions jobs, their loud-failure contract, what a green check does NOT prove, and the npm scripts they run.
- [deploy-runbook](deploy-runbook.md) — manual per-app deploys (`.env.local`-aside procedure), benign deploy noise, and how to verify a deploy actually landed.
- [worker-and-database-names](worker-and-database-names.md) — INVARIANT: worker `kiraoffice` (no hyphen) vs D1 database `kira-office`; the DO-namespace deadlock this once caused; StockLedger DO holds no state.
- [d1-migration-discipline](d1-migration-discipline.md) — migrations are manual, always BEFORE the merge; the 0048–0052 numbering landmine; staging drift; Time Travel rollback.
- [prod-d1-access](prod-d1-access.md) — the TWO independent doors into prod D1 (MCP connector + wrangler CLI); try both before declaring prod unreadable; account and database ids.
- [next-public-env-trap](next-public-env-trap.md) — TRAP: `NEXT_PUBLIC_*` is inlined at build; the 16-hour localhost outage and the three guards that now prevent it.
- [staging-operations](staging-operations.md) — the three staging hosts, why staging login is impossible by design, X-Robots-Tag vs Cloudflare's injected robots.txt, drift checks.
- [testing-and-lint](testing-and-lint.md) — the real-migrations sqlite test harness, the prettier+ESLint gate, and the pre-push habits that keep CI green.
- [incidents-log](incidents-log.md) — every production incident with root cause and the standing rule it produced (silent-skip deploys, wildcard route shadowing, localhost bake, transient R2 10001, bug hunt, missing storefront job, secrets near-misses).
- [release-history](release-history.md) — the 2026-07-19 go-live, the homeseeker→airplusauto move, and the last ten merged PRs on main.

Adjacent areas: [platform](../platform/index.md) (the deployables, bindings, domains, local dev), [auth](../auth/index.md) (Access + staff login), [conventions](../conventions/index.md) (working agreements, TDD, R-tiers).
