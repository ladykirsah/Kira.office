---
type: feature
title: Owner sign-in via Access identity — canSignInAsOwner, never isSuperAdmin
description: POST /staff/login-access turns Cloudflare Access's email-OTP proof into a self-repairing owner login
tags: [owner, access, login, super-admin, fail-closed, bootstrap]
timestamp: 2026-08-09
status: live
sources: [kira-owner-lockout-and-access-signin.md, packages/core/src/ownerSignIn.ts, apps/api/src/staffRoutes.ts]
---

# Owner sign-in via Access identity

## What it is

`POST /staff/login-access` (shipped in PR **#128**, commit `aa218ad`, live 9 Aug 2026) lets the shop owner into the admin on the strength of Cloudflare Access alone. Rationale: every recovery path in the staff login ends at "ask a super admin to set a new password" — no path at all when the person locked out **is** the super admin, and there is no bootstrap (the first super admin can only ever be inserted straight into D1 — see [staff-login-and-lockout](staff-login-and-lockout.md)). Cloudflare Access already stands in front of the admin and has proved who the visitor is, by one-time code to their mailbox, **before the login page is even reachable**. The endpoint turns that proof into a way in.

On success it **creates or repairs** the owner's staff row — demoted, deactivated, soft-deleted, and locked states all fixed at once — and issues a session. It does **NOT** touch password or PIN.

## THE GUARD: canSignInAsOwner, never isSuperAdmin

**Never reuse `isSuperAdmin` for this authorization.** `isSuperAdmin` answers "treat this request as privileged?" and deliberately returns **TRUE when Access is unconfigured** so local dev stays usable ([require-access-fail-open](require-access-fail-open.md)). Reusing it here would hand a super-admin session to anyone hitting a deployment that lost its `ACCESS_*` variables. The two questions look alike and **must never share an implementation**.

Authorization is `canSignInAsOwner` in `packages/core/src/ownerSignIn.ts` — a separate pure function that **fails CLOSED**, demanding all three independently:

1. Access is **genuinely configured** (`ACCESS_TEAM_DOMAIN` + `ACCESS_AUD` both set — no dev-mode opening);
2. the email came from a JWT the caller has **already verified against Cloudflare's keys** (never a client-supplied value);
3. that email is named in `SUPER_ADMIN_EMAILS`.

Hardening details (all verified in code):

- **Unset or blank allowlist = NOBODY**, never everybody — the likeliest misconfiguration must read as denial.
- **Exact address match, lowercased** — never a substring test, which a lookalike domain would satisfy.
- A non-owner is refused as plain "invalid", so the endpoint **cannot enumerate owners**. (Point 3 matters because passing Access proves *identity*, not *ownership* — anyone the Access policy admits would otherwise become super admin.)

## Plumbing requirement

The admin proxy must **forward `Cf-Access-Jwt-Assertion`** — `apiFetch` is server-to-server, so nothing of the visitor's request travels unless explicitly forwarded ([access-model](access-model.md)).

## Prod dependencies & verification

- `SUPER_ADMIN_EMAILS` must contain the owner's address. Settable in dashboard: Workers → `kiraoffice` → Settings → Variables.
- Post-deploy check: `/staff/login-access` answers `unauthorized` (not `access_not_configured`) — proving `ACCESS_*` is set on prod. Verified 9 Aug.

## Shipped alongside (same day, 9 Aug)

- PR #126 (`b417f16`) — day-off submission (ลาแบบ, leave-request form)
- PR #129 (`7fe11e9`) — admins never locked out for 24 h; mechanics still are ([staff-login-and-lockout](staff-login-and-lockout.md))
- CI deployed API + admin + storefront; all four jobs green ([operations](../operations/index.md)).

## References

- `packages/core/src/ownerSignIn.ts` (+ `ownerSignIn.test.ts`, `apps/api/src/ownerSignIn.test.ts`)
- [owner-lockout-incident](owner-lockout-incident.md) — the incident that forced this
