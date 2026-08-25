---
type: guide
title: Auth — index
description: Cloudflare Access, staff login, owner sign-in, API auth, and the roles model for Kira.office
tags: [auth, index]
timestamp: 2026-08-24
status: live
sources: [docs/knowledge/auth/]
---

# Auth

Identity for Kira.office is layered: Cloudflare Access (email OTP) at the edge of the **admin** host → the API verifies the forwarded JWT itself → email-list roles → a staff password/PIN login on top. Read in this order:

- [access-model](access-model.md) — ONE Access app on the admin host; the API's gate is the STAFF SESSION since 25 Aug 2026, not the forwarded JWT; NEVER edge-gate the API host; team domain + AUD values; how to (not) find the AUD.
- [require-access-fail-open](require-access-fail-open.md) — RETIRED as the gate (25 Aug 2026): `requireAccess()` still fails OPEN, so never put it in front of a route again; what replaced each fail-open helper; the old `secret delete` rollback no longer works; public routes; secret-propagation flap.
- [access-destination-replace-trap](access-destination-replace-trap.md) — editing an Access destination silently unprotects the old hostname; add-then-verify with curl; owner-dashboard-only (agent tokens get 10000 errors).
- [roles-model](roles-model.md) — live 3-role email-list model (`viewerRole`), NOT the dormant rbac.ts; per-capability gates; slip images = super-admin only; `MECHANIC_EMAILS` unset in prod.
- [staff-login-and-lockout](staff-login-and-lockout.md) — PBKDF2 100k ceiling; EVERY role locks after 3 tries since 25 Aug 2026 (reversing the 9 Aug admin exemption, because `/recover` now exists); the per-caller 20-per-15-min throttle that catches PIN guesses the account lock never sees; uniform errors; bootstrap gap; read the row first.
- [owner-access-sign-in](owner-access-sign-in.md) — `POST /staff/login-access`; `canSignInAsOwner` fails CLOSED and must NEVER be replaced by `isSuperAdmin`; prod dependency on `SUPER_ADMIN_EMAILS`.
- [owner-lockout-incident](owner-lockout-incident.md) — 9 Aug 2026: the three structural bugs, the real root cause (stored hash matched nothing), and the read-the-row-first lesson.
- [dead-session-silent-access](dead-session-silent-access.md) — 24 Aug 2026: a cookie outliving its session drew the whole back office for nobody, with no redirect and no message; `mustSignIn` + `x-kira-path` make the layout's answer the one that decides, and `?next=` is finally honoured (and sanitised).
- [practice-copy-sign-in](practice-copy-sign-in.md) — the local practice copy's passwordless **Sign in to the practice copy** button; the two conditions that make it impossible in production (`PRACTICE_COPY=1` + no Access, with production shipping `"0"` explicitly and a test over `wrangler.jsonc` enforcing it); and why there is deliberately no hostname check — `wrangler dev` rewrites the Host header.
- [practice-copy-login-confusion](practice-copy-login-confusion.md) — 24 Aug 2026: a correct password rejected by a LOCAL practice copy; four worktrees, four databases, three passwords for one email; why `DevApiBanner` could not help and what replaced it.
- [staff-mechanic-section-plan](staff-mechanic-section-plan.md) — parked plan for per-staff RBAC + payroll + mechanic-approves-returns; partially overtaken by shipped work.

Adjacent areas: worker/host layout in [platform](../platform/index.md); deploys, secrets, and prod-D1 doors in [operations](../operations/index.md); payment/slip and claims flows in [commerce](../commerce/index.md).
