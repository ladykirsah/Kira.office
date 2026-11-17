---
type: convention
title: Engineering rules — TDD, gates, and verification honesty
description: TDD-first per AGENTS.md, the real CI gates (lint = prettier + eslint), verify-before-assert lessons, schema-change endpoint testing, and backup-list discipline
tags: [engineering, tdd, ci, lint, testing, verification]
timestamp: 2026-11-17
status: convention
sources: [AGENTS.md, run-lint-before-push.md, dont-overwhelm-the-owner.md, taxonomy-bilingual-names.md, onsite-pos-customer-roadmap.md, docs/GITHUB_CHECKLIST.md, plan 8.5 (16 Nov 2026), plan 8.6 (16–17 Nov 2026)]
---

# Engineering rules — TDD, gates, and verification honesty

## TDD is the house methodology

Two sources bind here: the repo's own `AGENTS.md` ("**TDD for all application code.** No production logic without a failing test that demands it") and the owner's global CLAUDE.md workrules (Red → Green → Refactor; watch the test fail for the right reason; commit only at green; untested critical-path code is R0 — stop and ask).

Repo-specific critical paths from `AGENTS.md`:

- Add tests for **pricing, tax, commission, profit, and cost-method** logic **before** changing them (`packages/core`; formulas authoritative in `docs/PRICING_AND_FINANCE.md`).
- Add tests for **stock ledger** behaviour before changing inventory logic.
- Money is critical-path; store both inputs AND outputs of financial calculations so historical records never change when fee/tax rules change later.
- Offline-first POS sales must be idempotent on sync — never lose or double-count a sale or stock movement.
- Test runner is **Vitest** (`npm test` = `vitest run`).

## The real CI gates — run lint before push

CI (`.github/workflows/ci.yml`) runs `npm run lint` → `npm run typecheck` → `npm test`. The trap: **`npm run lint` = `prettier --check` over `{packages,apps}/**/src/**/*.{ts,tsx}` + eslint** (`lint:es`) — so a formatting difference fails CI even when tsc and tests are green. Running only `tsc` before pushing is not enough; run `npm run lint`. ESLint was added Jul 22 to both apps (exhaustive-deps stays warn). Pre-push checklist lives in `docs/GITHUB_CHECKLIST.md` (no secrets, docs consistent with DECISIONS.md, test+lint+typecheck green, confirm the active `gh` account). CI/deploy contracts in full: [operations](../operations/index.md).

### CI flakes vs real failures

- PR #13's first build hung 15 minutes with no retrievable log — a **runner hang**, not a code bug; `gh run rerun <id> --failed` passed in 52s. Distinguish this pattern (hang, no log) from real failures.
- Real example of a genuine lint failure: two accidental scratch test files (`__probe_tmp`, `richclaim.scratch`) committed in `f5c0ba3` failed lint. Don't commit scratch files. (Same commit intentionally REMOVED the standalone Add-customer form as redundant vs POS auto-create + import + car-page edit.)

## Verify before asserting — the four-fabrications incident

One session produced four confident fabrications, each because the claim made the story cleaner:

1. "No open PRs" — stderr was suppressed and an empty read was treated as none; it hid PR #20 containing most of AirPlus. **Never let an empty result stand in for "none".**
2. An emotive "your irreplaceable production data" argument — prod actually held 6 seed products and 0 sales; never checked.
3. A fabricated D1 database ID — the suffix guessed from a memory fragment.
4. "CI would stay green" — about a landmine CI would in fact have caught.

Rule: label claims verified / assumed / guessed; check before persuading; especially distrust yourself when a claim is rhetorically convenient.

## Schema changes: exercise the real endpoint, not just types and unit tests

Migration 0060 lesson: the first draft added `name_th`/`name_en` to only SOME taxonomy tables (part-brands skipped because the owner hadn't asked), but `listAttributes()` selects **all five taxonomy lists through ONE shared query**, so `/attributes` 500'd entirely with "no such column: name_th". Types passed and all 896 unit tests passed — only a real HTTP request against a local Worker caught it. A partial-migration + shared-query combination is invisible to tsc and unit mocks; after any schema change, hit the real endpoint on a local Worker. Migration discipline in full: [operations](../operations/index.md).

## Backup-list discipline

`BACKUP_TABLES` (the daily R2 dump's table list) was once missing `customers`/`payments`/`audit_logs` — the anti-cheat payment trail was silently omitted from backups. Fixed by adding those + `customer_history_entries`. **When adding a table, check the backup list.** Platform detail: [platform](../platform/index.md).

## The Worker's main file exports only functions, classes and objects

Plan 8.5 (16 Nov 2026): `export const LIST_LIMIT = 5000` in `apps/api/src/index.ts` stopped the local
Worker — *"Incorrect type for map entry 'LIST_LIMIT': the provided value is not of type 'function or
ExportedHandler'"*. The Cloudflare runtime reads **every named export of the main file as a handler**,
so a plain number, word or true/false there kills the Worker (a deploy would fail the same way). All
unit tests stayed green; only the running local server showed it. Lists and objects are accepted.
`apps/api/src/workerExports.test.ts` now fails on any plain-value export. **Keep such constants
unexported**; export functions freely for tests.

## Lists send everything (up to `LIST_LIMIT`)

Owner's pick A (16 Nov 2026, plan 8.5): every back-office list (products, stock, barcodes, payments,
sales without a date range, open drafts, cars, a car's bills and old history, AirPlus customers and
their orders, the orders list) sends all rows up to one shared safety limit, `LIST_LIMIT` (5,000) in
`apps/api/src/index.ts`. The old caps (100–500) silently hid rows once the shop grew past them.
Page-by-page loading comes with the redesign. A new list uses `LIST_LIMIT`, never its own small cap.

## Old addresses and the page sign-in returns to

Plan 8.6 (16 Nov 2026): bookmarks, home-screen icons and LINE links to old back-office pages (`/me`,
`/settings/staff/salary`, `/import`, `/terms`, `/customers?plate=…` and the rest) jump to the page that
replaced them. The one map is `apps/mobile/src/lib/oldAddresses.ts`, read by `app/(app)/_layout.tsx`
before the sign-in check. Any other unknown address still shows ไม่มีหน้านี้ในแอป.

- **Sign-in remembers the page.** On the website the PIN is asked on every open, so a page opened
  signed out goes to `/sign-in?to=<that page>` and back there after the PIN. Only a path inside this
  app is taken (`returnPath`: no `//`, no `\`, no line breaks, never `/sign-in` itself); anything else
  goes to หน้าหลัก.
- **Signing out on purpose starts the next person at หน้าหลัก.** That fact lives in the auth state
  (`signed-out` with `byChoice`, set by `signOutNow`), not in a ref read during render.
- `<Redirect>` replaces the history entry, so ‹ back never bounces to the old address. Check that
  in a fresh browser tab: a tab with older history gives a false answer.

## Related

- [git-and-worktree-traps](git-and-worktree-traps.md) — squash merges, stacked PRs, worktree hygiene, subagent mutations (including why a green suite can lie when tests get deleted)
- [owner-session-workflow](owner-session-workflow.md) — when approval is required around commits/merges/deploys
