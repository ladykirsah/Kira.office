---
type: convention
title: Testing and lint rules as they hit CI
description: The relational sqlite test harness, the prettier+ESLint lint gate, and the pre-push habits that keep the CI build check green.
tags: [testing, vitest, sqlite, eslint, prettier, ci]
timestamp: 2026-08-09
status: convention
sources: [kira-financial-part-progress.md, no-eslint-in-repo.md, run-lint-before-push.md, package.json]
---

# Testing and lint rules as they hit CI

## The relational test harness (reuse it)

`apps/api/src/index.test.ts` builds a **real in-memory sqlite from EVERY real migration file** (`node:sqlite` `DatabaseSync`) instead of the repo's older `makeDb` SQL-substring mock — the mock returns canned rows and *cannot catch a broken join*. Its `asD1` shim implements `batch()` as a **REAL transaction** because `createClaim` relies on atomicity.

- To test a **DATA migration (backfill)**: apply migrations up to the cut, insert rows, then apply the rest — `migratedDb()` applies everything up front and so cannot see a backfill.
- Reuse this harness for any relational/API work; do not add new tests on the substring mock.

Runner: `npm test` = `vitest run` (also `test:watch`, `test:coverage`). CI's `build` check runs it — see [ci-pipeline](ci-pipeline.md).

## Lint = prettier AND ESLint (since 2026-07-22)

`npm run lint` = `prettier --check "{packages,apps}/**/src/**/*.{ts,tsx}"` **and** `lint:es` (ESLint 9 + eslint-config-next in apps/storefront + apps/admin, flat config via `@eslint/eslintrc` FlatCompat; added in PR #53). Before PR #53 lint was prettier-only — nothing caught React rule violations; the first ESLint run caught 2 real errors (raw `<a href="/">` in `Sidebar.tsx` and `not-found.tsx` forcing full page reloads), 2 missing `aria-controls` on comboboxes, and 3 dead bindings.

**Two DELIBERATE policy settings, both commented in `eslint.config.mjs` — do not "fix" them without understanding why:**

- `@next/next/no-img-element` is **OFF**: R2 images are served via the api Worker; `next/image`'s optimizer is not deployed on Workers.
- `react-hooks/exhaustive-deps` stays **WARN**: the 2 remaining hits are mount-once fetches where adding the dep could cause an infinite re-fetch loop.

## Pre-push habits (each one earned by a red build)

- **Run `npm run lint` before every push, not just `tsc`.** CI's build check includes `prettier --check` — a file that compiles fine but isn't formatted turns the check red (happened 2026-07-03: passed `tsc --noEmit` locally, failed CI in 28s on formatting alone). `npx prettier --write` on touched files is the quick fix.
- **Never chain `vitest run | tail && git commit`** — the pipe hides vitest's exit code; capture it separately.
- The failing-at-0s **"Workers Builds: kira-office"** check is a known bogus Cloudflare-integration signature, not your code — [ci-pipeline](ci-pipeline.md).
- The wider TDD working agreement (red→green→refactor, verify-before-done) is a [conventions](../conventions/index.md) concern — this file only covers what CI enforces.
