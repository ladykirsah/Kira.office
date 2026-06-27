# AGENTS.md - L Shopee Project Rules

These instructions apply to this project folder and override broader defaults when more specific.
Read [docs/DECISIONS.md](docs/DECISIONS.md) first — it is the source of truth for confirmed choices —
then [docs/STATE_OF_THE_BUILD.md](docs/STATE_OF_THE_BUILD.md) for the as-built snapshot (what's done,
in progress, next; the API/schema/module/design references hang off it).

## Project Intent

Admin back-office for a **Shopee Thailand** seller that manages products, inventory,
barcode-based **offline-first** on-site sales, pricing (THB, 7% VAT), financial records, and
**later** Shopee account synchronization.

## Confirmed Stack

Backend runs on the **Cloudflare developer platform** — full design in
[docs/CLOUDFLARE_ARCHITECTURE.md](docs/CLOUDFLARE_ARCHITECTURE.md).

- Monorepo via **npm workspaces**; **Node 22** (Wrangler requires ≥22; `.nvmrc` + CI pin it). No pnpm.
- `apps/admin` — Next.js + TypeScript admin UI and offline-first POS, deployed to **Workers** via the **OpenNext** adapter (PWA).
- `apps/api` — **Cloudflare Worker** for the API, offline-sync endpoint, Shopee adapter, and queue consumers.
- `packages/db` — **D1** schema + migrations via **Drizzle** (`drizzle-kit` → `wrangler d1 migrations apply`).
- `packages/core` — pure-TypeScript pricing, inventory, tax, cost, and terms logic (no I/O, no Cloudflare deps).
- `docs` — requirements and implementation notes.
- Tests: **Vitest**. App UIs are initialized with `create-cloudflare` (`--framework=next`); see each app README.

## Cloudflare Rules

- Bind resources in `wrangler.jsonc`; never hardcode ids. Per-environment bindings are **not
  inheritable** — define D1/R2/KV/Queues for each `[env.*]`.
- **Money is stored as integer satang** in D1 (never floats). Convert at the persistence boundary
  (`Math.round(thb * 100)`); `packages/core` keeps computing in THB decimals.
- All stock mutations go through the **stock-ledger Durable Object** (single writer, serialized);
  the offline-sync endpoint must be **idempotent** on `client_uuid`.
- Slow/external work (Shopee, image processing, import) goes on a **Queue** with a dead-letter
  queue — never block a request on Shopee. Scheduled work uses **Cron Triggers**.
- Secrets via `wrangler secret` / Secrets Store and local `.dev.vars` only — never `vars`, never
  source, never logs.
- Don't commit generated ids, `.dev.vars`, `.open-next/`, or `.wrangler/`.

## Development Rules

- **TDD for all application code.** No production logic without a failing test that demands it.
- Add tests for **pricing, tax, commission, profit, and cost-method** logic **before** changing them.
- Add tests for **stock ledger** behavior before changing inventory logic.
- Money is critical-path. Prefer explicit currency (THB), VAT rounding, and fee rules over defaults.
- Store both **inputs and outputs** of financial calculations so historical records never change
  when fee/tax rules change later.
- Treat local inventory as financial data: preserve auditability for stock changes, sales,
  refunds, and manual adjustments (append-only audit log).
- Keep Shopee code isolated behind an **integration boundary** (CSV adapter now, API adapter later)
  so core logic is testable without live API calls.
- **Offline-first POS:** sales created offline must be idempotent on sync (client-generated ids,
  conflict handling). Never lose or double-count a sale or stock movement.
- Do not commit secrets, Shopee partner keys, access/refresh tokens, cookies, or exported
  customer data. Reference secrets by name only.
- Keep docs updated when requirements, data models, API contracts, or formulas change.

## Shopee Rules

- Shopee **Thailand** grants Open API access mainly to **managed sellers** (with a KAM).
  Do not assume the owner has API access. Live API work is **gated** — see DECISIONS.md.
- Verify Shopee Open Platform endpoint behavior against official docs and the developer console
  before implementing or changing API integrations. Use the **sandbox** first.
- Use Shopee API **v2** only.

## Verification Expectations

Before reporting implementation work as done:

- Run relevant tests; show red→green for new behavior.
- Run typecheck/lint when available.
- Verify important user workflows manually or with browser tests.
- Report any command that could not be run.

## Build, gate & deploy

Run the gate before claiming work done (see also `.cursor/rules/project.mdc` for the same, for Cursor):

```bash
npm run format && npm run lint && npm run typecheck && npm test   # 238 vitest tests
rm -rf apps/admin/.next-verify apps/admin/.next/types && \
  NEXT_DIST_DIR=.next-verify npm run build:check -w @l-shopee/admin   # admin typecheck + build
```

- **Pushing to `main` does NOT deploy.** The GitHub Actions `deploy`/`deploy-admin` jobs skip (their
  secrets are unset; a skip shows green — don't mistake it for a deploy) and the Cloudflare Workers
  Builds integration fails on the custom-domain DNS. **The owner deploys manually** with `npm run deploy`
  (API) and `npm run deploy -w @l-shopee/admin` (admin); the agent has no wrangler auth. After any API
  change, tell the owner to deploy — it is not live until they do.
- **The admin defaults to the PROD API.** To verify admin UI against unreleased API changes, point it at
  the local Worker via a gitignored `apps/admin/.env.local` (`NEXT_PUBLIC_API_BASE=http://localhost:8788`)
  + restart the dev server; never write mock data to prod.
- The current as-built status, gotchas, and migration workflow live in
  [docs/STATE_OF_THE_BUILD.md](docs/STATE_OF_THE_BUILD.md) — keep it updated.

## GitHub Rules

- Do not force-push. Do not rewrite user-owned history.
- Private repository only unless the owner explicitly approves public visibility.
- Confirm the exact repository owner before pushing. The authenticated CLI account may differ
  from the owner's account (see [docs/GITHUB_CHECKLIST.md](docs/GITHUB_CHECKLIST.md)).
