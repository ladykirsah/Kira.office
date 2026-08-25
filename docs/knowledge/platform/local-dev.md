---
type: guide
title: Local dev and preview recipes
description: Running the admin/API/storefront fully self-contained — blank ACCESS_*, .env.local override, per-worktree local D1, no seed script, and the load-prod-data trick
tags: [local-dev, preview, wrangler, miniflare, d1, dev-vars]
timestamp: 2026-08-09
status: convention
sources: ["kira-office-local-preview-recipe.md", "kira-dashboard-notifications-plan.md", "airplus-returns-pages-and-warranty.md", "airplus-staging-preview.md", .claude/launch.json]
---

# Local dev and preview recipes

## The admin + API recipe (fully self-contained, no Cloudflare Access, no prod)

1. `npm ci` at repo root.
2. Root `.dev.vars` with `ACCESS_TEAM_DOMAIN=""` and `ACCESS_AUD=""` (blank, so no Cloudflare Access
   JWT is needed) **plus `PRACTICE_COPY="1"`** and a dummy `AUTH_SECRET`. The blank Access variables
   used to be the whole story, because `requireAccess` failed open; since 25 Aug 2026 the gate is
   the staff session and it fails CLOSED, so a local API answers **401 to everything** until you
   sign in. `PRACTICE_COPY="1"` is what makes that possible on an empty database — it enables the
   one-click, credential-free `POST /staff/login-practice`, which needs BOTH that explicit `"1"` and
   Access being unconfigured, and which every deployed environment refuses by shipping `"0"`. See
   [practice-copy-sign-in](../auth/practice-copy-sign-in.md) and
   [require-access-fail-open](../auth/require-access-fail-open.md).
3. `apps/admin/.env.local` → `NEXT_PUBLIC_API_BASE=http://localhost:8788` (Next auto-loads it).
4. `npx wrangler d1 migrations apply kira-office --local` (migrations in `packages/db/migrations`).
5. Start via `.claude/launch.json`: `api` (wrangler dev, :8788), `admin` (:3010, autoPort), `storefront` (:3002).

All of `.dev.vars`, `.env.local` are gitignored. Why the `.env.local` override matters: the admin's browser calls proxy through the same-origin `/api/worker` route to `NEXT_PUBLIC_API_BASE`, whose default is prod behind Access → 401.

**There is NO seed script.** Local D1 comes up schema-only; lists render empty states. Hand-seed via the API or `wrangler d1 execute kira-office --local` when a screen needs content.

## Per-worktree local D1 — the /orders-500 diagnosis

Each git worktree has its **own** local D1 state (miniflare, at `<worktree-root>/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite` — worktree ROOT, not `apps/storefront/.wrangler`). A local-preview `/orders` HTTP 500 ("internal error" → dashboard shows "counts unavailable") is usually the worktree's local D1 **missing migrations**, not a code bug — `listOrders` selects columns from migrations 0074–0079. Fix: `npx wrangler d1 migrations apply kira-office --local`. Re-apply migrations in every fresh worktree before diagnosing 500s as bugs.

Also: stop the dev server before writing to the sqlite file directly (uncommitted WAL).

## Loading real prod data into the local miniflare D1 (reusable trick)

The storefront's `next dev` reads the local miniflare D1 (per `apps/storefront/next.config.ts`), empty by default. To load real data:

1. `wrangler d1 export kira-office --remote --output=dump.sql`
2. Python `sqlite3` `executescript` with `PRAGMA foreign_keys=OFF` **directly** into `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite`.

**`wrangler d1 execute --file` FAILS on the dump** — it runs statements individually and keeps re-enabling FKs, so the interleaved CREATE/INSERT dump hits `no such table`. The Python path is the only one that works.

## Storefront-specific local notes

- The cross-Worker `STOCK_LEDGER` DO binding is not resolvable in local `next dev` (external script) — stock-deduction code must treat it as optional locally ([three-workers](three-workers.md)).
- `next dev` hides the static-prerender-vs-D1 failure; only a clean `next build` catches it ([storefront-architecture](storefront-architecture.md)).
- FK behaviour differs by environment: the local sqlite3 CLI does NOT enforce FKs, remote D1 DOES ([staging-stack](staging-stack.md) has the delete-order consequences).

## References

- Databases + migration numbering: [d1-and-migrations](d1-and-migrations.md)
- Working agreements about when to preview vs deploy: [conventions](../conventions/index.md)
