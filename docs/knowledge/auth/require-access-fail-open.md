---
type: invariant
title: requireAccess fails OPEN when ACCESS_* is unset
description: The two Access secrets are load-bearing — deleting either silently reopens the whole API
tags: [api, cloudflare-access, fail-open, secrets, security]
timestamp: 2026-08-09
status: live
sources: [kira-office-api-is-unauthenticated.md, apps/api/src/index.ts]
---

# requireAccess fails open when unset

## The invariant

`requireAccess()` in `apps/api/src/index.ts` opens with (verified in code, line ~311):

```ts
if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return { email: null };
```

It fails **OPEN** — silently, with no startup check and no alarm. Deleting either secret reopens the entire API to unauthenticated requests. **Treat `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` as load-bearing.**

## Why it is this way

Fail-open is a deliberate local-dev opening: a dev machine without Access configured stays usable. The trade is that production safety hangs entirely on two `wrangler secret put` commands having been run. This is also why `isSuperAdmin` returns true when Access is unconfigured, and why the owner sign-in endpoint deliberately does **not** reuse it — see [owner-access-sign-in](owner-access-sign-in.md).

## This has already burned us

Prod ran **wide open until 2026-07-20** because the two `wrangler secret put` commands were never run. Unauthenticated writes succeeded and `actor_email` was `null` on every audit row. Resolved Jul 20: secrets set, 401 verified. (History in [operations](../operations/index.md) incidents.)

A related audit-era warning (July 2026) has one enduring half: the `users` table had **zero writers repo-wide** (no INSERT, no seed), so enabling Access enforcement against an empty `users` table locks everyone out of every route gated through `apps/api/src/auth.ts`. **Bootstrap must precede enforcement.** This prediction materialized as the 9 Aug owner lockout — see [owner-lockout-incident](owner-lockout-incident.md).

## Intentionally public routes

`/health` and `/img/*` are public by design — `isPublic` is checked *before* the gate so storefront `<img>` tags work. The storefront's only dependency on the API host is `IMG_BASE` → `/img/*`. This is also the reason edge Access must never sit on the API hostname ([access-model](access-model.md)).

## Operational gotchas

- **Secret propagation flap.** Worker secrets propagate across edge colos over ~30–60 s. Right after `secret put`, endpoints flap between 200 and 401. Re-test ~25 s apart; do not diagnose it as a routing problem.
- **Emergency rollback.** If the admin breaks on auth: `wrangler secret delete ACCESS_AUD` — instant, fails open. (Then fix properly and re-set.)
- **Verifying ACCESS_AUD** is done via the audit-log write test, never by reading the dashboard — the dashboard shows a lookalike Policy ID, not the AUD ([access-model](access-model.md)).

## References

- `apps/api/src/index.ts` — `requireAccess`
- [access-model](access-model.md), [owner-lockout-incident](owner-lockout-incident.md)
