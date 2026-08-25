---
type: invariant
title: requireAccess fails OPEN when ACCESS_* is unset — RETIRED as the API's gate (25 Aug 2026)
description: The two Access secrets were load-bearing until the staff session replaced them as the gate; the fail-open function still exists and must never be put back in front of a route
tags: [api, cloudflare-access, fail-open, secrets, security, historical]
timestamp: 2026-08-25
status: historical
sources:
  [
    kira-office-api-is-unauthenticated.md,
    apps/api/src/index.ts,
    apps/api/src/staffGate.test.ts,
    session 2026-08-25,
  ]
---

# requireAccess fails open when unset (retired as the gate)

## What changed, and when

Until **25 August 2026** the sentence below was the single most load-bearing fact about this API.
It no longer is. The owner asked for the Kira.office PIN/password screen to be the everyday way in
rather than Cloudflare Access's email code, and that is only safe once the staff session can carry
the whole weight — so the gate on every non-public route is now `requireStaff`, which fails CLOSED.

**Read this page for the shape of the trap, not for the current wiring.** Current wiring is in
[access-model](access-model.md).

## The old invariant (still true of the function itself)

`requireAccess()` in `apps/api/src/index.ts` opens with:

```ts
if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return { email: null };
```

It fails **OPEN** — silently, with no startup check and no alarm. While it stood in front of every
route but `/img/*`, deleting either secret reopened the entire API to unauthenticated requests.

The function still exists and is still used in exactly one place: `POST /staff/login-access`, the
owner's Access-identity recovery ([owner-access-sign-in](owner-access-sign-in.md)). That call site
is safe because the decision beside it — `canSignInAsOwner` — demands Access be *genuinely*
configured and fails closed on its own. **Never put `requireAccess` back in front of a route.**

## Why it was that way, and what replaced each piece

Fail-open was a deliberate local-dev opening: a dev machine without Access configured stayed
usable. The trade was that production safety hung entirely on two `wrangler secret put` commands
having been run. Three helpers shared that shape, and all three have been dealt with:

| Was | Behaviour when `ACCESS_AUD` unset | Now |
| --- | --- | --- |
| `requireAccess` as the route gate | let everyone through | replaced by `requireStaff` (fails closed) |
| `isSuperAdmin(email, …)` | returned `true` | refund routes read `canRefund(session.role)` |
| `viewerRole(email, …)` | returned `"super_admin"` | claim routes + order detail read `session.role` |

Both core helpers remain in `packages/core/src/access.ts` with their fail-open defaults and are
still unit-tested there; they simply have no callers in `apps/api/src/index.ts` any more. Treat a
new call to either as a defect unless the caller supplies `accessConfigured` from something that
cannot go missing.

`apps/api/src/auth.ts` (`resolveActor` / `requireRole` — the dormant users-table `AppRole` system)
has the same fail-open shape via `rbacEnforced`. It is exported and unit-tested but **called by no
route**, so it decides nothing. It would need this same treatment before it is ever wired up.

## This has already burned us

Prod ran **wide open until 2026-07-20** because the two `wrangler secret put` commands were never
run. Unauthenticated writes succeeded and `actor_email` was `null` on every audit row. Resolved
Jul 20: secrets set, 401 verified. (History in [operations](../operations/index.md) incidents.)

A related audit-era warning (July 2026) has one enduring half: the `users` table had **zero writers
repo-wide**, so enabling enforcement against an empty `users` table locks everyone out. **Bootstrap
must precede enforcement.** That prediction materialized as the 9 Aug owner lockout — see
[owner-lockout-incident](owner-lockout-incident.md) — and it is the standing risk of the new gate
too: the API now refuses everyone who is not in `users`, so that table must never be empty.

## Intentionally public routes (unchanged)

`/health`, `/` and `/img/*` are public by design, checked *before* the gate so storefront `<img>`
tags work, along with the four `/staff/login*` endpoints, which are matched earlier still. The
storefront's only dependency on the API host is `IMG_BASE` → `/img/*` — it reads D1 and R2 through
its own bindings for everything else, which is why tightening this gate could not affect the shop.
This is also the reason edge Access must never sit on the API hostname ([access-model](access-model.md)).

## Operational gotchas

- **Secret propagation flap.** Worker secrets propagate across edge colos over ~30–60 s. Right
  after `secret put`, endpoints flap between 200 and 401. Re-test ~25 s apart; do not diagnose it
  as a routing problem.
- **The old emergency rollback is GONE.** `wrangler secret delete ACCESS_AUD` used to reopen the
  API instantly. It no longer does anything of the sort — the gate is the staff session, and no
  variable can switch it off. If the admin breaks on auth, the rollback is to revert the deploy.
- **Verifying ACCESS_AUD** is done via the audit-log write test, never by reading the dashboard —
  the dashboard shows a lookalike Policy ID, not the AUD ([access-model](access-model.md)).

## References

- `apps/api/src/index.ts` — `requireAccess` (login-access only), the `requireStaff` gate
- `apps/api/src/staffGate.test.ts` — the gate with Access switched off
- [access-model](access-model.md), [staff-login-and-lockout](staff-login-and-lockout.md),
  [owner-lockout-incident](owner-lockout-incident.md)
