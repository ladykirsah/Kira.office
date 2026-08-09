---
type: convention
title: Roles model — viewerRole email lists, not the dormant rbac.ts
description: super_admin / mechanic / admin via env email lists; per-capability gates; slip images super-admin only
tags: [roles, rbac, super-admin, mechanic, permissions, slip]
timestamp: 2026-08-09
status: live
sources: [kira-defect-claim-flow.md, kira-slip-super-admin-gating.md, kira-staff-mechanic-section-plan.md, packages/core/src/access.ts]
---

# Roles model

## What it is

The live roles system is **lightweight email-list matching**, implemented as `viewerRole(email, { superAdminEmails, mechanicEmails, accessConfigured })` in `packages/core/src/access.ts` (the source memory said "apps/api access.ts"; verified location is packages/core). Three roles:

| Role | Who |
|---|---|
| `super_admin` | email in `SUPER_ADMIN_EMAILS` |
| `mechanic` | email in `MECHANIC_EMAILS` (env) |
| `admin` | every other Cloudflare Access user |

Local dev (Access off) → `super_admin`, the same deliberate fail-open as `isSuperAdmin` (see [require-access-fail-open](require-access-fail-open.md) for why, and [owner-access-sign-in](owner-access-sign-in.md) for the one place this opening must never be reused).

This deliberately is **NOT** the dormant `rbac.ts` AppRole/users-table system (`packages/core/src/rbac.ts`). Tested in `packages/core/src/access.test.ts` (20 tests). Shipped with the defect-claim flow, PR #95.

## Capability gates

- `canReviewClaim` = super_admin + mechanic (a claim needs a mechanic's judgment)
- `canReviewPayment` = super_admin + admin — **never mechanic**
- Zone-A (primary action block on `/orders/:id`): claim approve/reject renders for super_admin + mechanic, plain admin sees it read-only/disabled; COD-pending and slip-review Zone A render for super_admin + admin, mechanic sees it disabled.

**Prod gap:** `MECHANIC_EMAILS` was UNSET in prod as of 1 Aug 2026 ⇒ claims are effectively super-admin-only until the owner runs `wrangler secret put MECHANIC_EMAILS`.

## Slip images: two-tier access (invariant)

Bank-transfer slips are financial PII, so the owner split access (31 Jul 2026):

- **Approve/reject the payment** (the "verifying" review decision) = **any admin** — it is the operational call and must not bottleneck on one person.
- **View the slip IMAGE** = **super_admin only, everywhere it appears** — the order Documents row AND inside the verifying review block. A regular admin can clear a payment without ever seeing the slip.

Mechanism: slip images live under R2 `slip/` and serve **only** through the Access-gated `GET /file/:key` route → core `privateFileAccess` (in `packages/core/src/access.ts`) → keys matching `slip/` require `isSuperAdmin` (env `SUPER_ADMIN_EMAILS`; local dev fail-open). The admin UI learns the viewer's status via `GET /orders/:id` returning `viewerIsSuperAdmin`. Reject → a "hold" state (awaiting customer; NO 48-hour auto-expire). Payment flow details in [commerce](../commerce/index.md).

## The other role system (status: stale? — verify before relying on it)

As of 2026-07-27: `resolveActor(db, email, …)` (in `apps/api/src/auth.ts`, re-exported from `index.ts`) maps an Access email → a role from the set owner/manager/stock_operator/finance_viewer (seen in tests), **but those roles were not enforced in the UI**, and an RBAC-enforcement finding was explicitly **REJECTED** in the Jul-26 bug hunt. The admin then sat behind ONE shared Access login (owner + mom); `AccessClaims` (JWT) already carries the verified email. Any staff/RBAC build must reconcile with this existing role set or replace it deliberately — see [staff-mechanic-section-plan](staff-mechanic-section-plan.md). This snapshot predates the staff-login work that has since shipped ([staff-login-and-lockout](staff-login-and-lockout.md)); re-verify against current code.

## References

- `packages/core/src/access.ts`, `packages/core/src/access.test.ts`, `packages/core/src/rbac.ts` (dormant)
- `apps/api/src/auth.ts` — `resolveActor`, `requireRole`
- PR #95
