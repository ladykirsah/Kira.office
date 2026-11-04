---
type: infrastructure
title: CI pipeline — jobs and failure contracts
description: The GitHub Actions jobs, what each guarantees, what a green check does NOT prove, and the loud-failure contract that exists because silent skips once shipped nothing for weeks.
tags: [ci, github-actions, deploy, failure-contract]
timestamp: 2026-11-04
status: live
sources: [.github/workflows/ci.yml, kira-office-deploy-paths.md, kira-storefront-had-no-deploy-job.md, kira-office-architecture.md, run-lint-before-push.md, package.json]
---

# CI pipeline — jobs and failure contracts

## What it is

`.github/workflows/ci.yml` runs on push to `main` and on all PRs. Permissions `contents: read`, Node 22. Four jobs:

1. **`build`** (the PR check): `npm ci` → `npm run lint` → `npm run typecheck` → `npm test`.
2. **`deploy`** — API worker `kiraoffice`, `npm run deploy -- --env=""` from root. Push-to-main only, `needs: build`.
3. **`deploy-storefront`** — `airplus-storefront`, `npm run deploy -w @l-shopee/storefront`. Push-to-main only, `needs: build`. **Added only in PR #125 (squash 559b506, 4 Aug 2026)** — see below.
4. **`deploy-app`** — `kiraoffice-app` → **`admin.airplusauto.com`**, the Expo back office as a static website (`apps/mobile/wrangler.jsonc`): `EXPO_NO_DOTENV=1 npx expo export --platform web`, then `npx wrangler deploy`, then a check that the live address answers with THIS app. Push-to-main only, `needs: build`. Added 4 Nov 2026 (owner: "Publish first", "A: PIN every open", then "i want to swap for the old one").

**`deploy-admin` was removed on 4 Nov 2026.** The old Next.js admin (`kiraoffice-admin`) is parked: `apps/admin/wrangler.jsonc` has `routes: []` and `workers_dev: false`, so a stray manual deploy reaches no one and cannot pull `admin.airplusauto.com` back. `admin.homeseeker.me` went with it. The Worker is deleted two weeks after the swap.

All three deploy jobs share the single `CLOUDFLARE_API_TOKEN` repo secret (a GoGoCash-account Workers+DNS-edit token; account `187ab61ed9dbc6e616cb23e6b95aa8f1`). GHA **never** builds Next apps outside the deploy jobs and **never** runs D1 migrations — see [d1-migration-discipline](d1-migration-discipline.md).

## The shared failure contract (why it is this strict)

- **(a) Missing token = exit 1 with `::error`, never a silent skip.** Found 2026-07-05: the deploy jobs were guarded `if token unset then echo skip; exit 0` while the secret was UNSET — every "deploy" skipped yet passed GREEN. The API worker ran pre-PR#4 code for weeks while merges looked deployed; migrations applied for the NEW code then broke the STALE live code (dropped columns → 500s). Fixed by setting `CLOUDFLARE_API_TOKEN` and hardening the jobs to fail loudly.
- **(b) One tolerated wart:** if wrangler exits non-zero BUT its output contains `"Deployed kiraoffice"` / `"Deployed airplus-storefront"` / `"Deployed kiraoffice-app"`, the job WARNS and exits 0. That is the known benign custom-domain re-assert failure (token has workers:write but no zone edit; the code still deploys and the domain keeps routing). It must never be widened to mask real failures.
- **(c) Any other non-zero exit is a real failure** — exit 1.
- **`deploy-app` extra guards:** the same refusal for any `EXPO_PUBLIC_*` env var, `EXPO_NO_DOTENV=1` so a local `.env.local` (localhost api) can never be baked in, and a last step (10 minutes of tries) that FAILS unless `https://admin.airplusauto.com/` answers with the Expo export (`_expo/static` in the page — the old admin is also titled CrewEngine, so the title proves nothing). Wart (b) would otherwise pass green while the address still pointed at the old admin. In CI (no terminal) wrangler moves a custom domain held by another Worker onto this one when the token is allowed to; when it isn't, move it in the dashboard (kiraoffice-admin → Domains & Routes → remove; kiraoffice-app → add) and re-run the job.
- **`deploy-storefront` extra guard:** the build FAILS if **any** `NEXT_PUBLIC_*` env var is set in the runner. Unset is the *correct* production state (every such var falls back to a prod URL in source). Never "fix" CI by exporting one — see [next-public-env-trap](next-public-env-trap.md).

## Next 15 stopgap flag (since 2026-10-30)

OpenNext refuses any Next.js major more than two years past its release. Next 15 (released 2024-10-21) hit that on **2026-10-21**: from then every `deploy-admin` and `deploy-storefront` run failed with "Next.js version 15.5.x is not supported" while `deploy` (API) kept going green, so airplusauto.com and the admin stayed on the 17 Oct build.

The owner picked the stopgap over moving to Next 16 straight away: both apps are on **Next 15.5.28** (its last patch) and every OpenNext build (both CI build steps and each app's `preview`/`deploy` script) passes `--dangerouslyUseUnsupportedNextVersion`. `scripts/opennext-build-flags.test.mjs` holds that in place: it fails if any build of a Next 15 app lacks the flag, **and** if an app on Next 16+ still carries it — so the flag is removed in the same change that moves an app to 16, and a future "not supported" refusal shows up instead of being silently overridden. Next 15 gets no more fixes; the move to 16 is still owed.

## What a green check does NOT prove

- **The `build` check does not run `next build`.** It is only lint + typecheck + vitest. A green PR does NOT prove admin/storefront compile — the OpenNext build happens only inside the deploy jobs, *after* merge. Pre-build locally before risky merges: `npm run build -w @l-shopee/storefront` (or `-w @l-shopee/admin`; each app also has `build:check` = `NEXT_DIST_DIR=.next-verify next build`).
- **A check that doesn't exist can't fail.** Until PR #125, there was no storefront deploy job at all: merging AirPlus Insight (#124) shipped the admin page + API but left the storefront tracking beacon undeployed — traffic analytics would have read zero forever with every check green and no error anywhere. Standing check before assuming "merged = live": **grep the workflow for a job per deployable app.** Three apps are live (`apps/api` → `kiraoffice`, `apps/storefront` → `airplus-storefront`, `apps/mobile` → `kiraoffice-app` at admin.airplusauto.com); `apps/admin` is parked with no job. A new app needs its own job.
- **After any deploy, verify the live worker** (curl a route, check the Current Version ID) rather than trusting CI green — see [deploy-runbook](deploy-runbook.md).
- **The "Workers Builds: kira-office" check failing at 0s is a known bogus signature** — an unrelated Cloudflare account/integration issue. Ignore that specific failure shape; do not debug it as if it were your code.

## npm scripts CI (and you) run

Root `package.json` (name `kira-office`, npm workspaces `packages/*` + `apps/*`, Node >= 22):

| script | what it does |
|---|---|
| `test` | `vitest run` (also `test:watch`, `test:coverage`) |
| `typecheck` | `tsc -b packages/core` && `tsc --noEmit` on apps/api, apps/storefront, apps/admin |
| `lint` | `prettier --check "{packages,apps}/**/src/**/*.{ts,tsx}"` && `lint:es` (ESLint in apps/storefront + apps/admin) |
| `format` | `prettier --write` |
| `deploy` | `wrangler deploy` (API, from root) |
| `deploy:staging` | `wrangler deploy --env staging` |
| `deploy:dry` | `wrangler deploy --dry-run --outdir .wrangler/dry` |

Workspace packages are scoped `@l-shopee/*` (admin, storefront): each has `deploy` = `opennextjs-cloudflare build && opennextjs-cloudflare deploy` (storefront appends `--env=""`). Storefront dev runs on port 3002. Root devDeps: wrangler ^4, vitest ^3.2.6, typescript ^5.6.3, prettier ^3.3.3.

Because CI's `build` runs `npm run lint`, **run `npm run lint` before every push** — not just `tsc`. See [testing-and-lint](testing-and-lint.md).

## References

- `.github/workflows/ci.yml`
- [incidents-log](incidents-log.md) — the silent-skip and missing-job incidents in full
- [conventions](../conventions/index.md) — lint-before-push working agreement
