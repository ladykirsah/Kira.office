---
type: trap
title: NEXT_PUBLIC_* is inlined at build time
description: A dev-shell deploy baked http://localhost:8788 into the production bundle and broke every AirPlus image for ~16 hours; three layered guards now exist — know all of them before touching env vars around a build.
tags: [nextjs, env, deploy, incident, guards]
timestamp: 2026-08-09
status: live
sources: [next-public-env-inlined-at-build.md, kira-storefront-had-no-deploy-job.md, kira-office-deploy-paths.md, kira-taxonomy-hierarchy.md]
---

# NEXT_PUBLIC_* is inlined at build time

## The mechanism

`NEXT_PUBLIC_*` values are compiled into the client bundle when `next build` runs. Whatever the build shell had set at that moment ships to every customer. A runtime var change does nothing after the fact.

## The incident (2026-07-22)

`wrangler deploy` was run from a shell where `NEXT_PUBLIC_IMG_BASE` still pointed at the dev server (`.claude/launch.json` runs `wrangler dev --port 8788`). The build shipped `http://localhost:8788/img/…` into the production bundle: every product photo, category tile and brand logo broken for ~16 hours (deploy 00:00 +07; found only when the owner looked at the site).

**Nothing caught it:** tsc passed, 832 tests passed, `next build` exited 0, `wrangler deploy` succeeded, `GET /` returned 200 — nothing fetches images during a build. This is why status-code verification is insufficient: **verify the rendered HTML** (`curl -s https://airplusauto.com/ | grep -c localhost` must be 0).

## The three guards (do not remove, do not bypass)

1. **`imgBaseGuard`** (`apps/storefront/src/lib/imgBaseGuard.ts`, PR #47): fails the production build on loopback / `.local` / plain-http values (verified: a poisoned build exits 1). Admin has the sibling `assertDeployableApiBase` for `NEXT_PUBLIC_API_BASE` (added later — admin's exposure was the same shape but lower priority: it sits behind Access and breakage is immediately visible to its only user).
2. **CI runner guard** (PR #125): `deploy-storefront` FAILS the build if **any** `NEXT_PUBLIC_*` var is set in the runner environment. Rationale: every such var falls back to a prod URL in source, so **absent is the correct state** for production builds. This turns the 16-hour silent outage class into a red build. Do not "fix" a red CI by exporting `NEXT_PUBLIC_*` there.
3. **Manual-deploy procedure**: each app's `.env.local` pins these vars to `localhost:8788` and Next re-loads `.env.local` at build — so `env -u` does NOT help. Either move `.env.local` aside, or set the prod URL explicitly (Next won't override an already-set var): `NEXT_PUBLIC_API_BASE=https://api.airplusauto.com` for admin, `NEXT_PUBLIC_IMG_BASE=https://api.airplusauto.com` for storefront (needed during the taxonomy Phase 3 deploy to satisfy imgBaseGuard without a localhost leak). Full procedure in [deploy-runbook](deploy-runbook.md).

## How to apply

- Deploying by hand → follow the runbook's `.env.local`-aside steps, then grep the built output and the live HTML for `localhost`.
- Seeing a red `deploy-storefront` on the NEXT_PUBLIC guard step → something exported a var into the runner; remove the export, never weaken the guard.
- Adding a new `NEXT_PUBLIC_*` var → give it a prod-URL fallback in source (the pattern of `apps/storefront/src/lib/img.ts`) and extend the build guard to validate it.
