---
type: guide
title: Kira.office knowledge bundle
description: OKF bundle — everything a new AI agent (or human) needs to continue developing Kira.office and AirPlus seamlessly. Start here.
tags: [okf, handoff, knowledge, index]
timestamp: 2026-08-09
status: live
resource: https://github.com/ladykirsah/Kira.office
sources: [110 session-memory files, docs/, live repo state, production D1 — compiled 2026-08-09]
---

# Kira.office knowledge bundle

This is an [Open Knowledge Format](https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing)
bundle: a directory of markdown **concepts** with YAML frontmatter, cross-linked into a
graph. It is vendor-neutral — any agent or human can consume it with nothing but a markdown
reader. It was compiled on **2026-08-09** from the full session-memory corpus of the AI
agent that built most of this system (110 memory files), the repo's `docs/`, and live
repo/production state, specifically so that development can continue **seamlessly on a new
agent with no access to those memories**.

## What this project is

**Kira.office** — the back office for a Thai car air-conditioning parts & service business
— plus **AirPlus** (airplusauto.com), its customer storefront. One Cloudflare monorepo:
three Workers (API / admin / storefront), one D1 database, shared KV/R2, a stock-ledger
Durable Object. Money is integer satang; the working language of the domain is Thai.

## How to use this bundle

1. **Read [state/current.md](state/current.md) first** — what is live, as of this bundle's
   date. Then [state/blockers.md](state/blockers.md) and [state/known-bugs.md](state/known-bugs.md)
   before writing any code.
2. **Navigate by area** (each `index.md` discloses its concepts):

| Area | Contents |
| --- | --- |
| [state/](state/index.md) | Current snapshot, blockers, parked work, known bugs — the fastest-rotting layer |
| [platform/](platform/index.md) | The three Workers, accounts, domains, D1/KV/R2/DO, staging, local dev |
| [operations/](operations/index.md) | CI/CD contracts, deploy & migration runbooks, prod D1 access, incident log |
| [auth/](auth/index.md) | Cloudflare Access, staff login & lockout, owner sign-in, roles |
| [commerce/](commerce/index.md) | Orders, payments, refunds, claims, credit, coupons, shipping, the money model |
| [back-office/](back-office/index.md) | Products, taxonomy, barcode, stock, POS, Insight analytics, Shopee strategy |
| [storefront/](storefront/index.md) | AirPlus features, brand CI, LINE, SEO, policies, launch decisions |
| [conventions/](conventions/index.md) | Design system, working agreements with the owner, engineering rules, docs-map |

3. **Honor the source-of-truth chain.** `docs/DECISIONS.md` → `docs/STATE_OF_THE_BUILD.md`
   (2026-07-19 baseline) → reference docs → this bundle carries the deltas since. For the
   database, **the SQL files in `packages/db/migrations/` are the only schema truth** —
   several prose docs lag; [conventions/docs-map.md](conventions/docs-map.md) grades every
   doc's staleness.
4. **Working with the owner:** read
   [conventions/owner-session-workflow.md](conventions/owner-session-workflow.md) and
   [conventions/owner-communication-and-scope.md](conventions/owner-communication-and-scope.md)
   before your first session. They encode hard-won corrections, not preferences.

## Non-negotiables (the two-minute version)

- **TDD.** No production code without a failing test demanding it (`AGENTS.md`, and the
  owner's global workrules). Money, stock, and auth paths are critical: happy path +
  failure modes + edges.
- **Migrations run against prod D1 *before* the merge** — CI never runs them.
  New migrations start at **0088** ([operations](operations/index.md)).
- **`npm run lint` before push** — CI's build job runs prettier + eslint, not just tsc.
- **One branch per session; commit → PR → merge once** at the end, when the owner says so.
- **Never rotate `TRACK_SALT`**; never reuse `isSuperAdmin` for owner sign-in; every
  product query filters `archived`; stage-guard every `onsite_sales` write
  ([the invariants live in their areas](conventions/index.md)).
- **No secret values in this repo, ever.** Names and KV keys only.

## Maintaining this bundle

Treat it like code. When you change what is true, update the concept file **and its
`timestamp`** in the same PR, and append a line to [log.md](log.md). A concept that has no
file yet is a `[[link]]` waiting to be written — create it rather than widening an existing
file. The bundle replaces nothing in `docs/` — it curates and points.
