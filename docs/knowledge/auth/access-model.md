---
type: infrastructure
title: Cloudflare Access model — one app on the admin host, JWT verified by the API
description: How admin auth works end to end; why the API hostname must never be edge-gated
tags: [cloudflare-access, jwt, admin, api, zero-trust]
timestamp: 2026-08-09
status: live
sources: [kira-office-access-login-setup.md, kira-office-api-is-unauthenticated.md, docs/KIRA_OFFICE_ACCESS_SETUP.md]
---

# Cloudflare Access model

## What it is

There is exactly **ONE Cloudflare Access application**, and it sits on the **admin hostname**. The admin's `/api/*` worker proxy forwards the `Cf-Access-Jwt-Assertion` header, and the **API worker verifies that JWT itself** via `requireAccess()` (`apps/api/src/index.ts`), checking it against `ACCESS_AUD` — which is the *admin* app's Application Audience tag. Identity therefore flows: visitor → email OTP at the Access edge → JWT → admin proxy → API `verifyAccessJwt`.

## Why the API host is NEVER edge-gated

Do **not** put an edge Access app on the API hostname. Two things break:

1. **Storefront product photos die.** `/img/*` on the API host serves public images to storefront `<img>` tags. Edge Access would 403 them *before* the worker's `isPublic` check ever runs.
2. **The admin proxy's server-side fetches break** — server-to-server calls do not carry the visitor's Access cookie.

The API instead gates in code: `isPublic` routes (`/health`, `/img/*`) pass, everything else requires the forwarded JWT. See [require-access-fail-open](require-access-fail-open.md) for the load-bearing caveat.

## Configuration identifiers (not credentials)

- `ACCESS_TEAM_DOMAIN` = `gogocash.cloudflareaccess.com`
- `ACCESS_AUD` = `dfcb79fc…` (the admin self-hosted app's Application Audience tag — full value in the Worker secret and the Cloudflare dashboard; truncated here per the no-values rule even though an AUD is an identifier, not a forgeable credential)
- Access policy: "Super Admin Only", One-time PIN, allowing the owner's address (`lady.kirsah@gmail.com`)
- Access lives on the **GoGoCash account's** Zero Trust. The older `kiraoffice.cloudflareaccess.com` team on the homeseeker account is **unused** — do not touch it.

Note: the memory these values came from predates the single-domain move — it names `admin.homeseeker.me` / `api.homeseeker.me`, but the *model* carried over unchanged to airplusauto.com (see [platform](../platform/index.md) for the current hostnames).

## Finding the AUD — do NOT hunt the dashboard

As of the 2026 Zero Trust redesign the AUD is **not visible** on Access → Applications under Overview/Details/Policies. The "Policy ID" shown there is a **different value** — a hyphenated UUID, not the 64-char hyphen-free hex AUD. Setting the Policy ID as `ACCESS_AUD` would 401 the entire back-office.

Correct verification (~30 seconds): have the owner perform a write in the admin, then check `audit_logs` records the route with `actor_email` = the owner's email. A real identity on a real request proves `verifyAccessJwt` passed its `aud` check on the actual request path.

## Invariants & traps

- Same Access app = same AUD; a **new** app issues a different AUD and breaks every API call after login. Prefer adding hostnames to the existing app — see [access-destination-replace-trap](access-destination-replace-trap.md).
- Gate a hostname **before** attaching it to a Worker route, never after.
- Runbook: `docs/KIRA_OFFICE_ACCESS_SETUP.md` (verify freshness against [conventions](../conventions/index.md) docs-map before trusting).

## References

- `apps/api/src/index.ts` — `requireAccess` / `verifyAccessJwt`
- [require-access-fail-open](require-access-fail-open.md), [roles-model](roles-model.md), [owner-access-sign-in](owner-access-sign-in.md)
