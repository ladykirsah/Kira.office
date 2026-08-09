---
type: guide
title: Auth — index
description: Cloudflare Access, staff login, owner sign-in, API auth, and the roles model for Kira.office
tags: [auth, index]
timestamp: 2026-08-09
status: live
sources: [docs/knowledge/auth/]
---

# Auth

Identity for Kira.office is layered: Cloudflare Access (email OTP) at the edge of the **admin** host → the API verifies the forwarded JWT itself → email-list roles → a staff password/PIN login on top. Read in this order:

- [access-model](access-model.md) — ONE Access app on the admin host; API verifies the forwarded JWT; NEVER edge-gate the API host; team domain + AUD values; how to (not) find the AUD.
- [require-access-fail-open](require-access-fail-open.md) — `requireAccess()` fails OPEN when `ACCESS_TEAM_DOMAIN`/`ACCESS_AUD` are unset; the secrets are load-bearing; public routes; secret-propagation flap; emergency rollback.
- [access-destination-replace-trap](access-destination-replace-trap.md) — editing an Access destination silently unprotects the old hostname; add-then-verify with curl; owner-dashboard-only (agent tokens get 10000 errors).
- [roles-model](roles-model.md) — live 3-role email-list model (`viewerRole`), NOT the dormant rbac.ts; per-capability gates; slip images = super-admin only; `MECHANIC_EMAILS` unset in prod.
- [staff-login-and-lockout](staff-login-and-lockout.md) — password/PIN login; the Workers 100k PBKDF2 ceiling and the unverifiable-210k trap; per-role lockout (#129); uniform errors; latent email-case bug; recovery tool.
- [owner-access-sign-in](owner-access-sign-in.md) — `POST /staff/login-access`; `canSignInAsOwner` fails CLOSED and must NEVER be replaced by `isSuperAdmin`; prod dependency on `SUPER_ADMIN_EMAILS`.
- [owner-lockout-incident](owner-lockout-incident.md) — 9 Aug 2026: the three structural bugs, the real root cause (stored hash matched nothing), and the read-the-row-first lesson.
- [staff-mechanic-section-plan](staff-mechanic-section-plan.md) — parked plan for per-staff RBAC + payroll + mechanic-approves-returns; partially overtaken by shipped work.

Adjacent areas: worker/host layout in [platform](../platform/index.md); deploys, secrets, and prod-D1 doors in [operations](../operations/index.md); payment/slip and claims flows in [commerce](../commerce/index.md).
