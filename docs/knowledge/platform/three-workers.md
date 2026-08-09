---
type: app
title: The three deployable Workers
description: kiraoffice (API), kiraoffice-admin, airplus-storefront — exact script ids, bindings, build tools, and the deploy traps that have already bitten
tags: [cloudflare, workers, wrangler, deploy, bindings, durable-objects]
timestamp: 2026-08-09
status: live
sources: [wrangler.jsonc, apps/admin/wrangler.jsonc, apps/storefront/wrangler.jsonc, "wrangler-env-inherits-routes.md", "single-domain-airplusauto-move.md", "kira-office-deploy-paths.md"]
---

# The three deployable Workers

All three live on the Cloudflare account **GoGoCash** (`account_id 187ab61ed9dbc6e616cb23e6b95aa8f1` — stated non-secret in the config comments). They MUST share one account: Cloudflare bindings (D1, KV, R2, Durable Objects) do not cross accounts. The admin once lived on a different account and the cross-account proxy failed with error 1003 — that is why everything was consolidated. See [cloudflare-accounts](cloudflare-accounts.md).

## 1. API — script id `kiraoffice` (NO HYPHEN)

- Config: root `wrangler.jsonc`. Entry `apps/api/src/index.ts`. Deployed from repo root via `npx wrangler deploy` (`npm run deploy`).
- **The name has no hyphen on purpose — never "fix" it.** The Durable Object namespace `kira-office_StockLedger` is owned by the script `kiraoffice` (created 2026-06-23, namespace named before a rename). Deploying as `kira-office` tries to CREATE a second Worker whose DO migration collides with the existing namespace. Documented 2026-07-20 deploy deadlock: api fails with `DO namespace name 'kira-office_StockLedger' already in use` [10065]; storefront fails with `Cannot create binding for class in script 'kira-office' that does not exist` [10061]. The namespace's *display name* still reads `kira-office_StockLedger`; that is cosmetic — bindings resolve by (script_name, class_name).
- Domains: `api.airplusauto.com` (destination) + `api.homeseeker.me` (legacy fallback) — see [domains](domains.md).
- Bindings: D1 `DB` (kira-office), KV `KV` (`a64f57510fcf491695b1170bf5057a6d`), R2 `IMAGES` (`kiraoffice-images`), DO `STOCK_LEDGER` (class `StockLedger`, migrations tag v1). Cron `0 19 * * *` = 02:00 Asia/Bangkok (daily backup; Shopee sync hooks into the same `scheduled()` later).
- A private `BACKUPS` R2 bucket (`kiraoffice-backups`) is planned but commented out until provisioned.
- Auth: this Worker is gated by `requireAccess()` **in code** (verifies the forwarded Access JWT), not by an edge Access application — so attaching a new hostname to it does not open an unprotected door the way it would for the admin. `requireAccess` FAILS OPEN when `ACCESS_*` secrets are unset (deliberate for local dev, dangerous in prod) — see [auth](../auth/index.md).
- Secrets (by NAME, via `wrangler secret put`): `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `SLIPOK_API_KEY`, `SLIPOK_BRANCH_ID`, `SUPER_ADMIN_EMAILS`. Optional var: `ALLOWED_CORS_ORIGINS`.
- Staging env: `kira-office-staging` on `staging-api.airplusauto.com`, `workers_dev: false`, its own D1/KV/R2 — see [staging-stack](staging-stack.md).

## 2. Admin — script `kiraoffice-admin`

- Config: `apps/admin/wrangler.jsonc`. Built with OpenNext: `opennextjs-cloudflare build && opennextjs-cloudflare deploy`, `main: .open-next/worker.js`.
- Domains: `admin.airplusauto.com` + `admin.homeseeker.me`. **Both must stay as destinations on the "admin" Cloudflare Access app (aud `dfcb79fc…`) at all times** — the Worker itself enforces nothing; Access at the edge is the only defence. Gate a hostname with Access BEFORE attaching it here, never after (the 2026-07-21 destination-REPLACE incident left `admin.homeseeker.me` unprotected for ~6 minutes). Details in [auth](../auth/index.md) and `docs/KIRA_OFFICE_ACCESS_SETUP.md`.
- `NEXT_PUBLIC_API_BASE` is inlined at **build** time (a runtime var does nothing) — export it before `opennextjs-cloudflare build`. See [operations](../operations/index.md) for the NEXT_PUBLIC baking incident.
- Staging env `kiraoffice-admin-staging` has an **explicit** routes array (`staging-admin.airplusauto.com` + `staging-admin.homeseeker.me`). See the routes-inheritance trap below for why that array — and the production entry's counterpart — is load-bearing.

## 3. Storefront — script `airplus-storefront`

- Config: `apps/storefront/wrangler.jsonc`. OpenNext; deploy script is `opennextjs-cloudflare deploy --env=""`.
- Domain: `airplusauto.com` (apex).
- Binds the **same** production D1/KV/R2 as the API (a D1 db can be bound by multiple Workers), plus a **cross-Worker DO binding** with `script_name: "kiraoffice"` — no hyphen; a wrong name fails the entire storefront deploy with 10061. In local `next dev` this external binding is not resolvable, so stock-deduction code must treat it as optional locally.
- `vars`: `LINE_CHANNEL_ID` `2010753164` (public — it appears in the OAuth authorize URL). The matching `LINE_CHANNEL_SECRET` is a per-env secret. Named envs do NOT inherit vars, so the id is repeated under `env.staging`.
- Staging env `airplus-storefront-staging` on `staging-shop.airplusauto.com`, **public** (no Access app), `OTP_DEV_ECHO` deliberately removed — never re-add it (see [staging-stack](staging-stack.md)).
- Full storefront design in [storefront-architecture](storefront-architecture.md).

## Invariants & traps

### A named env with no `routes` key INHERITS and STEALS production hostnames (incident 2026-07-22)

In `wrangler.jsonc`, omitting `routes` from a named environment means *inherit the top-level routes*, not "no routes". Deploying that env reassigns the hostnames away from the production Worker — wrangler warns only AFTER doing it. Cost: adding `env.staging` to `apps/admin/wrangler.jsonc` without `"routes": []` and running `wrangler deploy --env staging` moved BOTH production admin hostnames onto `kiraoffice-admin-staging` (a build wired to the staging API and staging DB). Bounded only because Cloudflare Access still gated the hostnames; fixed by redeploying the production Worker to reclaim them. Rules:

1. Any env that should be unreachable needs explicit `"routes": []` (combined with `workers_dev: false` this makes the Worker unreachable — the point, until an Access app covers it).
2. Any env with its own hostname needs its OWN routes array.
3. After deploying any `--env`, verify hostname ownership via `GET /accounts/{acc}/workers/domains` (check `service` per hostname) — never trust the deploy output.
4. Same shape as the Access destination-REPLACE trap: a config edit that silently MOVES something instead of adding. Verify ownership after, every time.

### Per-environment bindings are NOT inherited

`vars`, `d1_databases`, `kv_namespaces`, `r2_buckets`, and DO `script_name` must all be repeated inside `env.staging`. The storefront's staging DO binding must point at `script_name: "kira-office-staging"` (the staging API worker — this one DOES have a hyphen).

### The admin never calls the API cross-origin

The admin's browser calls the same-origin `/api/worker` proxy; only the admin **Worker** talks to the API, server-to-server, with the Access JWT in a header. So admin and API can sit on different domains with no CORS allowlist entry and no cookie-domain coupling. `DEFAULT_CORS_ORIGINS` is irrelevant to the admin — adding admin hostnames to it is a wrong fix that signals misunderstanding of the architecture.

### DO class migrations are owned by the API config only

The storefront has no `migrations` block — DO class migrations live exclusively in the root (API) `wrangler.jsonc`. The cross-Worker binding only works after `kiraoffice` has deployed the class.

## References

- Deploy paths / CI contract (GHA never builds Next apps or runs migrations): [operations](../operations/index.md)
- Databases and migration discipline: [d1-and-migrations](d1-and-migrations.md)
- Hostname map: [domains](domains.md)
