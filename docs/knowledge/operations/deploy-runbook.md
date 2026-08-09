---
type: guide
title: Manual deploy runbook and verification
description: How to deploy each of the three Workers by hand without repeating known outages, and how to verify a deploy actually landed.
tags: [deploy, wrangler, opennext, verification, runbook]
timestamp: 2026-08-09
status: convention
sources: [scan-here-flow-spec.md, kira-office-deploy-paths.md, kira-taxonomy-hierarchy.md, airplus-deploy-on-request-only.md, kira-financial-part-progress.md]
---

# Manual deploy runbook and verification

## Ground rules

- **Deploy on request only.** Verify locally; deploy production only when the owner asks. (The one-time exception was the 2026-07-19 go-live at the owner's explicit instruction — see [release-history](release-history.md).) Merging to main auto-deploys all three apps via CI since PR #125 — manual deploys are for out-of-band fixes and pre-CI-era muscle memory.
- wrangler is authed as lady.kirsah on the GoGoCash account. **Always pin the account**: `CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1` — the login sees three accounts and errors non-interactively otherwise (see [prod-d1-access](prod-d1-access.md) for all three account ids).
- Worker script names are a trap — read [worker-and-database-names](worker-and-database-names.md) before touching wrangler config.

## Per-app manual deploy

**The footgun first:** each Next app's `apps/*/.env.local` pins vars to `http://localhost:8788` for local preview (admin pins `NEXT_PUBLIC_API_BASE`, storefront pins `NEXT_PUBLIC_IMG_BASE`). Next re-loads `.env.local` at build time, so `env -u` alone does NOT help — this exact shape caused the 16-hour broken-images outage ([next-public-env-trap](next-public-env-trap.md)).

Procedure per app:

1. **Move that app's `.env.local` aside** (`mv .env.local .env.local.bak`).
2. Deploy:
   - API: `npm run deploy` from root (worker `kiraoffice`).
   - Admin: `NEXT_PUBLIC_API_BASE=https://api.airplusauto.com CLOUDFLARE_ACCOUNT_ID=187ab61… npm run deploy -w @l-shopee/admin` — setting the prod URL EXPLICITLY works because Next won't override an already-set var; a localhost value fails the build via `assertDeployableApiBase` (deliberate guard).
   - Storefront: `NEXT_PUBLIC_IMG_BASE=https://api.airplusauto.com … npm run deploy -w @l-shopee/storefront` — explicit value satisfies `imgBaseGuard` (`apps/storefront/src/lib/imgBaseGuard.ts`) without a localhost leak. (In CI the correct state is *unset*; explicit-prod-URL is the safe manual-shell equivalent.)
3. **Restore `.env.local`.**
4. Verify: no `localhost` in build output (`grep -rl localhost:8788 apps/admin/.open-next` must be empty; `curl -s https://airplusauto.com/ | grep -c localhost` must be 0) and curl the live host.

Worked example (verified): `mv .env.local .env.local.bak && CLOUDFLARE_ACCOUNT_ID=187ab61… env -u NEXT_PUBLIC_API_BASE npm run deploy -w @l-shopee/admin ; mv back` — then confirmed 302→cloudflareaccess and no localhost in `.open-next`.

## Known-benign deploy noise

- **API deploys print a `domains/records` trigger error** ("Some triggers failed to deploy") on every deploy. This is the custom-domain re-assert quirk: the token has workers:write but no zone edit. It is BENIGN when custom domains are already attached — the code still uploads and the domain keeps routing. `curl /health` to confirm; do not treat it as a failed deploy. CI tolerates exactly this wart and nothing else ([ci-pipeline](ci-pipeline.md)).

## Verifying a deploy actually landed

- **`wrangler deployments list` AND `versions list` print OLDEST FIRST** — read the LAST block (`| tail`). Reading the head once caused a false "deploys are stale" diagnosis and 3 redundant re-deploys.
- Ground truth for "did my code ship" = the **Current Version ID** line printed by `wrangler deploy` itself, or curling the live site.
- Healthy-prod signals after an API deploy:
  - `/health` → 200
  - gated routes (`/customers`, `/storefront-customers`) → **401**, NOT 404 (404 = route not registered = deploy didn't land) and NOT 500 (500 = schema mismatch = migration missing, see [d1-migration-discipline](d1-migration-discipline.md)).
- When a Cloudflare error looks self-contradictory, stop reasoning about config and **LIST what actually exists on the account** via the REST API using wrangler's OAuth token (`~/Library/Preferences/.wrangler/config/default.toml` → `oauth_token`):
  - `/workers/scripts` — what workers exist
  - `/workers/durable_objects/namespaces` — shows the owning script per namespace
  - `/workers/services/<id>/environments/production` — `etag` + `modified_on` = proof a deploy landed

## Worker runtime secrets

Runtime secrets on a worker are set with `wrangler secret put <NAME>` and take effect **without a redeploy**. Example: `SUPER_ADMIN_EMAILS` was set 2026-07-31 on the `kiraoffice` worker (comma-separated allow-list; currently the owner's email lady.kirsah@gmail.com) — add/change via `wrangler secret put SUPER_ADMIN_EMAILS`. Never paste secret VALUES into chat or at a shell prompt before the read prompt appears — see the secret-handling entries in [incidents-log](incidents-log.md).

## Local preview gotcha (recorded during deploy work)

The admin OpenNext dev worker cannot reach host `localhost:8788` for SSR, and a wedged renderer stops hydrating — fix by stopping and restarting the admin preview (`preview_stop` + `preview_start`). Full local recipe lives in [platform](../platform/index.md).
