---
type: infrastructure
title: Staging stack operations
description: The three staging hosts, why staging login is impossible by design, the noindex mechanics, and the drift checks that keep staging useful.
tags: [staging, cloudflare-access, noindex, robots, d1]
timestamp: 2026-08-09
status: live
sources: [kira-staging-blocked-on-access.md]
---

# Staging stack operations

## Current shape (live since 2026-07-22, PRs #52/#54/#55)

| host | state |
|---|---|
| `staging-shop.homeseeker.me` | public + noindex; **login IMPOSSIBLE by design** |
| `staging-api.homeseeker.me` | 401 on every data route; `/health` public (`kira-office-staging` worker has `ACCESS_AUD` + `ACCESS_TEAM_DOMAIN` set) |
| `staging-admin.homeseeker.me` | behind the **SAME Access app as prod** (aud `dfcb79fc…`), 302 pre-login |

Deploy path: `npm run deploy:staging` (= `wrangler deploy --env staging`). There was originally no staging admin worker at all — it was created in this wave.

## Why it is this way (do not "improve" these)

- **`OTP_DEV_ECHO` was removed from `env.staging` in PR #52 and must NOT be re-added.** The fixed code `123456` plus 2 real-looking Thai customer phone rows made public exposure dangerous. If login testing on staging is ever needed, put staging-shop behind Access FIRST.
- **Same Access app as prod is deliberate:** a separate app mints a different `aud`, and the API checks the JWT against `ACCESS_AUD` — a separate-app staging admin would log in and then 401 on every API call. Access setup and its traps: [auth](../auth/index.md).
- **`*.workers.dev` can NEVER be put behind Access** — that is why PR #43 moved staging to real hostnames. Do not just re-enable workers.dev to "open staging up" (both staging workers had workers.dev disabled Jul 21).
- Staging admin is built with `NEXT_PUBLIC_API_BASE=https://staging-api.homeseeker.me` — **build-time inlined**; setting a runtime var does nothing ([next-public-env-trap](next-public-env-trap.md)).

## Noindex: the header is the protection, not robots.txt

Non-production hosts serve `Disallow: /` plus `X-Robots-Tag: noindex, nofollow` (`apps/storefront/src/lib/indexability.ts` + `src/middleware.ts`). But **Cloudflare injects its own managed robots.txt with `User-agent: * / Allow: /` ABOVE the app's**, creating two conflicting `*` groups — robots.txt alone is NOT reliable on this setup. The `X-Robots-Tag` header is what actually keeps staging out of indexes; both were shipped for exactly this reason. Never rely on robots.txt alone for noindexing here.

## Recurring drift check

Staging D1 (`kira-office-staging`) drifts: it was found **5 migrations behind** (0056–0060) on 2026-07-22. Nothing syncs it automatically — when staging misbehaves, check `wrangler d1 migrations list kira-office-staging --remote` first ([d1-migration-discipline](d1-migration-discipline.md)).

Note: staging hosts still ride `homeseeker.me` while prod moved to `airplusauto.com` — and homeseeker.me is allowed to lapse per the domain plan ([platform](../platform/index.md)); staging hostnames are a dependency to re-home if that happens.
